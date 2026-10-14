import BasePlugin from './../_base';
import type { PluginHost } from './../_base';
import Hooks from './../../pluginHooks';
import { addClass, removeClass, offset } from './../../helpers/dom/element';
import { rangeEach } from './../../helpers/number';
import EventManager from './../../eventManager';
import { registerPlugin } from './../../plugins';
import RowsMapper from './rowsMapper';
import BacklightUI from './ui/backlight';
import GuidelineUI from './ui/guideline';
import type { CellCoords } from './../../3rdparty/walkontable/src';

import './manualRowMove.css';

Hooks.getSingleton().register('beforeRowMove');
Hooks.getSingleton().register('afterRowMove');
Hooks.getSingleton().register('unmodifyRow');

/** The state of a drag of row headers. */
type MoveState = {
  rowsToMove: number[];
  countRows?: number;
  fixedRows?: number;
  pressed?: boolean;
  disallowMoving?: boolean;
  coordsRow?: number;
  hasColHeaders?: boolean;
  rootElementOffset?: number;
  backlightHeight?: number;
  target: { eventPageY?: number; coords?: CellCoords; TD?: HTMLTableCellElement; row?: number };
  [key: string]: unknown;
};

/** Which selection changes a mouse action may make (set by hook listeners). */
type BlockCalculations = { row?: boolean; column?: boolean; cell?: boolean };

/** A mouse event, with the cell or header it happened on (set by EventManager). */
type GridMouseEvent = MouseEvent & { realTarget: HTMLElement; layerX: number; layerY: number };
const CSS_PLUGIN = 'fg-manual-row-move';
const CSS_SHOW_UI = 'show-ui';
const CSS_ON_MOVING = 'on-moving--rows';
const CSS_AFTER_SELECTION = 'after-selection--rows';

/**
 * @plugin ManualRowMove
 *
 * @description
 * This plugin allows to change rows order. To make rows order persistent the {@link Options#persistentState}
 * plugin should be enabled.
 *
 * API:
 * - moveRow - move single row to the new position.
 * - moveRows - move many rows (as an array of indexes) to the new position.
 *
 * If you want apply visual changes, you have to call manually the render() method on the instance of FreeGrid.
 *
 * The plugin creates additional components to make moving possibly using user interface:
 * - backlight - highlight of selected rows.
 * - guideline - line which shows where rows has been moved.
 *
 * @class ManualRowMove
 * @plugin ManualRowMove
 */
class ManualRowMove extends BasePlugin {
  /**
   * List of last removed row indexes.
   *
   * @private
   */
  removedRows: number[] = [];

  /**
   * Object containing visual row indexes mapped to data source indexes.
   *
   * @private
   */
  rowsMapper: RowsMapper;

  /**
   * Event Manager object.
   *
   * @private
   */
  eventManager: EventManager;

  /**
   * Backlight UI object.
   *
   * @private
   */
  backlight: BacklightUI;

  /**
   * Guideline UI object.
   *
   * @private
   */
  guideline: GuidelineUI;

  #priv: MoveState = {
    rowsToMove: [],
    pressed: undefined,
    disallowMoving: undefined,
    target: {
      eventPageY: undefined,
      coords: undefined,
      TD: undefined,
      row: undefined
    }
  };

  constructor(hotInstance: PluginHost) {
    super(hotInstance);
    this.rowsMapper = new RowsMapper(this);
    this.eventManager = new EventManager(this);
    this.backlight = new BacklightUI(hotInstance);
    this.guideline = new GuidelineUI(hotInstance);
  }

  /**
   * Checks if the plugin is enabled in the FreeGrid settings. This method is executed in {@link Hooks#beforeInit}
   * hook and if it returns `true` than the {@link ManualRowMove#enablePlugin} method is called.
   */
  isEnabled(): boolean {
    return !!this.hot.getSettings().manualRowMove;
  }

  /**
   * Enables the plugin functionality for this FreeGrid instance.
   */
  enablePlugin(): void {
    if (this.enabled) {
      return;
    }

    this.addHook('beforeOnCellMouseDown', (event, coords, TD, blockCalculations) => this.onBeforeOnCellMouseDown(event, coords, TD, blockCalculations));
    this.addHook('beforeOnCellMouseOver', (event, coords, TD, blockCalculations) => this.onBeforeOnCellMouseOver(event, coords, TD, blockCalculations));
    this.addHook('afterScrollHorizontally', () => this.onAfterScrollHorizontally());
    this.addHook('modifyRow', (row, source) => this.onModifyRow(row, source));
    this.addHook('beforeRemoveRow', (index, amount) => this.onBeforeRemoveRow(index, amount));
    this.addHook('afterRemoveRow', () => this.onAfterRemoveRow());
    this.addHook('afterCreateRow', (index, amount) => this.onAfterCreateRow(index, amount));
    this.addHook('afterLoadData', () => this.onAfterLoadData());
    this.addHook('beforeColumnSort', (column, order) => this.onBeforeColumnSort(column, order));
    this.addHook('unmodifyRow', row => this.onUnmodifyRow(row));

    this.registerEvents();

    addClass(this.hot.rootElement, CSS_PLUGIN);

    super.enablePlugin();
  }

  /**
   * Updates the plugin state. This method is executed when {@link Core#updateSettings} is invoked.
   */
  updatePlugin(): void {
    this.disablePlugin();
    this.enablePlugin();

    this.onAfterPluginsInitialized();

    super.updatePlugin();
  }

  /**
   * Disables the plugin functionality for this FreeGrid instance.
   */
  disablePlugin(): void {
    const pluginSettings = this.hot.getSettings().manualRowMove;

    if (Array.isArray(pluginSettings)) {
      this.rowsMapper.clearMap();
    }

    removeClass(this.hot.rootElement, CSS_PLUGIN);

    this.unregisterEvents();
    this.backlight.destroy();
    this.guideline.destroy();

    super.disablePlugin();
  }

  /**
   * Moves a single row.
   *
   * @param row Visual row index to be moved.
   * @param target Visual row index being a target for the moved row.
   * @fires Hooks#beforeRowMove
   * @fires Hooks#afterRowMove
   */
  moveRow(row: number, target: number): void {
    this.moveRows([row], target);
  }

  /**
   * Moves a multiple rows.
   *
   * @param rows Array of visual row indexes to be moved.
   * @param target Visual row index being a target for the moved rows.
   * @fires Hooks#beforeRowMove
   * @fires Hooks#afterRowMove
   */
  moveRows(rows: number[], target: number): void {
    const visualRows = [...rows];
    const priv = this.#priv;
    const beforeMoveHook = this.hot.runHooks('beforeRowMove', visualRows, target);

    priv.disallowMoving = beforeMoveHook === false;

    if (!priv.disallowMoving) {
      // first we need to rewrite an visual indexes to physical for save reference after move
      rows.forEach((row, index, array) => {
        array[index] = this.rowsMapper.getValueByIndex(row)!;
      });

      // next, when we have got an physical indexes, we can move rows
      rows.forEach((row, index) => {
        const actualPosition = this.rowsMapper.getIndexByValue(row)!;

        if (actualPosition !== target) {
          this.rowsMapper.moveRow(actualPosition, target + index);
        }
      });

      // after moving we have to clear rowsMapper from null entries
      this.rowsMapper.clearNull();
    }

    this.hot.runHooks('afterRowMove', visualRows, target);
  }

  /**
   * Correct the cell selection after the move action. Fired only when action was made with a mouse.
   * That means that changing the row order using the API won't correct the selection.
   *
   * @private
   * @param startRow Visual row index for the start of the selection.
   * @param endRow Visual row index for the end of the selection.
   */
  changeSelection(startRow: number, endRow: number): void {
    this.hot.selectRows(startRow, endRow);
  }

  /**
   * Gets the sum of the heights of rows in the provided range.
   *
   * @private
   * @param from Visual row index.
   * @param to Visual row index.
   */
  getRowsHeight(from: number, to: number): number {
    let height = 0;

    for (let i = from; i < to; i++) {
      const rowHeight = this.hot.view.wt.wtTable.getRowHeight(i) || this.hot.view.wt.wtSettings.settings.defaultRowHeight;

      height += rowHeight;
    }

    return height;
  }

  /**
   * Loads initial settings when persistent state is saved or when plugin was initialized as an array.
   *
   * @private
   */
  initialSettings(): void {
    const pluginSettings = this.hot.getSettings().manualRowMove;

    if (Array.isArray(pluginSettings)) {
      this.moveRows(pluginSettings, 0);

    } else if (pluginSettings !== undefined) {
      const persistentState = this.persistentStateLoad();

      if (persistentState.length) {
        this.moveRows(persistentState, 0);
      }
    }
  }

  /**
   * Checks if the provided row is in the fixedRowsTop section.
   *
   * @private
   * @param row Visual row index to check.
   */
  isFixedRowTop(row: number): boolean {
    return row < this.hot.getSettings().fixedRowsTop;
  }

  /**
   * Checks if the provided row is in the fixedRowsBottom section.
   *
   * @private
   * @param row Visual row index to check.
   */
  isFixedRowBottom(row: number): boolean {
    return row > this.hot.getSettings().fixedRowsBottom;
  }

  /**
   * Saves the manual row positions to the persistent state (the {@link Options#persistentState} option has to be enabled).
   *
   * @fires Hooks#persistentStateSave
   * @fires Hooks#manualRowMove
   */
  persistentStateSave(): void {
    this.hot.runHooks('persistentStateSave', 'manualRowMove', this.rowsMapper._arrayMap);
  }

  /**
   * Loads the manual row positions from the persistent state (the {@link Options#persistentState} option has to be enabled).
   *
   * @returns Stored state.
   *
   * @fires Hooks#persistentStateLoad
   * @fires Hooks#manualRowMove
   */
  persistentStateLoad(): number[] {
    const storedState: { value?: number[] } = {};

    this.hot.runHooks('persistentStateLoad', 'manualRowMove', storedState);

    return storedState.value ? storedState.value : [];
  }

  /**
   * Prepare array of indexes based on actual selection.
   *
   * @private
   */
  prepareRowsToMoving(): number[] {
    const selection = this.hot.getSelectedRangeLast();
    const selectedRows: number[] = [];

    if (!selection) {
      return selectedRows;
    }

    const { from, to } = selection;
    const start = Math.min(from.row, to.row);
    const end = Math.max(from.row, to.row);

    rangeEach(start, end, (i) => {
      selectedRows.push(i);
    });

    return selectedRows;
  }

  /**
   * Update the UI visual position.
   *
   * @private
   */
  refreshPositions(): void {
    // Set by mousedown and mouseover before this runs.
    const priv = this.#priv as Required<MoveState> & { target: Required<MoveState['target']> };
    const coords = priv.target.coords;
    const firstVisible = this.hot.view.wt.wtTable.getFirstVisibleRow();
    const lastVisible = this.hot.view.wt.wtTable.getLastVisibleRow();
    const fixedRows = this.hot.getSettings().fixedRowsTop;
    const countRows = this.hot.countRows();

    if (coords.row < fixedRows && firstVisible > 0) {
      this.hot.scrollViewportTo(firstVisible - 1);
    }
    if (coords.row >= lastVisible && lastVisible < countRows) {
      this.hot.scrollViewportTo(lastVisible + 1, undefined, true);
    }

    const wtTable = this.hot.view.wt.wtTable;
    const TD = priv.target.TD;
    const rootElementOffset = offset(this.hot.rootElement);
    let tdOffsetTop = this.hot.view.THEAD.offsetHeight + this.getRowsHeight(0, coords.row);
    const mouseOffsetTop = priv.target.eventPageY - rootElementOffset.top + wtTable.holder.scrollTop;
    const hiderHeight = wtTable.hider.offsetHeight;
    const tbodyOffsetTop = wtTable.TBODY.offsetTop;
    const backlightElemMarginTop = this.backlight.getOffset().top;
    const backlightElemHeight = this.backlight.getSize().height;

    if (this.isFixedRowTop(coords.row)) {
      tdOffsetTop += wtTable.holder.scrollTop;
    }

    // todo: fixedRowsBottom
    // if (this.isFixedRowBottom(coords.row)) {
    //
    // }

    if (coords.row < 0) {
      // if hover on colHeader
      priv.target.row = firstVisible > 0 ? firstVisible - 1 : firstVisible;
    } else if ((TD.offsetHeight / 2) + tdOffsetTop <= mouseOffsetTop) {
      // if hover on lower part of TD
      priv.target.row = coords.row + 1;
      // unfortunately first row is bigger than rest
      tdOffsetTop += coords.row === 0 ? TD.offsetHeight - 1 : TD.offsetHeight;

    } else {
      // elsewhere on table
      priv.target.row = coords.row;
    }

    let backlightTop = mouseOffsetTop;
    let guidelineTop = tdOffsetTop;

    if (mouseOffsetTop + backlightElemHeight + backlightElemMarginTop >= hiderHeight) {
      // prevent display backlight below table
      backlightTop = hiderHeight - backlightElemHeight - backlightElemMarginTop;

    } else if (mouseOffsetTop + backlightElemMarginTop < tbodyOffsetTop) {
      // prevent display above below table
      backlightTop = tbodyOffsetTop + Math.abs(backlightElemMarginTop);
    }

    if (tdOffsetTop >= hiderHeight - 1) {
      // prevent display guideline below table
      guidelineTop = hiderHeight - 1;
    }

    let topOverlayHeight = 0;
    if (this.hot.view.wt.wtOverlays.topOverlay) {
      topOverlayHeight = this.hot.view.wt.wtOverlays.topOverlay.clone.wtTable.TABLE.offsetHeight;
    }

    if (coords.row >= fixedRows && (guidelineTop - wtTable.holder.scrollTop) < topOverlayHeight) {
      this.hot.scrollViewportTo(coords.row);
    }

    this.backlight.setPosition(backlightTop);
    this.guideline.setPosition(guidelineTop);
  }

  /**
   * This method checks arrayMap from rowsMapper and updates the rowsMapper if it's necessary.
   *
   * @private
   */
  updateRowsMapper(): void {
    const countRows = this.hot.countSourceRows();
    const rowsMapperLen = this.rowsMapper._arrayMap.length;

    if (rowsMapperLen === 0) {
      this.rowsMapper.createMap(countRows || this.hot.getSettings().startRows);

    } else if (rowsMapperLen < countRows) {
      const diff = countRows - rowsMapperLen;

      this.rowsMapper.insertItems(rowsMapperLen, diff);

    } else if (rowsMapperLen > countRows) {
      const maxIndex = countRows - 1;
      const rowsToRemove: number[] = [];

      this.rowsMapper._arrayMap.forEach((value, index) => {
        if (value > maxIndex) {
          rowsToRemove.push(index);
        }
      });

      this.rowsMapper.removeItems(rowsToRemove);
    }
  }

  /**
   * Binds the events used by the plugin.
   *
   * @private
   */
  registerEvents(): void {
    this.eventManager.addEventListener(document.documentElement, 'mousemove', (event: MouseEvent) => this.onMouseMove(event));
    this.eventManager.addEventListener(document.documentElement, 'mouseup', () => this.onMouseUp());
  }

  /**
   * Unbinds the events used by the plugin.
   *
   * @private
   */
  unregisterEvents(): void {
    this.eventManager.clear();
  }

  /**
   * `beforeColumnSort` hook callback. If user uses the sorting, manual row moving is disabled.
   *
   * @private
   * @param column Column index where soring is present
   * @param order State of sorting. ASC/DESC/None
   */
  onBeforeColumnSort(column: number, order: unknown): void {
    const priv = this.#priv;

    priv.disallowMoving = order !== undefined;
  }

  /**
   * Changes the behavior of selection / dragging.
   *
   * @private
   * @param event
   * @param coords Visual coordinates.
   * @param TD
   * @param blockCalculations
   */
  onBeforeOnCellMouseDown(event: GridMouseEvent, coords: CellCoords, TD: HTMLTableCellElement,
    blockCalculations: BlockCalculations): void {
    const wtTable = this.hot.view.wt.wtTable;
    const isHeaderSelection = this.hot.selection.isSelectedByRowHeader();
    const selection = this.hot.getSelectedRangeLast();
    const priv = this.#priv;

    if (!selection || !isHeaderSelection || priv.pressed || event.button !== 0) {
      priv.pressed = false;
      priv.rowsToMove.length = 0;
      removeClass(this.hot.rootElement, [CSS_ON_MOVING, CSS_SHOW_UI]);
      return;
    }

    const guidelineIsNotReady = this.guideline.isBuilt() && !this.guideline.isAppended();
    const backlightIsNotReady = this.backlight.isBuilt() && !this.backlight.isAppended();

    if (guidelineIsNotReady && backlightIsNotReady) {
      this.guideline.appendTo(wtTable.hider);
      this.backlight.appendTo(wtTable.hider);
    }

    const { from, to } = selection;
    const start = Math.min(from.row, to.row);
    const end = Math.max(from.row, to.row);

    if (coords.col < 0 && (coords.row >= start && coords.row <= end)) {
      blockCalculations.row = true;
      priv.pressed = true;
      priv.target.eventPageY = event.pageY;
      priv.target.coords = coords;
      priv.target.TD = TD;
      priv.rowsToMove = this.prepareRowsToMoving();

      const leftPos = wtTable.holder.scrollLeft + this.hot.view.wt.wtViewport.getRowHeaderWidth();

      this.backlight.setPosition(undefined, leftPos);
      this.backlight.setSize(wtTable.hider.offsetWidth - leftPos, this.getRowsHeight(start, end + 1));
      this.backlight.setOffset((this.getRowsHeight(start, coords.row) + event.layerY) * -1, undefined);

      addClass(this.hot.rootElement, CSS_ON_MOVING);

      this.refreshPositions();

    } else {
      removeClass(this.hot.rootElement, CSS_AFTER_SELECTION);
      priv.pressed = false;
      priv.rowsToMove.length = 0;
    }
  }

  /**
   * 'mouseMove' event callback. Fired when pointer move on document.documentElement.
   *
   * @private
   * @param event `mousemove` event properties.
   */
  onMouseMove(event: MouseEvent): void {
    const priv = this.#priv;

    if (!priv.pressed) {
      return;
    }


    priv.target.eventPageY = event.pageY;
    this.refreshPositions();
  }

  /**
   * 'beforeOnCellMouseOver' hook callback. Fired when pointer was over cell.
   *
   * @private
   * @param event `mouseover` event properties.
   * @param coords Visual cell coordinates where was fired event.
   * @param TD Cell represented as HTMLElement.
   * @param blockCalculations Object which contains information about blockCalculation for row, column or cells.
   */
  onBeforeOnCellMouseOver(event: GridMouseEvent, coords: CellCoords, TD: HTMLTableCellElement,
    blockCalculations: BlockCalculations): void {
    const selectedRange = this.hot.getSelectedRangeLast();
    const priv = this.#priv;

    if (!selectedRange || !priv.pressed) {
      return;
    }

    if (priv.rowsToMove.indexOf(coords.row) > -1) {
      removeClass(this.hot.rootElement, CSS_SHOW_UI);

    } else {
      addClass(this.hot.rootElement, CSS_SHOW_UI);
    }

    blockCalculations.row = true;
    blockCalculations.column = true;
    blockCalculations.cell = true;
    priv.target.coords = coords;
    priv.target.TD = TD;
  }

  /**
   * `onMouseUp` hook callback.
   *
   * @private
   */
  onMouseUp(): void {
    const priv = this.#priv;
    const target = priv.target.row;
    const rowsLen = priv.rowsToMove.length;

    priv.pressed = false;
    priv.backlightHeight = 0;

    removeClass(this.hot.rootElement, [CSS_ON_MOVING, CSS_SHOW_UI, CSS_AFTER_SELECTION]);

    if (this.hot.selection.isSelectedByRowHeader()) {
      addClass(this.hot.rootElement, CSS_AFTER_SELECTION);
    }

    if (rowsLen < 1 || target === undefined || priv.rowsToMove.indexOf(target) > -1 ||
        (priv.rowsToMove[rowsLen - 1] === target - 1)) {
      return;
    }

    this.moveRows(priv.rowsToMove, target);

    this.persistentStateSave();
    this.hot.render();

    if (!priv.disallowMoving) {
      const selectionStart = this.rowsMapper.getIndexByValue(priv.rowsToMove[0])!;
      const selectionEnd = this.rowsMapper.getIndexByValue(priv.rowsToMove[rowsLen - 1])!;
      this.changeSelection(selectionStart, selectionEnd);
    }

    priv.rowsToMove.length = 0;
  }

  /**
   * `afterScrollHorizontally` hook callback. Fired the table was scrolled horizontally.
   *
   * @private
   */
  onAfterScrollHorizontally(): void {
    const wtTable = this.hot.view.wt.wtTable;
    const headerWidth = this.hot.view.wt.wtViewport.getRowHeaderWidth();
    const scrollLeft = wtTable.holder.scrollLeft;
    const posLeft = headerWidth + scrollLeft;

    this.backlight.setPosition(undefined, posLeft);
    this.backlight.setSize(wtTable.hider.offsetWidth - posLeft);
  }

  /**
   * `afterCreateRow` hook callback.
   *
   * @private
   * @param index Visual index of the created row.
   * @param amount Amount of created rows.
   */
  onAfterCreateRow(index: number, amount: number): void {
    this.rowsMapper.shiftItems(index, amount);
  }

  /**
   * On before remove row listener.
   *
   * @private
   * @param index Visual row index.
   * @param amount Defines how many rows removed.
   */
  onBeforeRemoveRow(index: number | false, amount: number): void {
    this.removedRows.length = 0;

    if (index !== false) {
      // Collect physical row index.
      rangeEach(index, index + amount - 1, (removedIndex) => {
        this.removedRows.push(this.hot.runHooks('modifyRow', removedIndex, this.pluginName));
      });
    }
  }

  /**
   * `afterRemoveRow` hook callback.
   *
   * @private
   */
  onAfterRemoveRow(): void {
    this.rowsMapper.unshiftItems(this.removedRows);
  }

  /**
   * `afterLoadData` hook callback.
   *
   * @private
   */
  onAfterLoadData(): void {
    // New data (not the first load, after which the plugin applies its settings itself): the order a user made goes,
    // and the order from the settings (an array, or a saved state) applies again.
    if (this.hot.view) {
      this.rowsMapper.clearMap();
    }
    this.updateRowsMapper();

    if (this.hot.view) {
      this.initialSettings();
    }
  }

  /**
   * 'modifyRow' hook callback.
   *
   * @private
   * @param row Visual Row index.
   * @returns Physical row index.
   */
  onModifyRow(row: number, source?: string): number {
    let physicalRow = row;

    if (source !== this.pluginName) {
      const rowInMapper = this.rowsMapper.getValueByIndex(physicalRow);
      physicalRow = rowInMapper === null ? physicalRow : rowInMapper;
    }

    return physicalRow;
  }

  /**
   * 'unmodifyRow' hook callback.
   *
   * @private
   * @param row Physical row index.
   * @returns Visual row index.
   */
  onUnmodifyRow(row: number): number {
    const indexInMapper = this.rowsMapper.getIndexByValue(row)!;

    return indexInMapper === null ? row : indexInMapper;
  }

  /**
   * `afterPluginsInitialized` hook callback.
   *
   * @private
   */
  onAfterPluginsInitialized(): void {
    this.updateRowsMapper();
    this.initialSettings();
    this.backlight.build();
    this.guideline.build();
  }

  /**
   * Destroys the plugin instance.
   */
  destroy(): void {
    this.backlight.destroy();
    this.guideline.destroy();
    this.rowsMapper.destroy();

    super.destroy();
  }
}

registerPlugin('ManualRowMove', ManualRowMove);

export default ManualRowMove;
