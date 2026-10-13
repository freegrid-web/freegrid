import BasePlugin from './../_base';
import type { PluginHost } from './../_base';
import Hooks from './../../pluginHooks';
import { offset, outerHeight, outerWidth } from './../../helpers/dom/element';
import EventManager from './../../eventManager';
import { registerPlugin } from './../../plugins';
import { CellCoords } from './../../3rdparty/walkontable/src';
import { getDeltas, getDragDirectionAndRange, DIRECTIONS, getMappedFillHandleSetting } from './utils';

/** Selection corners: `[row, column, row2, column2]`. */
type Corners = [number, number, number, number];

Hooks.getSingleton().register('modifyAutofillRange');
Hooks.getSingleton().register('beforeAutofill');

const INSERT_ROW_ALTER_ACTION_NAME = 'insert_row';
const INTERVAL_FOR_ADDING_ROW = 200;

/**
 * This plugin provides "drag-down" and "copy-down" functionalities, both operated using the small square in the right
 * bottom of the cell selection.
 *
 * "Drag-down" expands the value of the selected cells to the neighbouring cells when you drag the small square in the corner.
 *
 * "Copy-down" copies the value of the selection to all empty cells below when you double click the small square.
 *
 * @class Autofill
 * @plugin Autofill
 */

class Autofill extends BasePlugin {
  /**
   * Event manager instance.
   *
   * @private
   */
  eventManager: EventManager;

  /**
   * Specifies if adding new row started.
   *
   * @private
   */
  addingStarted = false;

  /**
   * Specifies if there was mouse down on the cell corner.
   *
   * @private
   */
  mouseDownOnCellCorner = false;

  /**
   * Specifies if mouse was dragged outside FreeGrid.
   *
   * @private
   */
  mouseDragOutside = false;

  /**
   * Specifies how many cell levels were dragged using the handle.
   *
   * @private
   */
  handleDraggedCells = 0;

  /**
   * Specifies allowed directions of drag (`'horizontal'` or '`vertical`').
   *
   * @private
   */
  directions: string[] = [];

  /**
   * Specifies if can insert new rows if needed.
   */
  autoInsertRow = false;

  constructor(hotInstance: PluginHost) {
    super(hotInstance);
    this.eventManager = new EventManager(this);
  }

  /**
   * Checks if the plugin is enabled in the FreeGrid settings.
   */
  isEnabled(): boolean {
    return !!this.hot.getSettings().fillHandle;
  }

  /**
   * Enables the plugin functionality for this FreeGrid instance.
   */
  enablePlugin(): void {
    if (this.enabled) {
      return;
    }

    this.mapSettings();
    this.registerEvents();

    this.addHook('afterOnCellCornerMouseDown', () => this.onAfterCellCornerMouseDown());
    this.addHook('afterOnCellCornerDblClick', () => this.onCellCornerDblClick());
    this.addHook('beforeOnCellMouseOver', (event: MouseEvent, coords: CellCoords) => this.onBeforeCellMouseOver(coords));

    super.enablePlugin();
  }

  /**
   * Updates the plugin state. This method is executed when {@link Core#updateSettings} is invoked.
   */
  updatePlugin(): void {
    this.disablePlugin();
    this.enablePlugin();
    super.updatePlugin();
  }

  /**
   * Disables the plugin functionality for this FreeGrid instance.
   */
  disablePlugin(): void {
    this.clearMappedSettings();
    super.disablePlugin();
  }

  /**
   * Gets selection data
   *
   * @private
   * @returns Array with the data.
   */
  getSelectionData(): unknown[][] {
    const { from, to } = this.hot.getSelectedRangeLast();

    return this.hot.getData(from.row, from.col, to.row, to.col);
  }

  /**
   * Try to apply fill values to the area in fill border, omitting the selection border.
   *
   * @private
   * @returns reports if fill was applied.
   *
   * @fires Hooks#modifyAutofillRange
   * @fires Hooks#beforeAutofill
   */
  fillIn(): boolean {
    if (this.hot.selection.highlight.getFill().isEmpty()) {
      return false;
    }

    let cornersOfSelectionAndDragAreas: Corners = this.hot.selection.highlight.getFill().getCorners();

    this.resetSelectionOfDraggedArea();

    const cornersOfSelectedCells = this.getCornersOfSelectedCells();
    cornersOfSelectionAndDragAreas = this.hot.runHooks('modifyAutofillRange', cornersOfSelectionAndDragAreas, cornersOfSelectedCells);

    const { directionOfDrag, startOfDragCoords, endOfDragCoords } = getDragDirectionAndRange(cornersOfSelectedCells, cornersOfSelectionAndDragAreas);

    if (startOfDragCoords && startOfDragCoords.row > -1 && startOfDragCoords.col > -1) {
      const selectionData = this.getSelectionData();

      this.hot.runHooks('beforeAutofill', startOfDragCoords, endOfDragCoords, selectionData);

      const endCoords = endOfDragCoords!;
      const deltas = getDeltas(startOfDragCoords, endCoords, selectionData, directionOfDrag!);
      let fillData = selectionData;

      // Dragging up or left repeats the selection backwards from its first row or column.
      if (directionOfDrag === 'up') {
        const dragLength = endCoords.row - startOfDragCoords.row + 1;
        const fillOffset = dragLength % selectionData.length;

        fillData = Array.from({ length: dragLength },
          (_, i) => selectionData[(i + (selectionData.length - fillOffset)) % selectionData.length]);

      } else if (directionOfDrag === 'left') {
        const dragLength = endCoords.col - startOfDragCoords.col + 1;
        const fillOffset = dragLength % selectionData[0].length;

        fillData = selectionData.map(row => Array.from({ length: dragLength },
          (_, j) => row[(j + (row.length - fillOffset)) % row.length]));
      }

      this.hot.populateFromArray(
        startOfDragCoords.row,
        startOfDragCoords.col,
        fillData,
        endCoords.row,
        endCoords.col,
        `${this.pluginName}.fill`,
        null,
        directionOfDrag,
        deltas
      );

      this.setSelection(cornersOfSelectionAndDragAreas);

    } else {
      // reset to avoid some range bug
      this.hot._refreshBorders();
    }

    return true;
  }

  /**
   * Reduces the selection area if the handle was dragged outside of the table or on headers.
   *
   * @private
   * @param coords indexes of selection corners.
   */
  reduceSelectionAreaIfNeeded(coords: CellCoords): CellCoords {
    if (coords.row < 0) {
      coords.row = 0;
    }

    if (coords.col < 0) {
      coords.col = 0;
    }
    return coords;
  }

  /**
   * Gets the coordinates of the drag & drop borders.
   *
   * @private
   * @param coordsOfSelection `CellCoords` coord object.
   */
  getCoordsOfDragAndDropBorders(coordsOfSelection: CellCoords): CellCoords | undefined {
    const topLeftCorner = this.hot.getSelectedRangeLast().getTopLeftCorner();
    const bottomRightCorner = this.hot.getSelectedRangeLast().getBottomRightCorner();
    let coords;

    if (this.directions.includes(DIRECTIONS.vertical) &&
      (bottomRightCorner.row < coordsOfSelection.row || topLeftCorner.row > coordsOfSelection.row)) {
      coords = new CellCoords(coordsOfSelection.row, bottomRightCorner.col);

    } else if (this.directions.includes(DIRECTIONS.horizontal)) {
      coords = new CellCoords(bottomRightCorner.row, coordsOfSelection.col);

    } else {
      // wrong direction
      return;
    }

    return this.reduceSelectionAreaIfNeeded(coords);
  }

  /**
   * Show the fill border.
   *
   * @private
   * @param coordsOfSelection `CellCoords` coord object.
   */
  showBorder(coordsOfSelection: CellCoords): void {
    const coordsOfDragAndDropBorders = this.getCoordsOfDragAndDropBorders(coordsOfSelection);

    if (coordsOfDragAndDropBorders) {
      this.redrawBorders(coordsOfDragAndDropBorders);
    }
  }

  /**
   * Add new row
   *
   * @private
   */
  addRow(): void {
    this.hot._registerTimeout(setTimeout(() => {
      this.hot.alter(INSERT_ROW_ALTER_ACTION_NAME, undefined, 1, `${this.pluginName}.fill`);

      this.addingStarted = false;
    }, INTERVAL_FOR_ADDING_ROW));
  }

  /**
   * Add new rows if they are needed to continue auto-filling values.
   *
   * @private
   */
  addNewRowIfNeeded(): void {
    if (this.hot.selection.highlight.getFill().cellRange && this.addingStarted === false && this.autoInsertRow) {
      const cornersOfSelectedCells = this.hot.getSelectedLast();
      const cornersOfSelectedDragArea = this.hot.selection.highlight.getFill().getCorners();
      const nrOfTableRows = this.hot.countRows();

      if (cornersOfSelectedCells[2] < nrOfTableRows - 1 && cornersOfSelectedDragArea[2] === nrOfTableRows - 1) {
        this.addingStarted = true;

        this.addRow();
      }
    }
  }

  /**
   * Get corners of selected cells.
   *
   * @private
   */
  getCornersOfSelectedCells(): Corners {
    if (this.hot.selection.isMultiple()) {
      return this.hot.selection.highlight.createOrGetArea().getCorners();
    }

    return this.hot.selection.highlight.getCell().getCorners();
  }

  /**
   * Get index of last adjacent filled in row
   *
   * @private
   * @param cornersOfSelectedCells indexes of selection corners.
   * @returns gives number greater than or equal to zero when selection adjacent can be applied.
   * or -1 when selection adjacent can't be applied (`undefined` when no row has a filled neighbour)
   */
  getIndexOfLastAdjacentFilledInRow(cornersOfSelectedCells: Corners): number | undefined {
    const data: unknown[][] = this.hot.getData();
    const nrOfTableRows: number = this.hot.countRows();
    let lastFilledInRowIndex: number | undefined;

    for (let rowIndex = cornersOfSelectedCells[2] + 1; rowIndex < nrOfTableRows; rowIndex += 1) {
      // A filled cell below the selection stops the fill.
      if (data[rowIndex].slice(cornersOfSelectedCells[1], cornersOfSelectedCells[3] + 1).some(Boolean)) {
        return -1;
      }

      const dataInNextLeftCell = data[rowIndex][cornersOfSelectedCells[1] - 1];
      const dataInNextRightCell = data[rowIndex][cornersOfSelectedCells[3] + 1];

      if (!!dataInNextLeftCell || !!dataInNextRightCell) {
        lastFilledInRowIndex = rowIndex;
      }
    }

    return lastFilledInRowIndex;
  }

  /**
   * Adds a selection from the start area to the specific row index.
   *
   * @private
   * @param selectStartArea selection area from which we start to create more comprehensive selection.
   * @param rowIndex The last row of the new selection.
   */
  addSelectionFromStartAreaToSpecificRowIndex(selectStartArea: Corners, rowIndex: number): void {
    this.hot.selection.highlight.getFill()
      .clear()
      .add(new CellCoords(
        selectStartArea[0],
        selectStartArea[1])
      )
      .add(new CellCoords(
        rowIndex,
        selectStartArea[3])
      );
  }

  /**
   * Sets selection based on passed corners.
   *
   * @private
   * @param cornersOfArea The corners of the new selection.
   */
  setSelection(cornersOfArea: Corners): void {
    this.hot.selectCell(...cornersOfArea, false, false);
  }

  /**
   * Try to select cells down to the last row in the left column and then returns if selection was applied.
   *
   * @private
   */
  selectAdjacent(): boolean {
    const cornersOfSelectedCells = this.getCornersOfSelectedCells();
    const lastFilledInRowIndex = this.getIndexOfLastAdjacentFilledInRow(cornersOfSelectedCells);

    if (lastFilledInRowIndex === -1 || lastFilledInRowIndex === undefined) {
      return false;
    }

    this.addSelectionFromStartAreaToSpecificRowIndex(cornersOfSelectedCells, lastFilledInRowIndex);

    return true;
  }

  /**
   * Resets selection of dragged area.
   *
   * @private
   */
  resetSelectionOfDraggedArea(): void {
    this.handleDraggedCells = 0;

    this.hot.selection.highlight.getFill().clear();
  }

  /**
   * Redraws borders.
   *
   * @private
   * @param coords `CellCoords` coord object.
   */
  redrawBorders(coords: CellCoords): void {
    this.hot.selection.highlight.getFill()
      .clear()
      .add(this.hot.getSelectedRangeLast().from)
      .add(this.hot.getSelectedRangeLast().to)
      .add(coords);

    this.hot.view.render();
  }

  /**
   * Get if mouse was dragged outside.
   *
   * @private
   * @param event `mousemove` event properties.
   */
  getIfMouseWasDraggedOutside(event: MouseEvent): boolean {
    const tableBottom = offset(this.hot.table).top - (window.pageYOffset ||
      document.documentElement.scrollTop) + outerHeight(this.hot.table);
    const tableRight = offset(this.hot.table).left - (window.pageXOffset ||
      document.documentElement.scrollLeft) + outerWidth(this.hot.table);

    return event.clientY > tableBottom && event.clientX <= tableRight;
  }

  /**
   * Bind the events used by the plugin.
   *
   * @private
   */
  registerEvents(): void {
    this.eventManager.addEventListener(document.documentElement, 'mouseup', () => this.onMouseUp());
    this.eventManager.addEventListener(document.documentElement, 'mousemove', (event: MouseEvent) => this.onMouseMove(event));
  }

  /**
   * On cell corner double click callback.
   *
   * @private
   */
  onCellCornerDblClick(): void {
    const selectionApplied = this.selectAdjacent();

    if (selectionApplied) {
      this.fillIn();
    }
  }

  /**
   * On after cell corner mouse down listener.
   *
   * @private
   */
  onAfterCellCornerMouseDown(): void {
    this.handleDraggedCells = 1;
    this.mouseDownOnCellCorner = true;
  }

  /**
   * On before cell mouse over listener.
   *
   * @private
   * @param coords `CellCoords` coord object.
   */
  onBeforeCellMouseOver(coords: CellCoords): void {
    if (this.mouseDownOnCellCorner && !this.hot.view.isMouseDown() && this.handleDraggedCells) {
      this.handleDraggedCells += 1;

      this.showBorder(coords);
      this.addNewRowIfNeeded();
    }
  }

  /**
   * On mouse up listener.
   *
   * @private
   */
  onMouseUp(): void {
    if (this.handleDraggedCells) {
      if (this.handleDraggedCells > 1) {
        this.fillIn();
      }

      this.handleDraggedCells = 0;
      this.mouseDownOnCellCorner = false;
    }
  }

  /**
   * On mouse move listener.
   *
   * @private
   * @param event `mousemove` event properties.
   */
  onMouseMove(event: MouseEvent): void {
    const mouseWasDraggedOutside = this.getIfMouseWasDraggedOutside(event);

    if (this.addingStarted === false && this.handleDraggedCells > 0 && mouseWasDraggedOutside) {
      this.mouseDragOutside = true;
      this.addingStarted = true;

    } else {
      this.mouseDragOutside = false;
    }

    if (this.mouseDragOutside && this.autoInsertRow) {
      this.addRow();
    }
  }

  /**
   * Clears mapped settings.
   *
   * @private
   */
  clearMappedSettings(): void {
    this.directions.length = 0;
    this.autoInsertRow = false;
  }

  /**
   * Map settings.
   *
   * @private
   */
  mapSettings(): void {
    const mappedSettings = getMappedFillHandleSetting(this.hot.getSettings().fillHandle);

    this.directions = mappedSettings.directions;
    this.autoInsertRow = mappedSettings.autoInsertRow;
  }

  /**
   * Destroys the plugin instance.
   */
  destroy(): void {
    super.destroy();
  }
}

registerPlugin('autofill', Autofill);

export default Autofill;
