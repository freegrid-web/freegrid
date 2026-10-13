import Highlight, { AREA_TYPE, HEADER_TYPE, CELL_TYPE } from './highlight/highlight';
import SelectionRange from './range';
import { CellCoords } from './../3rdparty/walkontable/src';
import type { CellRange } from './../3rdparty/walkontable/src';
import { isPressedCtrlKey } from './../utils/keyStateObserver';
import { createObjectPropListener, mixin } from './../helpers/object';
import { isUndefined } from './../helpers/mixed';
import localHooks from './../mixins/localHooks';
import type { LocalHooks } from './../mixins/localHooks';
import Transformation from './transformation';
import {
  detectSelectionType,
  isValidCoord,
  normalizeSelectionFactory,
  SELECTION_TYPE_EMPTY,
  SELECTION_TYPE_UNRECOGNIZED,
} from './utils';
import type { SelectionInput } from './utils';
import { toSingleLine } from './../helpers/templateLiteralTag';

/** The grid settings Selection reads (the grid's live settings object). */
export type SelectionSettings = {
  selectionMode?: 'single' | 'range' | 'multiple';
  fillHandle?: unknown;
  disableVisualSelection?: boolean | string | string[];
  currentHeaderClassName?: string;
  activeHeaderClassName?: string;
  currentRowClassName?: string;
  currentColClassName?: string;
  fixedRowsBottom?: number;
  minSpareRows?: number;
  minSpareCols?: number;
  autoWrapRow?: boolean;
  autoWrapCol?: boolean;
};

/** The table state Selection asks for when it needs it. */
export type TableProps = {
  countRows(): number;
  countCols(): number;
  propToCol(prop: string): number;
  isEditorOpened(): boolean;
};

/**
 * The selection of a grid: its ranges (one per layer of a non-consecutive selection), how it was made (by headers,
 * by the corner), and its highlights. Local hooks tell the grid about every change.
 */
class Selection {
  // From the localHooks mixin (on the prototype): `declare` keeps class fields from hiding them.
  declare addLocalHook: LocalHooks['addLocalHook'];

  declare runLocalHooks: LocalHooks['runLocalHooks'];

  declare clearLocalHooks: LocalHooks['clearLocalHooks'];

  settings: SelectionSettings;

  tableProps: TableProps;

  inProgress: boolean;

  selectedByCorner: boolean;

  selectedByRowHeader: Set<number>;

  selectedByColumnHeader: Set<number>;

  selectedRange: SelectionRange;

  highlight: Highlight;

  transformation: Transformation;

  constructor(settings: SelectionSettings, tableProps: TableProps) {
    /**
     * FreeGrid settings instance.
     *
     * @type {GridSettings}
     */
    this.settings = settings;
    /**
     * An additional object with dynamically defined properties which describes table state.
     *
     * @type {Object}
     */
    this.tableProps = tableProps;
    /**
     * The flag which determines if the selection is in progress.
     *
     * @type {Boolean}
     */
    this.inProgress = false;
    /**
     * The flag indicates that selection was performed by clicking the corner overlay.
     *
     * @type {Boolean}
     */
    this.selectedByCorner = false;
    /**
     * The collection of the selection layer levels where the whole row was selected using the row header.
     *
     * @type {Set.<Number>}
     */
    this.selectedByRowHeader = new Set();
    /**
     * The collection of the selection layer levels where the whole column was selected using the column header.
     *
     * @type {Set.<Number>}
     */
    this.selectedByColumnHeader = new Set();
    /**
     * Selection data layer.
     *
     * @type {SelectionRange}
     */
    this.selectedRange = new SelectionRange();
    /**
     * Visualization layer.
     *
     * @type {Highlight}
     */
    this.highlight = new Highlight({
      headerClassName: settings.currentHeaderClassName,
      activeHeaderClassName: settings.activeHeaderClassName,
      rowClassName: settings.currentRowClassName,
      columnClassName: settings.currentColClassName,
      disableHighlight: this.settings.disableVisualSelection,
      cellCornerVisible: () => this.isCellCornerVisible(),
      areaCornerVisible: (layerLevel?: number) => this.isAreaCornerVisible(layerLevel),
    });
    /**
     * The module for modifying coordinates.
     *
     * @type {Transformation}
     */
    this.transformation = new Transformation(this.selectedRange, {
      countRows: () => this.tableProps.countRows(),
      countCols: () => this.tableProps.countCols(),
      fixedRowsBottom: () => settings.fixedRowsBottom as number,
      minSpareRows: () => settings.minSpareRows as number,
      minSpareCols: () => settings.minSpareCols as number,
      autoWrapRow: () => !!settings.autoWrapRow,
      autoWrapCol: () => !!settings.autoWrapCol,
    });

    this.transformation.addLocalHook('beforeTransformStart', (...args) => this.runLocalHooks('beforeModifyTransformStart', ...args));
    this.transformation.addLocalHook('afterTransformStart', (...args) => this.runLocalHooks('afterModifyTransformStart', ...args));
    this.transformation.addLocalHook('beforeTransformEnd', (...args) => this.runLocalHooks('beforeModifyTransformEnd', ...args));
    this.transformation.addLocalHook('afterTransformEnd', (...args) => this.runLocalHooks('afterModifyTransformEnd', ...args));
    this.transformation.addLocalHook('insertRowRequire', (...args) => this.runLocalHooks('insertRowRequire', ...args));
    this.transformation.addLocalHook('insertColRequire', (...args) => this.runLocalHooks('insertColRequire', ...args));
  }

  /**
   * Get data layer for current selection.
   *
   * @return {SelectionRange}
   */
  getSelectedRange(): SelectionRange {
    return this.selectedRange;
  }

  /**
   * Indicate that selection process began. It sets internaly `.inProgress` property to `true`.
   */
  begin(): void {
    this.inProgress = true;
  }

  /**
   * Indicate that selection process finished. It sets internaly `.inProgress` property to `false`.
   */
  finish(): void {
    this.runLocalHooks('afterSelectionFinished', Array.from(this.selectedRange));
    this.inProgress = false;
  }

  /**
   * Check if the process of selecting the cell/cells is in progress.
   *
   * @returns {Boolean}
   */
  isInProgress(): boolean {
    return this.inProgress;
  }

  /**
   * Starts selection range on given coordinate object.
   *
   * @param {CellCoords} coords Visual coords.
   * @param {Boolean} [multipleSelection] If `true`, selection will be worked in 'multiple' mode. This option works
   *                                      only when 'selectionMode' is set as 'multiple'. If the argument is not defined
   *                                      the default trigger will be used (isPressedCtrlKey() helper).
   * @param {Boolean} [fragment=false] If `true`, the selection will be treated as a partial selection where the
   *                                   `setRangeEnd` method won't be called on every `setRangeStart` call.
   */
  setRangeStart(coords: CellCoords, multipleSelection?: boolean, fragment = false): void {
    const isMultipleMode = this.settings.selectionMode === 'multiple';
    const isMultipleSelection = isUndefined(multipleSelection) ? isPressedCtrlKey() : multipleSelection;
    const isRowNegative = coords.row < 0;
    const isColumnNegative = coords.col < 0;
    const selectedByCorner = isRowNegative && isColumnNegative;

    if (isRowNegative) {
      coords.row = 0;
    }
    if (isColumnNegative) {
      coords.col = 0;
    }

    this.selectedByCorner = selectedByCorner;
    this.runLocalHooks(`beforeSetRangeStart${fragment ? 'Only' : ''}`, coords);

    if (!isMultipleMode || (isMultipleMode && !isMultipleSelection && isUndefined(multipleSelection))) {
      this.selectedRange.clear();
    }

    this.selectedRange.add(coords);

    if (this.getLayerLevel() === 0) {
      this.selectedByRowHeader.clear();
      this.selectedByColumnHeader.clear();
    }

    if (!selectedByCorner && isColumnNegative) {
      this.selectedByRowHeader.add(this.getLayerLevel());
    }
    if (!selectedByCorner && isRowNegative) {
      this.selectedByColumnHeader.add(this.getLayerLevel());
    }

    if (!fragment) {
      this.setRangeEnd(coords);
    }
  }

  /**
   * Starts selection range on given coordinate object.
   *
   * @param {CellCoords} coords Visual coords.
   * @param {Boolean} [multipleSelection] If `true`, selection will be worked in 'multiple' mode. This option works
   *                                      only when 'selectionMode' is set as 'multiple'. If the argument is not defined
   *                                      the default trigger will be used (isPressedCtrlKey() helper).
   */
  setRangeStartOnly(coords: CellCoords, multipleSelection?: boolean): void {
    this.setRangeStart(coords, multipleSelection, true);
  }

  /**
   * Ends selection range on given coordinate object.
   *
   * @param {CellCoords} coords Visual coords.
   */
  setRangeEnd(coords: CellCoords): void {
    if (this.selectedRange.isEmpty()) {
      return;
    }

    this.runLocalHooks('beforeSetRangeEnd', coords);
    this.begin();

    const cellRange = this.selectedRange.current() as CellRange;

    if (this.settings.selectionMode !== 'single') {
      cellRange.setTo(new CellCoords(coords.row, coords.col));
    }

    // Set up current selection.
    this.highlight.getCell().clear();

    if (this.highlight.isEnabledFor(CELL_TYPE)) {
      this.highlight.getCell().add(cellRange.highlight);
    }

    const layerLevel = this.getLayerLevel();

    // If the next layer level is lower than previous then clear all area and header highlights. This is the
    // indication that the new selection is performing.
    if (layerLevel < this.highlight.layerLevel) {
      [...this.highlight.getAreas(), ...this.highlight.getHeaders(), ...this.highlight.getActiveHeaders()]
        .forEach(highlight => highlight.clear());
    }

    this.highlight.useLayerLevel(layerLevel);

    const areaHighlight = this.highlight.createOrGetArea();
    const headerHighlight = this.highlight.createOrGetHeader();
    const activeHeaderHighlight = this.highlight.createOrGetActiveHeader();

    areaHighlight.clear();
    headerHighlight.clear();
    activeHeaderHighlight.clear();

    if (this.highlight.isEnabledFor(AREA_TYPE) && (this.isMultiple() || layerLevel >= 1)) {
      areaHighlight
        .add(cellRange.from)
        .add(cellRange.to);

      if (layerLevel === 1) {
        // For single cell selection in the same layer, we do not create area selection to prevent blue background.
        // When non-consecutive selection is performed we have to add that missing area selection to the previous layer
        // based on previous coordinates. It only occurs when the previous selection wasn't select multiple cells.
        this.highlight
          .useLayerLevel(layerLevel - 1)
          .createOrGetArea()
          .add((this.selectedRange.previous() as CellRange).from);

        this.highlight.useLayerLevel(layerLevel);
      }
    }

    if (this.highlight.isEnabledFor(HEADER_TYPE)) {
      if (this.settings.selectionMode === 'single') {
        headerHighlight.add(cellRange.highlight);

      } else {
        headerHighlight
          .add(cellRange.from)
          .add(cellRange.to);
      }
    }

    if (this.isSelectedByRowHeader()) {
      const isRowSelected = this.tableProps.countCols() === cellRange.getWidth();

      // Make sure that the whole row is selected (in case where selectionMode is set to 'single')
      if (isRowSelected) {
        activeHeaderHighlight
          .add(new CellCoords(cellRange.from.row, -1))
          .add(new CellCoords(cellRange.to.row, -1));
      }
    }

    if (this.isSelectedByColumnHeader()) {
      const isColumnSelected = this.tableProps.countRows() === cellRange.getHeight();

      // Make sure that the whole column is selected (in case where selectionMode is set to 'single')
      if (isColumnSelected) {
        activeHeaderHighlight
          .add(new CellCoords(-1, cellRange.from.col))
          .add(new CellCoords(-1, cellRange.to.col));
      }
    }

    this.runLocalHooks('afterSetRangeEnd', coords);
  }

  /**
   * Returns information if we have a multiselection. This method check multiselection only on the latest layer of
   * the selection.
   *
   * @returns {Boolean}
   */
  isMultiple(): boolean {
    const isMultipleListener = createObjectPropListener(!(this.selectedRange.current() as CellRange).isSingle());

    this.runLocalHooks('afterIsMultipleSelection', isMultipleListener);

    return isMultipleListener.value as boolean;
  }

  /**
   * Selects cell relative to the current cell (if possible).
   *
   * @param {Number} rowDelta Rows number to move, value can be passed as negative number.
   * @param {Number} colDelta Columns number to move, value can be passed as negative number.
   * @param {Boolean} force If `true` the new rows/columns will be created if necessary. Otherwise, row/column will
   *                        be created according to `minSpareRows/minSpareCols` settings of FreeGrid.
   */
  transformStart(rowDelta: number, colDelta: number, force?: boolean): void {
    this.setRangeStart(this.transformation.transformStart(rowDelta, colDelta, force));
  }

  /**
   * Sets selection end cell relative to the current selection end cell (if possible).
   *
   * @param {Number} rowDelta Rows number to move, value can be passed as negative number.
   * @param {Number} colDelta Columns number to move, value can be passed as negative number.
   */
  transformEnd(rowDelta: number, colDelta: number): void {
    this.setRangeEnd(this.transformation.transformEnd(rowDelta, colDelta));
  }

  /**
   * Returns currently used layer level.
   *
   * @return {Number} Returns layer level starting from 0. If no selection was added to the table -1 is returned.
   */
  getLayerLevel(): number {
    return this.selectedRange.size() - 1;
  }

  /**
   * Returns `true` if currently there is a selection on the screen, `false` otherwise.
   *
   * @returns {Boolean}
   */
  isSelected(): boolean {
    return !this.selectedRange.isEmpty();
  }

  /**
   * Returns `true` if the selection was applied by clicking to the row header. If the `layerLevel`
   * argument is passed then only that layer will be checked. Otherwise, it checks if any row header
   * was clicked on any selection layer level.
   *
   * @param {Number} [layerLevel=this.getLayerLevel()] Selection layer level to check.
   * @return {Boolean}
   */
  isSelectedByRowHeader(layerLevel = this.getLayerLevel()): boolean {
    return layerLevel === -1 ? this.selectedByRowHeader.size > 0 : this.selectedByRowHeader.has(layerLevel);
  }

  /**
   * Returns `true` if the selection was applied by clicking to the column header. If the `layerLevel`
   * argument is passed then only that layer will be checked. Otherwise, it checks if any column header
   * was clicked on any selection layer level.
   *
   * @param {Number} [layerLevel=this.getLayerLevel()] Selection layer level to check.
   * @return {Boolean}
   */
  isSelectedByColumnHeader(layerLevel = this.getLayerLevel()): boolean {
    return layerLevel === -1 ? this.selectedByColumnHeader.size > 0 : this.selectedByColumnHeader.has(layerLevel);
  }

  /**
   * Returns `true` if the selection was applied by clicking on the row or column header on any layer level.
   *
   * @return {Boolean}
   */
  isSelectedByAnyHeader(): boolean {
    return this.isSelectedByRowHeader(-1) || this.isSelectedByColumnHeader(-1);
  }

  /**
   * Returns `true` if the selection was applied by clicking on the left-top corner overlay.
   *
   * @return {Boolean}
   */
  isSelectedByCorner(): boolean {
    return this.selectedByCorner;
  }

  /**
   * Returns `true` if coords is within selection coords. This method iterates through all selection layers to check if
   * the coords object is within selection range.
   *
   * @param {CellCoords} coords The CellCoords instance with defined visual coordinates.
   * @returns {Boolean}
   */
  inInSelection(coords: CellCoords): boolean {
    return this.selectedRange.includes(coords);
  }

  /**
   * Returns `true` if the cell corner should be visible.
   *
   * @private
   * @return {Boolean} `true` if the corner element has to be visible, `false` otherwise.
   */
  isCellCornerVisible(): boolean {
    return !!this.settings.fillHandle && !this.tableProps.isEditorOpened() && !this.isMultiple();
  }

  /**
   * Returns `true` if the area corner should be visible.
   *
   * @param {Number} layerLevel The layer level.
   * @return {Boolean} `true` if the corner element has to be visible, `false` otherwise.
   */
  isAreaCornerVisible(layerLevel?: number): boolean {
    if (Number.isInteger(layerLevel) && layerLevel !== this.getLayerLevel()) {
      return false;
    }

    return !!this.settings.fillHandle && !this.tableProps.isEditorOpened() && this.isMultiple();
  }

  /**
   * Clear the selection by resetting the collected ranges and highlights.
   */
  clear(): void {
    this.selectedRange.clear();
    this.highlight.clear();
  }

  /**
   * Deselects all selected cells.
   */
  deselect(): void {
    if (!this.isSelected()) {
      return;
    }

    this.inProgress = false;
    this.clear();
    this.runLocalHooks('afterDeselect');
  }

  /**
   * Select all cells.
   */
  selectAll(): void {
    this.clear();
    this.setRangeStart(new CellCoords(-1, -1));
    this.selectedByRowHeader.add(this.getLayerLevel());
    this.selectedByColumnHeader.add(this.getLayerLevel());
    this.setRangeEnd(new CellCoords(this.tableProps.countRows() - 1, this.tableProps.countCols() - 1));
  }

  /**
   * Make multiple, non-contiguous selection specified by `row` and `column` values or a range of cells
   * finishing at `endRow`, `endColumn`. The method supports two input formats, first as an array of arrays such
   * as `[[rowStart, columnStart, rowEnd, columnEnd]]` and second format as an array of CellRange objects.
   * If the passed ranges have another format the exception will be thrown.
   *
   * @param {Array[]|CellRange[]} selectionRanges The coordinates which define what the cells should be selected.
   * @return {Boolean} Returns `true` if selection was successful, `false` otherwise.
   */
  selectCells(selectionRanges: SelectionInput[]): boolean {
    const selectionType = detectSelectionType(selectionRanges);

    if (selectionType === SELECTION_TYPE_EMPTY) {
      return false;

    } else if (selectionType === SELECTION_TYPE_UNRECOGNIZED) {
      throw new Error(toSingleLine`Unsupported format of the selection ranges was passed. To select cells pass 
        the coordinates as an array of arrays ([[rowStart, columnStart/columnPropStart, rowEnd, columnEnd/columnPropEnd]]) 
        or as an array of CellRange objects.`);
    }

    const selectionSchemaNormalizer = normalizeSelectionFactory(selectionType, {
      propToCol: (prop: string) => this.tableProps.propToCol(prop),
      keepDirection: true,
    });
    const countRows = this.tableProps.countRows();
    const countCols = this.tableProps.countCols();

    // Check if every layer of the coordinates are valid.
    const isValid = !selectionRanges.some((selection) => {
      const [rowStart, columnStart, rowEnd, columnEnd] = selectionSchemaNormalizer(selection);
      const _isValid = isValidCoord(rowStart, countRows) &&
                      isValidCoord(columnStart, countCols) &&
                      isValidCoord(rowEnd, countRows) &&
                      isValidCoord(columnEnd, countCols);

      return !_isValid;
    });

    if (isValid) {
      this.clear();

      selectionRanges.forEach((selection) => {
        const [rowStart, columnStart, rowEnd, columnEnd] = selectionSchemaNormalizer(selection);

        this.setRangeStartOnly(new CellCoords(rowStart, columnStart), false);
        this.setRangeEnd(new CellCoords(rowEnd, columnEnd));
        this.finish();
      });
    }

    return isValid;
  }

  /**
   * Select column specified by `startColumn` visual index or column property or a range of columns finishing at `endColumn`.
   *
   * @param {Number|String} startColumn Visual column index or column property from which the selection starts.
   * @param {Number|String} [endColumn] Visual column index or column property from to the selection finishes.
   * @returns {Boolean} Returns `true` if selection was successful, `false` otherwise.
   */
  selectColumns(startColumn: number | string, endColumn: number | string = startColumn): boolean {
    const start = typeof startColumn === 'string' ? this.tableProps.propToCol(startColumn) : startColumn;
    const end = typeof endColumn === 'string' ? this.tableProps.propToCol(endColumn) : endColumn;

    const countCols = this.tableProps.countCols();
    const isValid = isValidCoord(start, countCols) && isValidCoord(end, countCols);

    if (isValid) {
      this.setRangeStartOnly(new CellCoords(-1, start));
      this.setRangeEnd(new CellCoords(this.tableProps.countRows() - 1, end));
      this.finish();
    }

    return isValid;
  }

  /**
   * Select row specified by `startRow` visual index or a range of rows finishing at `endRow`.
   *
   * @param {Number} startRow Visual row index from which the selection starts.
   * @param {Number} [endRow] Visual row index from to the selection finishes.
   * @returns {Boolean} Returns `true` if selection was successful, `false` otherwise.
   */
  selectRows(startRow: number, endRow = startRow): boolean {
    const countRows = this.tableProps.countRows();
    const isValid = isValidCoord(startRow, countRows) && isValidCoord(endRow, countRows);

    if (isValid) {
      this.setRangeStartOnly(new CellCoords(startRow, -1));
      this.setRangeEnd(new CellCoords(endRow, this.tableProps.countCols() - 1));
      this.finish();
    }

    return isValid;
  }
}

mixin(Selection, localHooks);

export default Selection;
