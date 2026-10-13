import BasePlugin from './../_base';
import type { PluginHost } from './../_base';
import { isVisible } from './../../helpers/dom/element';
import GhostTable from './../../utils/ghostTable';
import { isObject } from './../../helpers/object';
import { valueAccordingPercent } from './../../helpers/number';
import { registerPlugin } from './../../plugins';
import SamplesGenerator from './../../utils/samplesGenerator';
import type { IndexRange } from './../../utils/samplesGenerator';
import { isPercentValue } from './../../helpers/string';

/** The `autoRowSize` setting as an object. */
type AutoRowSizeSettings = { syncLimit?: number | string; samplingRatio?: number; allowSampleDuplicates?: boolean };

/**
 * @plugin AutoRowSize
 *
 * @description
 * This plugin allows to set row heights based on their highest cells.
 *
 * By default, the plugin is declared as `undefined`, which makes it disabled (same as if it was declared as `false`).
 * Enabling this plugin may decrease the overall table performance, as it needs to calculate the heights of all cells to
 * resize the rows accordingly.
 * If you experience problems with the performance, try turning this feature off and declaring the row heights manually.
 *
 * Row height calculations are divided into sync and async part. Each of this parts has their own advantages and
 * disadvantages. Synchronous calculations are faster but they block the browser UI, while the slower asynchronous
 * operations don't block the browser UI.
 *
 * To configure the sync/async distribution, you can pass an absolute value (number of columns) or a percentage value to a config object:
 * ```js
 * // as a number (300 columns in sync, rest async)
 * autoRowSize: {syncLimit: 300},
 *
 * // as a string (percent)
 * autoRowSize: {syncLimit: '40%'},
 *
 * // allow sample duplication
 * autoRowSize: {syncLimit: '40%', allowSampleDuplicates: true},
 * ```
 *
 * You can also use the `allowSampleDuplicates` option to allow sampling duplicate values when calculating the row
 * height. __Note__, that this might have a negative impact on performance.
 *
 * To configure this plugin see {@link Options#autoRowSize}.
 *
 * @example
 *
 * ```js
 * const hot = new FreeGrid(document.getElementById('example'), {
 *   date: getData(),
 *   autoRowSize: true
 * });
 * // Access to plugin instance:
 * const plugin = hot.getPlugin('autoRowSize');
 *
 * plugin.getRowHeight(4);
 *
 * if (plugin.isEnabled()) {
 *   // code...
 * }
 * ```
 */
class AutoRowSize extends BasePlugin {
  /** How many rows one asynchronous step measures. */
  static get CALCULATION_STEP(): number {
    return 50;
  }

  /** How many rows are measured synchronously by default. */
  static get SYNC_CALCULATION_LIMIT(): number {
    return 500;
  }

  /**
   * Cached rows heights (`heights[-1]` is the column headers' height).
   */
  heights: (number | undefined)[] = [];

  /**
   * Instance of {@link GhostTable} for rows and columns size calculations.
   *
   * @private
   */
  ghostTable: GhostTable;

  /**
   * Instance of {@link SamplesGenerator} for generating samples necessary for rows height calculations.
   *
   * @private
   */
  samplesGenerator: SamplesGenerator;

  /**
   * `true` if only the first calculation was performed.
   *
   * @private
   */
  firstCalculation = true;

  /**
   * `true` if the size calculation is in progress.
   */
  inProgress = false;

  constructor(hotInstance: PluginHost) {
    super(hotInstance);
    this.ghostTable = new GhostTable(this.hot);
    // A cell's value; row -1 is the column headers.
    this.samplesGenerator = new SamplesGenerator((row, col) => {
      let cellValue;

      if (row >= 0) {
        cellValue = this.hot.getDataAtCell(row, col);
      } else if (row === -1) {
        cellValue = this.hot.getColHeader(col);
      }

      return { value: cellValue };
    });

    // In the constructor, so that a double click on the resize handle fits the row also when the plugin is off.
    this.addHook('beforeRowResize',
      (row: number, size: number, isDblClick: boolean) => this.onBeforeRowResize(row, size, isDblClick));
  }

  /**
   * Checks if the plugin is enabled in the FreeGrid settings. This method is executed in {@link Hooks#beforeInit}
   * hook and if it returns `true` than the {@link AutoRowSize#enablePlugin} method is called.
   */
  isEnabled(): boolean {
    return this.hot.getSettings().autoRowSize === true || isObject(this.hot.getSettings().autoRowSize);
  }

  /**
   * Enables the plugin functionality for this FreeGrid instance.
   */
  enablePlugin(): void {
    if (this.enabled) {
      return;
    }

    this.setSamplingOptions();

    this.addHook('afterLoadData', () => this.onAfterLoadData());
    this.addHook('beforeChange', (changes: [number, ...unknown[]][]) => this.onBeforeChange(changes));
    this.addHook('beforeColumnMove', () => this.recalculateAllRowsHeight());
    this.addHook('beforeColumnResize', () => this.recalculateAllRowsHeight());
    this.addHook('beforeColumnSort', () => this.clearCache());
    this.addHook('beforeRender', () => this.onBeforeRender());
    this.addHook('beforeRowMove', (rowStart: number, rowEnd: number) => this.onBeforeRowMove(rowStart, rowEnd));
    this.addHook('modifyRowHeight', (height: number | undefined, row: number) => this.getRowHeight(row, height));
    this.addHook('modifyColumnHeaderHeight', () => this.getColumnHeaderHeight());
    super.enablePlugin();
  }

  /**
   * Disables the plugin functionality for this FreeGrid instance.
   */
  disablePlugin(): void {
    super.disablePlugin();
  }

  /**
   * Calculate a given rows height.
   *
   * @param [rowRange] Row index or an object with `from` and `to` indexes as a range.
   * @param [colRange] Column index or an object with `from` and `to` indexes as a range.
   * @param [force=false] If `true` the calculation will be processed regardless of whether the width exists in the cache.
   */
  calculateRowsHeight(rowRange: number | IndexRange = { from: 0, to: this.hot.countRows() - 1 },
    colRange: number | IndexRange = { from: 0, to: this.hot.countCols() - 1 }, force = false): void {
    const rowsRange = typeof rowRange === 'number' ? { from: rowRange, to: rowRange } : rowRange;
    const columnsRange = typeof colRange === 'number' ? { from: colRange, to: colRange } : colRange;

    if (this.hot.getColHeader(0) !== null) {
      const samples = this.samplesGenerator.generateRowSamples(-1, columnsRange);

      this.ghostTable.addColumnHeadersRow(samples.get(-1)!);
    }

    for (let row = rowsRange.from; row <= rowsRange.to; row += 1) {
      // A row is measured even when its height is set: rows grow to fit their content, they never shrink.
      if (force || this.heights[row] === undefined) {
        this.samplesGenerator.generateRowSamples(row, columnsRange)
          .forEach((sample, rowIndex) => this.ghostTable.addRow(rowIndex, sample));
      }
    }
    if (this.ghostTable.rows.length) {
      this.ghostTable.getHeights((row, height) => {
        this.heights[row] = height;
      });
      this.ghostTable.clean();
    }
  }

  /**
   * Calculate all rows heights. The calculated row will be cached in the {@link AutoRowSize#heights} property.
   * To retrieve height for specyfied row use {@link AutoRowSize#getRowHeight} method.
   *
   * @param [colRange] Column index or an object with `from` and `to` properties which define the columns to measure.
   */
  calculateAllRowsHeight(colRange: number | IndexRange = { from: 0, to: this.hot.countCols() - 1 }): void {
    let current = 0;
    const length = this.hot.countRows() - 1;
    let timer: number | undefined;

    this.inProgress = true;

    const loop = () => {
      // When hot was destroyed after calculating finished cancel frame
      if (!this.hot) {
        cancelAnimationFrame(timer!);
        this.inProgress = false;

        return;
      }
      this.calculateRowsHeight({ from: current, to: Math.min(current + AutoRowSize.CALCULATION_STEP, length) }, colRange);
      current = current + AutoRowSize.CALCULATION_STEP + 1;

      if (current < length) {
        timer = requestAnimationFrame(loop);
      } else {
        cancelAnimationFrame(timer!);
        this.inProgress = false;

        // @TODO Should call once per render cycle, currently fired separately in different plugins
        this.hot.view.wt.wtOverlays.adjustElementsSize(true);
        // tmp
        if (this.hot.view.wt.wtOverlays.leftOverlay.needFullRender) {
          this.hot.view.wt.wtOverlays.leftOverlay.clone.draw();
        }
      }
    };

    const syncLimit = this.getSyncCalculationLimit();

    // sync
    if (this.firstCalculation && syncLimit >= 0) {
      this.calculateRowsHeight({ from: 0, to: syncLimit }, colRange);
      this.firstCalculation = false;
      current = syncLimit + 1;
    }
    // async
    if (current < length) {
      loop();
    } else {
      this.inProgress = false;
      this.hot.view.wt.wtOverlays.adjustElementsSize(false);
    }
  }

  /**
   * Sets the sampling options.
   *
   * @private
   */
  setSamplingOptions(): void {
    const setting = this.hot.getSettings().autoRowSize;
    const { samplingRatio, allowSampleDuplicates }: AutoRowSizeSettings = isObject(setting) ? setting : {};

    if (samplingRatio && !Number.isNaN(Number(samplingRatio))) {
      this.samplesGenerator.setSampleCount(parseInt(String(samplingRatio), 10));
    }

    if (allowSampleDuplicates) {
      this.samplesGenerator.setAllowDuplicates(allowSampleDuplicates);
    }
  }

  /**
   * Recalculates all rows height (overwrite cache values).
   */
  recalculateAllRowsHeight(): void {
    if (isVisible(this.hot.view.wt.wtTable.TABLE)) {
      this.clearCache();
      this.calculateAllRowsHeight();
    }
  }

  /**
   * Gets value which tells how many rows should be calculated synchronously (rest of the rows will be calculated
   * asynchronously). The limit is calculated based on `syncLimit` set to autoRowSize option (see {@link Options#autoRowSize}).
   */
  getSyncCalculationLimit(): number {
    const setting = this.hot.getSettings().autoRowSize;
    const rowsLimit: number = this.hot.countRows() - 1;
    let limit = AutoRowSize.SYNC_CALCULATION_LIMIT;

    if (isObject(setting)) {
      const { syncLimit } = setting as AutoRowSizeSettings;

      // A percentage of the rows, or a number (anything else is 0).
      // eslint-disable-next-line no-bitwise
      limit = isPercentValue(syncLimit) ? valueAccordingPercent(rowsLimit, syncLimit as string) : (syncLimit as number) >> 0;
    }

    return Math.min(limit, rowsLimit);
  }

  /**
   * Gets the calculated row height.
   *
   * @param row Visual row index.
   * @param [defaultHeight] Default row height. It will be picked up if no calculated height found.
   */
  getRowHeight(row: number, defaultHeight?: number): number | undefined {
    const height = this.heights[row];

    return height !== undefined && height > (defaultHeight || 0) ? height : defaultHeight;
  }

  /**
   * Get the calculated column header height.
   */
  getColumnHeaderHeight(): number | undefined {
    return this.heights[-1];
  }

  /**
   * Get the first visible row.
   *
   * @returns Returns row index, -1 if table is not rendered or null if there are no rows to base the the calculations on.
   */
  getFirstVisibleRow(): number | null {
    const wot = this.hot.view.wt;

    if (wot.wtViewport.rowsVisibleCalculator) {
      return wot.wtTable.getFirstVisibleRow();
    }
    if (wot.wtViewport.rowsRenderCalculator) {
      return wot.wtTable.getFirstRenderedRow();
    }

    return -1;
  }

  /**
   * Gets the last visible row.
   *
   * @returns Returns row index or -1 if table is not rendered.
   */
  getLastVisibleRow(): number | null {
    const wot = this.hot.view.wt;

    if (wot.wtViewport.rowsVisibleCalculator) {
      return wot.wtTable.getLastVisibleRow();
    }
    if (wot.wtViewport.rowsRenderCalculator) {
      return wot.wtTable.getLastRenderedRow();
    }

    return -1;
  }

  /**
   * Clears cached heights.
   */
  clearCache(): void {
    this.heights.length = 0;
    // `length` does not clear the headers' height.
    this.heights[-1] = undefined;
  }

  /**
   * Clears cache by range.
   *
   * @param range Row index or an object with `from` and `to` properties which define row range.
   */
  clearCacheByRange(range: number | IndexRange): void {
    const { from, to } = typeof range === 'number' ? { from: range, to: range } : range;

    for (let row = Math.min(from, to); row <= Math.max(from, to); row += 1) {
      this.heights[row] = undefined;
    }
  }

  /**
   * Checks if all heights were calculated. If not then return `true` (need recalculate).
   */
  isNeedRecalculate(): boolean {
    // `includes` also counts holes (rows whose height was never measured), like the old helper did.
    return this.heights.includes(undefined);
  }

  /**
   * On before render listener.
   *
   * @private
   */
  onBeforeRender(): void {
    const force = this.hot.renderCall;
    const fixedRowsBottom = this.hot.getSettings().fixedRowsBottom;
    const firstVisibleRow = this.getFirstVisibleRow();
    const lastVisibleRow = this.getLastVisibleRow();

    if (firstVisibleRow === null || lastVisibleRow === null) {
      return;
    }

    this.calculateRowsHeight({ from: firstVisibleRow, to: lastVisibleRow }, undefined, force);

    // Calculate rows height synchronously for bottom overlay
    if (fixedRowsBottom) {
      const totalRows = this.hot.countRows() - 1;
      this.calculateRowsHeight({ from: totalRows - fixedRowsBottom, to: totalRows });
    }

    if (this.isNeedRecalculate() && !this.inProgress) {
      this.calculateAllRowsHeight();
    }
  }

  /**
   * On before row move listener.
   *
   * @private
   * @param from Row index where was grabbed.
   * @param to Destination row index.
   */
  onBeforeRowMove(from: number, to: number): void {
    this.clearCacheByRange({ from, to });
    this.calculateAllRowsHeight();
  }

  /**
   * On before row resize listener.
   *
   * @private
   * @param row The resized row.
   * @param size Its new height.
   * @param isDblClick Whether the handle was double clicked (the row fits its content).
   */
  onBeforeRowResize(row: number, size: number, isDblClick: boolean): number | undefined {
    if (!isDblClick) {
      return size;
    }
    this.calculateRowsHeight(row, undefined, true);

    return this.getRowHeight(row);
  }

  /**
   * On after load data listener.
   *
   * @private
   */
  onAfterLoadData(): void {
    if (this.hot.view) {
      this.recalculateAllRowsHeight();
    } else {
      // first load - initialization
      setTimeout(() => {
        if (this.hot) {
          this.recalculateAllRowsHeight();
        }
      }, 0);
    }
  }

  /**
   * On before change listener.
   *
   * @private
   * @param changes The changes: `[row, …]`.
   */
  onBeforeChange(changes: [number, ...unknown[]][]): void {
    if (changes.length === 1) {
      this.clearCacheByRange(changes[0][0]);
    } else if (changes.length > 1) {
      this.clearCacheByRange({ from: changes[0][0], to: changes[changes.length - 1][0] });
    }
  }

  /**
   * Destroys the plugin instance.
   */
  destroy(): void {
    this.ghostTable.clean();
    super.destroy();
  }
}

registerPlugin('autoRowSize', AutoRowSize);

export default AutoRowSize;
