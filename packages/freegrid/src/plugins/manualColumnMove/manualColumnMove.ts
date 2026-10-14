import BasePlugin from './../_base';
import type { PluginHost } from './../_base';
import Hooks from './../../pluginHooks';
import { addClass, removeClass, offset } from './../../helpers/dom/element';
import { rangeEach } from './../../helpers/number';
import EventManager from './../../eventManager';
import { registerPlugin } from './../../plugins';
import ColumnsMapper from './columnsMapper';
import BacklightUI from './ui/backlight';
import GuidelineUI from './ui/guideline';
import type { CellCoords } from './../../3rdparty/walkontable/src';

import './manualColumnMove.css';

Hooks.getSingleton().register('beforeColumnMove');
Hooks.getSingleton().register('afterColumnMove');
Hooks.getSingleton().register('unmodifyCol');

/** The state of a drag of column headers. */
type MoveState = {
  columnsToMove: number[];
  countCols: number;
  fixedColumns: number;
  pressed?: boolean;
  disallowMoving?: boolean;
  coordsColumn?: number;
  hasRowHeaders?: boolean;
  rootElementOffset?: number;
  backlightWidth?: number;
  target: { eventPageX?: number; coords?: CellCoords; TD?: HTMLTableCellElement; col?: number };
  [key: string]: unknown;
};

/** Which selection changes a mouse action may make (set by hook listeners). */
type BlockCalculations = { row?: boolean; column?: boolean; cell?: boolean };

/** A mouse event, with the cell or header it happened on (set by EventManager). */
type GridMouseEvent = MouseEvent & { realTarget: HTMLElement; layerX: number; layerY: number };
const CSS_PLUGIN = 'fg-manual-column-move';
const CSS_SHOW_UI = 'show-ui';
const CSS_ON_MOVING = 'on-moving--columns';
const CSS_AFTER_SELECTION = 'after-selection--columns';

/**
 * @plugin ManualColumnMove
 *
 * @description
 * This plugin allows to change columns order. To make columns order persistent the {@link Options#persistentState}
 * plugin should be enabled.
 *
 * API:
 * - moveColumn - move single column to the new position.
 * - moveColumns - move many columns (as an array of indexes) to the new position.
 *
 * If you want apply visual changes, you have to call manually the render() method on the instance of FreeSheet.
 *
 * The plugin creates additional components to make moving possibly using user interface:
 * - backlight - highlight of selected columns.
 * - guideline - line which shows where rows has been moved.
 *
 * @class ManualColumnMove
 * @plugin ManualColumnMove
 */
class ManualColumnMove extends BasePlugin {
  /**
   * List of last removed column indexes.
   *
   * @private
   */
  removedColumns: number[] = [];

  /**
   * Object containing visual column indexes mapped to data source indexes.
   *
   * @private
   */
  columnsMapper: ColumnsMapper;

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
    columnsToMove: [],
    countCols: 0,
    fixedColumns: 0,
    pressed: undefined,
    disallowMoving: undefined,
    target: {
      eventPageX: undefined,
      coords: undefined,
      TD: undefined,
      col: undefined
    }
  };

  constructor(hotInstance: PluginHost) {
    super(hotInstance);
    this.columnsMapper = new ColumnsMapper(this);
    this.eventManager = new EventManager(this);
    this.backlight = new BacklightUI(hotInstance);
    this.guideline = new GuidelineUI(hotInstance);
  }

  /**
   * Checks if the plugin is enabled in the FreeSheet settings. This method is executed in {@link Hooks#beforeInit}
   * hook and if it returns `true` than the {@link ManualColumnMove#enablePlugin} method is called.
   */
  isEnabled(): boolean {
    const { manualColumnMove, manualColumnFreeze } = this.hot.getSettings();

    // Freezing a column moves it, so manualColumnFreeze turns this plugin on too (see ManualColumnFreeze#onAfterInit);
    // without this, updateSettings would turn it off and the frozen columns would lose their place.
    return !!manualColumnMove || !!manualColumnFreeze;
  }

  /**
   * Enables the plugin functionality for this FreeSheet instance.
   */
  enablePlugin(): void {
    if (this.enabled) {
      return;
    }

    this.addHook('beforeOnCellMouseDown', (event, coords, TD, blockCalculations) => this.onBeforeOnCellMouseDown(event, coords, TD, blockCalculations));
    this.addHook('beforeOnCellMouseOver', (event, coords, TD, blockCalculations) => this.onBeforeOnCellMouseOver(event, coords, TD, blockCalculations));
    this.addHook('afterScrollVertically', () => this.onAfterScrollVertically());
    this.addHook('modifyCol', (row, source) => this.onModifyCol(row, source));
    this.addHook('beforeRemoveCol', (index, amount) => this.onBeforeRemoveCol(index, amount));
    this.addHook('afterRemoveCol', () => this.onAfterRemoveCol());
    this.addHook('afterCreateCol', (index, amount) => this.onAfterCreateCol(index, amount));
    this.addHook('afterLoadData', () => this.onAfterLoadData());
    this.addHook('unmodifyCol', column => this.onUnmodifyCol(column));

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
   * Disables the plugin functionality for this FreeSheet instance.
   */
  disablePlugin(): void {
    const pluginSettings = this.hot.getSettings().manualColumnMove;

    if (Array.isArray(pluginSettings)) {
      this.columnsMapper.clearMap();
    }

    removeClass(this.hot.rootElement, CSS_PLUGIN);

    this.unregisterEvents();
    this.backlight.destroy();
    this.guideline.destroy();

    super.disablePlugin();
  }

  /**
   * Moves a single column.
   *
   * @param column Visual column index to be moved.
   * @param target Visual column index being a target for the moved column.
   * @fires Hooks#beforeColumnMove
   * @fires Hooks#afterColumnMove
   */
  moveColumn(column: number, target: number): void {
    this.moveColumns([column], target);
  }

  /**
   * Moves a multiple columns.
   *
   * @param columns Array of visual column indexes to be moved.
   * @param target Visual column index being a target for the moved columns.
   * @fires Hooks#beforeColumnMove
   * @fires Hooks#afterColumnMove
   */
  moveColumns(columns: number[], target: number): void {
    const visualColumns = [...columns];
    const priv = this.#priv;
    const beforeColumnHook = this.hot.runHooks('beforeColumnMove', visualColumns, target);

    priv.disallowMoving = !beforeColumnHook;

    if (beforeColumnHook !== false) {
      // first we need to rewrite an visual indexes to physical for save reference after move
      columns.forEach((column, index, array) => {
        array[index] = this.columnsMapper.getValueByIndex(column)!;
      });

      // next, when we have got an physical indexes, we can move columns
      columns.forEach((column, index) => {
        const actualPosition = this.columnsMapper.getIndexByValue(column)!;

        if (actualPosition !== target) {
          this.columnsMapper.moveColumn(actualPosition, target + index);
        }
      });

      // after moving we have to clear columnsMapper from null entries
      this.columnsMapper.clearNull();
    }

    this.hot.runHooks('afterColumnMove', visualColumns, target);
  }

  /**
   * Correct the cell selection after the move action. Fired only when action was made with a mouse.
   * That means that changing the column order using the API won't correct the selection.
   *
   * @private
   * @param startColumn Visual column index for the start of the selection.
   * @param endColumn Visual column index for the end of the selection.
   */
  changeSelection(startColumn: number, endColumn: number): void {
    this.hot.selectColumns(startColumn, endColumn);
  }

  /**
   * Gets the sum of the widths of columns in the provided range.
   *
   * @private
   * @param from Visual column index.
   * @param to Visual column index.
   */
  getColumnsWidth(from: number, to: number): number {
    let width = 0;

    for (let i = from; i < to; i++) {
      let columnWidth: number;

      if (i < 0) {
        columnWidth = this.hot.view.wt.wtViewport.getRowHeaderWidth() || 0;
      } else {
        columnWidth = this.hot.view.wt.wtTable.getStretchedColumnWidth(i) || 0;
      }

      width += columnWidth;
    }

    return width;
  }

  /**
   * Loads initial settings when persistent state is saved or when plugin was initialized as an array.
   *
   * @private
   */
  initialSettings(): void {
    const pluginSettings = this.hot.getSettings().manualColumnMove;

    if (Array.isArray(pluginSettings)) {
      this.moveColumns(pluginSettings, 0);

    } else if (pluginSettings !== undefined) {
      this.persistentStateLoad();
    }
  }

  /**
   * Checks if the provided column is in the fixedColumnsLeft section.
   *
   * @private
   * @param column Visual column index to check.
   */
  isFixedColumnsLeft(column: number): boolean {
    return column < this.hot.getSettings().fixedColumnsLeft;
  }

  /**
   * Saves the manual column positions to the persistent state (the {@link Options#persistentState} option has to be enabled).
   */
  persistentStateSave(): void {
    this.hot.runHooks('persistentStateSave', 'manualColumnMove', this.columnsMapper._arrayMap);
  }

  /**
   * Loads the manual column positions from the persistent state (the {@link Options#persistentState} option has to be enabled).
   */
  persistentStateLoad(): void {
    const storedState: { value?: number[] } = {};

    this.hot.runHooks('persistentStateLoad', 'manualColumnMove', storedState);

    if (storedState.value) {
      this.columnsMapper._arrayMap = storedState.value;
    }
  }

  /**
   * Prepares an array of indexes based on actual selection.
   *
   * @private
   */
  prepareColumnsToMoving(start: number, end: number): number[] {
    const selectedColumns: number[] = [];

    rangeEach(start, end, (i) => {
      selectedColumns.push(i);
    });

    return selectedColumns;
  }

  /**
   * Updates the UI visual position.
   *
   * @private
   */
  refreshPositions(): void {
    // Set by mousedown and mouseover before this runs.
    const priv = this.#priv as Required<MoveState> & { target: Required<MoveState['target']> };
    const firstVisible = this.hot.view.wt.wtTable.getFirstVisibleColumn();
    const lastVisible = this.hot.view.wt.wtTable.getLastVisibleColumn();
    const wtTable = this.hot.view.wt.wtTable;
    const scrollableElement = this.hot.view.wt.wtOverlays.scrollableElement;
    const scrollLeft = typeof (scrollableElement as Window).scrollX === 'number' ? (scrollableElement as Window).scrollX : (scrollableElement as HTMLElement).scrollLeft;
    let tdOffsetLeft = this.hot.view.THEAD.offsetLeft + this.getColumnsWidth(0, priv.coordsColumn);
    const mouseOffsetLeft = priv.target.eventPageX - (priv.rootElementOffset - ((scrollableElement as Window).scrollX === undefined ? scrollLeft : 0));
    const hiderWidth = wtTable.hider.offsetWidth;
    const tbodyOffsetLeft = wtTable.TBODY.offsetLeft;
    const backlightElemMarginLeft = this.backlight.getOffset().left;
    const backlightElemWidth = this.backlight.getSize().width;
    let rowHeaderWidth = 0;

    if ((priv.rootElementOffset + wtTable.holder.offsetWidth + scrollLeft) < priv.target.eventPageX) {
      if (priv.coordsColumn < priv.countCols) {
        priv.coordsColumn += 1;
      }
    }

    if (priv.hasRowHeaders) {
      rowHeaderWidth = this.hot.view.wt.wtOverlays.leftOverlay.clone.wtTable.getColumnHeader(-1)!.offsetWidth;
    }
    if (this.isFixedColumnsLeft(priv.coordsColumn)) {
      tdOffsetLeft += scrollLeft;
    }
    tdOffsetLeft += rowHeaderWidth;

    if (priv.coordsColumn < 0) {
      // if hover on rowHeader
      if (priv.fixedColumns > 0) {
        priv.target.col = 0;
      } else {
        priv.target.col = firstVisible > 0 ? firstVisible - 1 : firstVisible;
      }

    } else if (((priv.target.TD.offsetWidth / 2) + tdOffsetLeft) <= mouseOffsetLeft) {
      const newCoordsCol = priv.coordsColumn >= priv.countCols ? priv.countCols - 1 : priv.coordsColumn;
      // if hover on right part of TD
      priv.target.col = newCoordsCol + 1;
      // unfortunately first column is bigger than rest
      tdOffsetLeft += priv.target.TD.offsetWidth;

      if (priv.target.col > lastVisible && lastVisible < priv.countCols) {
        this.hot.scrollViewportTo(undefined, lastVisible + 1, undefined, true);
      }

    } else {
      // elsewhere on table
      priv.target.col = priv.coordsColumn;

      if (priv.target.col <= firstVisible && priv.target.col >= priv.fixedColumns && firstVisible > 0) {
        this.hot.scrollViewportTo(undefined, firstVisible - 1);
      }
    }

    if (priv.target.col <= firstVisible && priv.target.col >= priv.fixedColumns && firstVisible > 0) {
      this.hot.scrollViewportTo(undefined, firstVisible - 1);
    }

    let backlightLeft = mouseOffsetLeft;
    let guidelineLeft = tdOffsetLeft;

    if (mouseOffsetLeft + backlightElemWidth + backlightElemMarginLeft >= hiderWidth) {
      // prevent display backlight on the right side of the table
      backlightLeft = hiderWidth - backlightElemWidth - backlightElemMarginLeft;

    } else if (mouseOffsetLeft + backlightElemMarginLeft < tbodyOffsetLeft + rowHeaderWidth) {
      // prevent display backlight on the left side of the table
      backlightLeft = tbodyOffsetLeft + rowHeaderWidth + Math.abs(backlightElemMarginLeft);
    }

    if (tdOffsetLeft >= hiderWidth - 1) {
      // prevent display guideline outside the table
      guidelineLeft = hiderWidth - 1;

    } else if (guidelineLeft === 0) {
      // guideline has got `margin-left: -1px` as default
      guidelineLeft = 1;

    } else if ((scrollableElement as Window).scrollX !== undefined && priv.coordsColumn < priv.fixedColumns) {
      guidelineLeft -= ((priv.rootElementOffset <= (scrollableElement as Window).scrollX) ? priv.rootElementOffset : 0);
    }

    this.backlight.setPosition(undefined, backlightLeft);
    this.guideline.setPosition(undefined, guidelineLeft);
  }

  /**
   * This method checks arrayMap from columnsMapper and updates the columnsMapper if it's necessary.
   *
   * @private
   */
  updateColumnsMapper(): void {
    const countCols = this.hot.countSourceCols();
    const columnsMapperLen = this.columnsMapper._arrayMap.length;

    if (columnsMapperLen === 0) {
      this.columnsMapper.createMap(countCols || this.hot.getSettings().startCols);

    } else if (columnsMapperLen < countCols) {
      const diff = countCols - columnsMapperLen;

      this.columnsMapper.insertItems(columnsMapperLen, diff);

    } else if (columnsMapperLen > countCols) {
      const maxIndex = countCols - 1;
      const columnsToRemove: number[] = [];

      this.columnsMapper._arrayMap.forEach((value, index) => {
        if (value > maxIndex) {
          columnsToRemove.push(index);
        }
      });

      this.columnsMapper.removeItems(columnsToRemove);
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
   * Changes the behavior of selection / dragging.
   *
   * @private
   * @param event `mousedown` event properties.
   * @param coords Visual cell coordinates where was fired event.
   * @param TD Cell represented as HTMLElement.
   * @param blockCalculations Object which contains information about blockCalculation for row, column or cells.
   */
  onBeforeOnCellMouseDown(event: GridMouseEvent, coords: CellCoords, TD: HTMLTableCellElement,
    blockCalculations: BlockCalculations): void {
    const wtTable = this.hot.view.wt.wtTable;
    const isHeaderSelection = this.hot.selection.isSelectedByColumnHeader();
    const selection = this.hot.getSelectedRangeLast();
    const priv = this.#priv;
    // This block action shouldn't be handled below.
    const isSortingElement = event.realTarget.className.indexOf('sortAction') > -1;

    if (!selection || !isHeaderSelection || priv.pressed || event.button !== 0 || isSortingElement) {
      priv.pressed = false;
      priv.columnsToMove.length = 0;
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
    const start = Math.min(from.col, to.col);
    const end = Math.max(from.col, to.col);

    if (coords.row < 0 && (coords.col >= start && coords.col <= end)) {
      blockCalculations.column = true;
      priv.pressed = true;
      priv.target.eventPageX = event.pageX;
      priv.coordsColumn = coords.col;
      priv.target.TD = TD;
      priv.target.col = coords.col;
      priv.columnsToMove = this.prepareColumnsToMoving(start, end);
      priv.hasRowHeaders = !!this.hot.getSettings().rowHeaders;
      priv.countCols = this.hot.countCols();
      priv.fixedColumns = this.hot.getSettings().fixedColumnsLeft;
      priv.rootElementOffset = offset(this.hot.rootElement).left;

      const countColumnsFrom = priv.hasRowHeaders ? -1 : 0;
      const topPos = wtTable.holder.scrollTop + wtTable.getColumnHeaderHeight(0) + 1;
      const fixedColumns = coords.col < priv.fixedColumns;
      const scrollableElement = this.hot.view.wt.wtOverlays.scrollableElement;
      const wrapperIsWindow = (scrollableElement as Window).scrollX ? (scrollableElement as Window).scrollX - priv.rootElementOffset : 0;

      const mouseOffset = event.layerX - (fixedColumns ? wrapperIsWindow : 0);
      const leftOffset = Math.abs(this.getColumnsWidth(start, coords.col) + mouseOffset);

      this.backlight.setPosition(topPos, this.getColumnsWidth(countColumnsFrom, start) + leftOffset);
      this.backlight.setSize(this.getColumnsWidth(start, end + 1), wtTable.hider.offsetHeight - topPos);
      this.backlight.setOffset(undefined, leftOffset * -1);

      addClass(this.hot.rootElement, CSS_ON_MOVING);

    } else {
      removeClass(this.hot.rootElement, CSS_AFTER_SELECTION);
      priv.pressed = false;
      priv.columnsToMove.length = 0;
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


    priv.target.eventPageX = event.pageX;
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

    if (priv.columnsToMove.indexOf(coords.col) > -1) {
      removeClass(this.hot.rootElement, CSS_SHOW_UI);

    } else {
      addClass(this.hot.rootElement, CSS_SHOW_UI);
    }

    blockCalculations.row = true;
    blockCalculations.column = true;
    blockCalculations.cell = true;
    priv.coordsColumn = coords.col;
    priv.target.TD = TD;
  }

  /**
   * `onMouseUp` hook callback.
   *
   * @private
   */
  onMouseUp(): void {
    const priv = this.#priv;

    priv.coordsColumn = undefined;
    priv.pressed = false;
    priv.backlightWidth = 0;

    removeClass(this.hot.rootElement, [CSS_ON_MOVING, CSS_SHOW_UI, CSS_AFTER_SELECTION]);

    if (this.hot.selection.isSelectedByColumnHeader()) {
      addClass(this.hot.rootElement, CSS_AFTER_SELECTION);
    }
    if (priv.columnsToMove.length < 1 || priv.target.col === undefined || priv.columnsToMove.indexOf(priv.target.col) > -1) {
      return;
    }

    this.moveColumns(priv.columnsToMove, priv.target.col);
    this.persistentStateSave();
    this.hot.render();
    this.hot.view.wt.wtOverlays.adjustElementsSize(true);

    if (!priv.disallowMoving) {
      const selectionStart = this.columnsMapper.getIndexByValue(priv.columnsToMove[0])!;
      const selectionEnd = this.columnsMapper.getIndexByValue(priv.columnsToMove[priv.columnsToMove.length - 1])!;
      this.changeSelection(selectionStart, selectionEnd);
    }

    priv.columnsToMove.length = 0;
  }

  /**
   * `afterScrollHorizontally` hook callback. Fired the table was scrolled horizontally.
   *
   * @private
   */
  onAfterScrollVertically(): void {
    const wtTable = this.hot.view.wt.wtTable;
    const headerHeight = wtTable.getColumnHeaderHeight(0) + 1;
    const scrollTop = wtTable.holder.scrollTop;
    const posTop = headerHeight + scrollTop;

    this.backlight.setPosition(posTop);
    this.backlight.setSize(undefined, wtTable.hider.offsetHeight - posTop);
  }

  /**
   * `afterCreateCol` hook callback.
   *
   * @private
   * @param index Visual index of the created column.
   * @param amount Amount of created columns.
   */
  onAfterCreateCol(index: number, amount: number): void {
    this.columnsMapper.shiftItems(index, amount);
  }

  /**
   * On before remove column listener.
   *
   * @private
   * @param index Visual column index.
   * @param amount Defines how many columns removed.
   */
  onBeforeRemoveCol(index: number | false, amount: number): void {
    this.removedColumns.length = 0;

    if (index !== false) {
      // Collect physical row index.
      rangeEach(index, index + amount - 1, (removedIndex) => {
        this.removedColumns.push(this.hot.runHooks('modifyCol', removedIndex, this.pluginName));
      });
    }
  }

  /**
   * `afterRemoveCol` hook callback.
   *
   * @private
   */
  onAfterRemoveCol(): void {
    this.columnsMapper.unshiftItems(this.removedColumns);
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
      this.columnsMapper.clearMap();
    }
    this.updateColumnsMapper();

    if (this.hot.view) {
      this.initialSettings();
    }
  }

  /**
   * 'modifyRow' hook callback.
   *
   * @private
   * @param column Visual column index.
   * @returns Physical column index.
   */
  onModifyCol(column: number, source?: string): number {
    let physicalColumn = column;

    if (source !== this.pluginName) {
      // ugly fix for try to insert new, needed columns after pasting data
      const columnInMapper = this.columnsMapper.getValueByIndex(physicalColumn);
      physicalColumn = columnInMapper === null ? physicalColumn : columnInMapper;
    }

    return physicalColumn;
  }

  /**
   * 'unmodifyCol' hook callback.
   *
   * @private
   * @param column Physical column index.
   * @returns Visual column index.
   */
  onUnmodifyCol(column: number): number {
    const indexInMapper = this.columnsMapper.getIndexByValue(column)!;

    return indexInMapper === null ? column : indexInMapper;
  }

  /**
   * `afterPluginsInitialized` hook callback.
   *
   * @private
   */
  onAfterPluginsInitialized(): void {
    this.updateColumnsMapper();
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

    super.destroy();
  }
}

registerPlugin('ManualColumnMove', ManualColumnMove);

export default ManualColumnMove;
