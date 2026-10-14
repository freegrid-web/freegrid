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
import { ViewportColumnsCalculator } from './../../3rdparty/walkontable/src';

/** The `autoColumnSize` setting as an object. */
type AutoColumnSizeSettings = {
  syncLimit?: number | string;
  useHeaders?: boolean;
  samplingRatio?: number;
  allowSampleDuplicates?: boolean;
};

/**
 * @plugin AutoColumnSize
 *
 * @description
 * This plugin allows to set column widths based on their widest cells.
 *
 * By default, the plugin is declared as `undefined`, which makes it enabled (same as if it was declared as `true`).
 * Enabling this plugin may decrease the overall table performance, as it needs to calculate the widths of all cells to
 * resize the columns accordingly.
 * If you experience problems with the performance, try turning this feature off and declaring the column widths manually.
 *
 * Column width calculations are divided into sync and async part. Each of this parts has their own advantages and
 * disadvantages. Synchronous calculations are faster but they block the browser UI, while the slower asynchronous
 * operations don't block the browser UI.
 *
 * To configure the sync/async distribution, you can pass an absolute value (number of columns) or a percentage value to a config object:
 * ```js
 * // as a number (300 columns in sync, rest async)
 * autoColumnSize: {syncLimit: 300},
 *
 * // as a string (percent)
 * autoColumnSize: {syncLimit: '40%'},
 * ```
 *
 * To configure this plugin see {@link Options#autoColumnSize}.
 *
 * @example
 * ```js
 * const hot = new FreeGrid(document.getElementById('example'), {
 *   date: getData(),
 *   autoColumnSize: true
 * });
 * // Access to plugin instance:
 * const plugin = hot.getPlugin('autoColumnSize');
 *
 * plugin.getColumnWidth(4);
 *
 * if (plugin.isEnabled()) {
 *   // code...
 * }
 * ```
 */
class AutoColumnSize extends BasePlugin {
  /** How many columns one asynchronous step measures. */
  static get CALCULATION_STEP(): number {
    return 50;
  }

  /** How many columns are measured synchronously by default. */
  static get SYNC_CALCULATION_LIMIT(): number {
    return 50;
  }

  /**
   * Cached columns widths.
   */
  widths: (number | undefined)[] = [];

  /**
   * Instance of {@link GhostTable} for rows and columns size calculations.
   *
   * @private
   */
  ghostTable: GhostTable;

  /**
   * Instance of {@link SamplesGenerator} for generating samples necessary for columns width calculations.
   *
   * @private
   */
  samplesGenerator: SamplesGenerator;

  /**
   * `true` only if the first calculation was performed
   *
   * @private
   */
  firstCalculation = true;

  /**
   * `true` if the size calculation is in progress.
   */
  inProgress = false;

  /**
   * Cached column header names. It is used to diff current column headers with previous state and detect which
   * columns width should be updated.
   */
  #cachedColumnHeaders: unknown[] = [];

  constructor(hotInstance: PluginHost) {
    super(hotInstance);
    this.ghostTable = new GhostTable(this.hot);
    // A cell's value, and the length of its label (a checkbox's label takes room too).
    this.samplesGenerator = new SamplesGenerator((row, column) => {
      const cellMeta = this.hot.getCellMeta(row, column);
      const cellValue = cellMeta.spanned ? '' : this.hot.getDataAtCell(row, column);
      let bundleCountSeed = 0;

      if (cellMeta.label) {
        const { value: labelValue, property: labelProperty } = cellMeta.label;
        let labelText = '';

        if (labelValue) {
          labelText = typeof labelValue === 'function' ?
            labelValue(row, column, this.hot.colToProp(column), cellValue) : labelValue;
        } else if (labelProperty) {
          labelText = this.hot.getDataAtRowProp(row, labelProperty) as string;
        }
        bundleCountSeed = labelText.length;
      }

      return { value: cellValue, bundleCountSeed };
    });

    // In the constructor, so that a double click on the resize handle fits the column also when the plugin is off.
    this.addHook('beforeColumnResize',
      (col: number, size: number, isDblClick: boolean) => this.onBeforeColumnResize(col, size, isDblClick));
  }

  /**
   * Checks if the plugin is enabled in the FreeGrid settings. This method is executed in {@link Hooks#beforeInit}
   * hook and if it returns `true` than the {@link AutoColumnSize#enablePlugin} method is called.
   */
  isEnabled(): boolean {
    return this.hot.getSettings().autoColumnSize !== false && !this.hot.getSettings().colWidths;
  }

  /**
   * Enables the plugin functionality for this FreeGrid instance.
   */
  enablePlugin(): void {
    if (this.enabled) {
      return;
    }
    const setting = this.hot.getSettings().autoColumnSize;

    if (setting && setting.useHeaders !== null && setting.useHeaders !== undefined) {
      this.ghostTable.setSetting('useHeaders', setting.useHeaders);
    }

    this.setSamplingOptions();

    this.addHook('afterLoadData', () => this.onAfterLoadData());
    this.addHook('beforeChange', (changes: [number, string | number][]) => this.onBeforeChange(changes));
    this.addHook('beforeRender', () => this.onBeforeRender());
    this.addHook('modifyColWidth', (width: number | undefined, col: number) => this.getColumnWidth(col, width));
    this.addHook('afterInit', () => this.onAfterInit());
    super.enablePlugin();
  }

  /**
   * Updates the plugin state. This method is executed when {@link Core#updateSettings} is invoked.
   */
  updatePlugin(): void {
    const changedColumns = this.findColumnsWhereHeaderWasChanged();

    if (changedColumns.length) {
      this.clearCache(changedColumns);
    }
    super.updatePlugin();
  }

  /**
   * Disables the plugin functionality for this FreeGrid instance.
   */
  disablePlugin(): void {
    super.disablePlugin();
  }

  /**
   * Calculates a columns width.
   *
   * @param [colRange] Column index or an object with `from` and `to` indexes as a range.
   * @param [rowRange] Row index or an object with `from` and `to` indexes as a range.
   * @param [force=false] If `true` the calculation will be processed regardless of whether the width exists in the cache.
   */
  calculateColumnsWidth(colRange: number | IndexRange = { from: 0, to: this.hot.countCols() - 1 },
    rowRange: number | IndexRange = { from: 0, to: this.hot.countRows() - 1 }, force = false): void {
    const columnsRange = typeof colRange === 'number' ? { from: colRange, to: colRange } : colRange;
    const rowsRange = typeof rowRange === 'number' ? { from: rowRange, to: rowRange } : rowRange;

    for (let col = columnsRange.from; col <= columnsRange.to; col += 1) {
      if (force || (this.widths[col] === undefined && !this.hot._getColWidthFromSettings(col))) {
        this.samplesGenerator.generateColumnSamples(col, rowsRange)
          .forEach((sample, column) => this.ghostTable.addColumn(column, sample));
      }
    }

    if (this.ghostTable.columns.length) {
      this.ghostTable.getWidths((col, width) => {
        this.widths[col] = width;
      });
      this.ghostTable.clean();
    }
  }

  /**
   * Calculates all columns width. The calculated column will be cached in the {@link AutoColumnSize#widths} property.
   * To retrieve width for specyfied column use {@link AutoColumnSize#getColumnWidth} method.
   *
   * @param [rowRange] Row index or an object with `from` and `to` properties which define row range.
   */
  calculateAllColumnsWidth(rowRange: number | IndexRange = { from: 0, to: this.hot.countRows() - 1 }): void {
    let current = 0;
    const length = this.hot.countCols() - 1;
    let timer: number | undefined;

    this.inProgress = true;

    const loop = () => {
      // When hot was destroyed after calculating finished cancel frame
      if (!this.hot) {
        cancelAnimationFrame(timer!);
        this.inProgress = false;

        return;
      }

      this.calculateColumnsWidth({
        from: current,
        to: Math.min(current + AutoColumnSize.CALCULATION_STEP, length)
      }, rowRange);

      current = current + AutoColumnSize.CALCULATION_STEP + 1;

      if (current < length) {
        timer = requestAnimationFrame(loop);
      } else {
        cancelAnimationFrame(timer!);
        this.inProgress = false;

        // Each size plugin resizes the overlays; once per render cycle would do (see #70).
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
      this.calculateColumnsWidth({ from: 0, to: syncLimit }, rowRange);
      this.firstCalculation = false;
      current = syncLimit + 1;
    }
    // async
    if (current < length) {
      loop();
    } else {
      this.inProgress = false;
    }
  }

  /**
   * Sets the sampling options.
   *
   * @private
   */
  setSamplingOptions(): void {
    const setting = this.hot.getSettings().autoColumnSize;
    const { samplingRatio, allowSampleDuplicates }: AutoColumnSizeSettings = isObject(setting) ? setting : {};

    if (samplingRatio && !Number.isNaN(Number(samplingRatio))) {
      this.samplesGenerator.setSampleCount(parseInt(String(samplingRatio), 10));
    }

    if (allowSampleDuplicates) {
      this.samplesGenerator.setAllowDuplicates(allowSampleDuplicates);
    }
  }

  /**
   * Recalculates all columns width (overwrite cache values).
   */
  recalculateAllColumnsWidth(): void {
    if (this.hot.view && isVisible(this.hot.view.wt.wtTable.TABLE)) {
      this.clearCache();
      this.calculateAllColumnsWidth();
    }
  }

  /**
   * Gets value which tells how many columns should be calculated synchronously (rest of the columns will be calculated
   * asynchronously). The limit is calculated based on `syncLimit` set to `autoColumnSize` option (see {@link Options#autoColumnSize}).
   */
  getSyncCalculationLimit(): number {
    const setting = this.hot.getSettings().autoColumnSize;
    const colsLimit: number = this.hot.countCols() - 1;
    let limit = AutoColumnSize.SYNC_CALCULATION_LIMIT;

    if (isObject(setting)) {
      const { syncLimit } = setting as AutoColumnSizeSettings;

      // A percentage of the columns, or a number (anything else is 0).
      limit = isPercentValue(syncLimit) ? valueAccordingPercent(colsLimit, syncLimit as string) : (syncLimit as number) >> 0;
    }

    return Math.min(limit, colsLimit);
  }

  /**
   * Gets the calculated column width.
   *
   * @param column Column index.
   * @param [defaultWidth] Default column width. It will be picked up if no calculated width found.
   * @param [keepMinimum=true] If `true` then returned value won't be smaller then 50 (default column width).
   */
  getColumnWidth(column: number, defaultWidth?: number, keepMinimum = true): number | undefined {
    if (defaultWidth !== undefined) {
      return defaultWidth;
    }
    const width = this.widths[column];

    return keepMinimum && typeof width === 'number' ? Math.max(width, ViewportColumnsCalculator.DEFAULT_WIDTH) : width;
  }

  /**
   * Gets the first visible column.
   *
   * @returns Returns column index, -1 if table is not rendered or null if there are no columns to base the the calculations on.
   */
  getFirstVisibleColumn(): number | null {
    const wot = this.hot.view.wt;

    if (wot.wtViewport.columnsVisibleCalculator) {
      return wot.wtTable.getFirstVisibleColumn();
    }
    if (wot.wtViewport.columnsRenderCalculator) {
      return wot.wtTable.getFirstRenderedColumn();
    }

    return -1;
  }

  /**
   * Gets the last visible column.
   *
   * @returns Returns column index or -1 if table is not rendered.
   */
  getLastVisibleColumn(): number | null {
    const wot = this.hot.view.wt;

    if (wot.wtViewport.columnsVisibleCalculator) {
      return wot.wtTable.getLastVisibleColumn();
    }
    if (wot.wtViewport.columnsRenderCalculator) {
      return wot.wtTable.getLastRenderedColumn();
    }

    return -1;
  }

  /**
   * Collects all columns which titles has been changed in comparison to the previous state.
   *
   * @private
   * @returns It returns an array of physical column indexes.
   */
  findColumnsWhereHeaderWasChanged(): number[] {
    const columnHeaders = this.hot.getColHeader();
    const cachedColumnHeaders = this.#cachedColumnHeaders;

    // `getColHeader()` can return a single header instead of an array (see `modifyColHeader`).
    const changedColumns = Array.from(columnHeaders as ArrayLike<unknown>).reduce<number[]>((acc, columnTitle, physicalColumn) => {
      const cachedColumnsLength = cachedColumnHeaders.length;

      if (cachedColumnsLength - 1 < physicalColumn || cachedColumnHeaders[physicalColumn] !== columnTitle) {
        acc.push(physicalColumn);
      }
      if (cachedColumnsLength - 1 < physicalColumn) {
        cachedColumnHeaders.push(columnTitle);
      } else {
        cachedColumnHeaders[physicalColumn] = columnTitle;
      }

      return acc;
    }, []);

    return changedColumns;
  }

  /**
   * Clears cache of calculated column widths. If you want to clear only selected columns pass an array with their indexes.
   * Otherwise whole cache will be cleared.
   *
   * @param [columns] List of physical column indexes to clear.
   */
  clearCache(columns: number[] = []): void {
    if (columns.length) {
      columns.forEach((physicalIndex) => {
        this.widths[physicalIndex] = undefined;
      });
    } else {
      this.widths.length = 0;
    }
  }

  /**
   * Checks if all widths were calculated. If not then return `true` (need recalculate).
   */
  isNeedRecalculate(): boolean {
    // `includes` also counts holes (columns whose width was never measured), like the old helper did.
    return this.widths.includes(undefined);
  }

  /**
   * On before render listener.
   *
   * @private
   */
  onBeforeRender(): void {
    const force = this.hot.renderCall;
    const rowsCount = this.hot.countRows();
    const firstVisibleColumn = this.getFirstVisibleColumn();
    const lastVisibleColumn = this.getLastVisibleColumn();

    if (firstVisibleColumn === null || lastVisibleColumn === null) {
      return;
    }

    // Keep last column widths unchanged for situation when all rows was deleted or trimmed (pro #6)
    if (!rowsCount) {
      return;
    }

    this.calculateColumnsWidth({ from: firstVisibleColumn, to: lastVisibleColumn }, undefined, force);

    if (this.isNeedRecalculate() && !this.inProgress) {
      this.calculateAllColumnsWidth();
    }
  }

  /**
   * On after load data listener.
   *
   * @private
   */
  onAfterLoadData(): void {
    if (this.hot.view) {
      this.recalculateAllColumnsWidth();
    } else {
      // first load - initialization
      setTimeout(() => {
        if (this.hot) {
          this.recalculateAllColumnsWidth();
        }
      }, 0);
    }
  }

  /**
   * On before change listener.
   *
   * @private
   * @param changes The changes: `[row, column or property, …]`.
   */
  onBeforeChange(changes: [number, string | number][]): void {
    const changedColumns = changes.map(([, column]) => this.hot.propToCol(column));

    this.clearCache(changedColumns);
  }

  /**
   * On before column resize listener.
   *
   * @private
   * @param col The resized column.
   * @param size Its new width.
   * @param isDblClick Whether the handle was double clicked (the column fits its content).
   */
  onBeforeColumnResize(col: number, size: number, isDblClick: boolean): number | undefined {
    if (!isDblClick) {
      return size;
    }
    this.calculateColumnsWidth(col, undefined, true);

    return this.getColumnWidth(col, undefined, false);
  }

  /**
   * On after FreeGrid init fill plugin with all necessary values.
   *
   * @private
   */
  onAfterInit(): void {
    this.#cachedColumnHeaders = this.hot.getColHeader();
  }

  /**
   * Destroys the plugin instance.
   */
  destroy(): void {
    this.ghostTable.clean();
    super.destroy();
  }
}

registerPlugin('autoColumnSize', AutoColumnSize);

export default AutoColumnSize;
