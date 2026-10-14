import { extend } from '../../../helpers/object';
import { CellCoords, CellRange } from './../../../3rdparty/walkontable/src';
import type MergeCells from './../mergeCells';
import type MergedCellCoords from './../cellCoords';
import type MergedCellsCollection from './../cellsCollection';

/** What a fill started with (see `snapDragArea`), for recreating the merged cells after it. */
type FillData = {
  baseArea?: number[];
  dragDirection?: string;
  foundMergedCells?: MergedCellCoords[];
  fillSize?: number | null;
  dragArea?: number[];
  cycleLength?: number;
};

/** A change of a cell: `[row, prop, oldValue, newValue]`. */
type Change = [number, string | number, ...unknown[]];

/**
 * Class responsible for all of the Autofill-related operations on merged cells.
 *
 * @class AutofillCalculations
 * @plugin MergeCells
 * @util
 */
class AutofillCalculations {
  /**
   * Reference to the Merge Cells plugin.
   */
  plugin: MergeCells;

  /**
   * Reference to the MergedCellsCollection class instance.
   */
  mergedCellsCollection: MergedCellsCollection;

  /**
   * Cache of the currently processed autofill data.
   *
   * @private
   */
  currentFillData: FillData | null = null;

  constructor(plugin: MergeCells) {
    this.plugin = plugin;
    this.mergedCellsCollection = this.plugin.mergedCellsCollection;
  }

  /**
   * Correct the provided selection area, so it's not selecting only a part of a merged cell.
   *
   * @param selectionArea
   */
  correctSelectionAreaSize(selectionArea: number[]): void {
    if (selectionArea[0] === selectionArea[2] && selectionArea[1] === selectionArea[3]) {
      const mergedCell = this.mergedCellsCollection.get(selectionArea[0], selectionArea[1]);

      if (mergedCell) {
        selectionArea[2] = selectionArea[0] + mergedCell.rowspan - 1;
        selectionArea[3] = selectionArea[1] + mergedCell.colspan - 1;
      }
    }
  }

  /**
   * Get the direction of the autofill process.
   *
   * @param selectionArea The selection area.
   * @param finalArea The final area (base + drag).
   * @return `up`, `down`, `left` or `right`.
   */
  getDirection(selectionArea: number[], finalArea: number[]): string {
    let direction: string;

    if (finalArea[0] === selectionArea[0] && finalArea[1] === selectionArea[1] && finalArea[3] === selectionArea[3]) {
      direction = 'down';

    } else if (finalArea[2] === selectionArea[2] && finalArea[1] === selectionArea[1] && finalArea[3] === selectionArea[3]) {
      direction = 'up';

    } else if (finalArea[1] === selectionArea[1] && finalArea[2] === selectionArea[2]) {
      direction = 'right';

    } else {
      direction = 'left';
    }

    return direction;
  }

  /**
   * Snap the drag area to the farthest merged cell, so it won't clip any of the merged cells.
   *
   * @param baseArea The base selected area.
   * @param dragArea The drag area.
   * @param dragDirection The autofill drag direction.
   * @param foundMergedCells MergeCellCoords found in the base selection area.
   * @return The new drag area
   */
  snapDragArea(baseArea: number[], dragArea: number[], dragDirection: string,
    foundMergedCells: MergedCellCoords[]): number[] {
    const newDragArea = dragArea.slice(0);
    const fillSize = this.getAutofillSize(baseArea, dragArea, dragDirection);
    const [baseAreaStartRow, baseAreaStartColumn, baseAreaEndRow, baseAreaEndColumn] = baseArea;
    const verticalDirection = ['up', 'down'].indexOf(dragDirection) > -1;
    const fullCycle = verticalDirection ? baseAreaEndRow - baseAreaStartRow + 1 : baseAreaEndColumn - baseAreaStartColumn + 1;
    const fulls = Math.floor(fillSize! / fullCycle) * fullCycle;
    const partials = fillSize! - fulls;
    const farthestCollection = this.getFarthestCollection(baseArea, dragArea, dragDirection, foundMergedCells);

    if (farthestCollection) {
      if (dragDirection === 'down') {
        const fill = farthestCollection.row + farthestCollection.rowspan - baseAreaStartRow - partials;
        const newLimit = newDragArea[2] + fill;

        if (newLimit >= this.plugin.hot.countRows()) {
          newDragArea[2] -= partials;

        } else {
          newDragArea[2] += partials ? fill : 0;
        }

      } else if (dragDirection === 'right') {
        const fill = farthestCollection.col + farthestCollection.colspan - baseAreaStartColumn - partials;
        const newLimit = newDragArea[3] + fill;

        if (newLimit >= this.plugin.hot.countCols()) {
          newDragArea[3] -= partials;

        } else {
          newDragArea[3] += partials ? fill : 0;
        }

      } else if (dragDirection === 'up') {
        const fill = baseAreaEndRow - partials - farthestCollection.row + 1;
        const newLimit = newDragArea[0] + fill;

        if (newLimit < 0) {
          newDragArea[0] += partials;

        } else {
          newDragArea[0] -= partials ? fill : 0;
        }

      } else if (dragDirection === 'left') {
        const fill = baseAreaEndColumn - partials - farthestCollection.col + 1;
        const newLimit = newDragArea[1] + fill;

        if (newLimit < 0) {
          newDragArea[1] += partials;

        } else {
          newDragArea[1] -= partials ? fill : 0;
        }
      }
    }

    this.updateCurrentFillCache({
      baseArea,
      dragDirection,
      foundMergedCells,
      fillSize,
      dragArea: newDragArea,
      cycleLength: fullCycle,
    });

    return newDragArea;
  }

  /**
   * Update the current fill cache with the provided object.
   *
   * @private
   * @param updateObject
   */
  updateCurrentFillCache(updateObject: FillData): void {
    if (!this.currentFillData) {
      this.currentFillData = {};
    }

    extend(this.currentFillData, updateObject);
  }

  /**
   * Get the "length" of the drag area.
   *
   * @private
   * @param baseArea The base selection area.
   * @param dragArea The drag area (containing the base area).
   * @param direction The drag direction.
   * @return The "length" (height or width, depending on the direction) of the drag.
   */
  getAutofillSize(baseArea: number[], dragArea: number[], direction: string): number | null {
    const [baseAreaStartRow, baseAreaStartColumn, baseAreaEndRow, baseAreaEndColumn] = baseArea;
    const [dragAreaStartRow, dragAreaStartColumn, dragAreaEndRow, dragAreaEndColumn] = dragArea;

    switch (direction) {
      case 'up':
        return baseAreaStartRow - dragAreaStartRow;
      case 'down':
        return dragAreaEndRow - baseAreaEndRow;
      case 'left':
        return baseAreaStartColumn - dragAreaStartColumn;
      case 'right':
        return dragAreaEndColumn - baseAreaEndColumn;
      default:
        return null;
    }
  }

  /**
   * Trim the default drag area (containing the selection area) to the drag-only area.
   *
   * @private
   * @param baseArea The base selection area.
   * @param dragArea The base selection area extended by the drag area.
   * @param direction Drag direction.
   * @return Array representing the drag area coordinates.
   */
  getDragArea(baseArea: number[], dragArea: number[], direction: string): number[] | null {
    const [baseAreaStartRow, baseAreaStartColumn, baseAreaEndRow, baseAreaEndColumn] = baseArea;
    const [dragAreaStartRow, dragAreaStartColumn, dragAreaEndRow, dragAreaEndColumn] = dragArea;

    switch (direction) {
      case 'up':
        return [dragAreaStartRow, dragAreaStartColumn, baseAreaStartRow - 1, baseAreaEndColumn];
      case 'down':
        return [baseAreaEndRow + 1, baseAreaStartColumn, dragAreaEndRow, baseAreaEndColumn];
      case 'left':
        return [dragAreaStartRow, dragAreaStartColumn, baseAreaEndRow, baseAreaStartColumn - 1];
      case 'right':
        return [baseAreaStartRow, baseAreaEndColumn + 1, dragAreaEndRow, dragAreaEndColumn];
      default:
        return null;
    }
  }

  /**
   * Get the to-be-farthest merged cell in the newly filled area.
   *
   * @private
   * @param baseArea The base selection area.
   * @param dragArea The drag area (containing the base area).
   * @param direction The drag direction.
   * @param mergedCellArray Array of the merged cells found in the base area.
   */
  getFarthestCollection(baseArea: number[], dragArea: number[], direction: string,
    mergedCellArray: MergedCellCoords[]): MergedCellCoords | null {
    const [baseAreaStartRow, baseAreaStartColumn, baseAreaEndRow, baseAreaEndColumn] = baseArea;
    const verticalDirection = ['up', 'down'].indexOf(direction) > -1;
    const baseEnd = verticalDirection ? baseAreaEndRow : baseAreaEndColumn;
    const baseStart = verticalDirection ? baseAreaStartRow : baseAreaStartColumn;
    const fillSize = this.getAutofillSize(baseArea, dragArea, direction);
    const fullCycle = verticalDirection ? baseAreaEndRow - baseAreaStartRow + 1 : baseAreaEndColumn - baseAreaStartColumn + 1;
    const fulls = Math.floor(fillSize! / fullCycle) * fullCycle;
    const partials = fillSize! - fulls;
    let inclusionFunctionName: 'includesVertically' | 'includesHorizontally' | null = null;
    let farthestCollection: MergedCellCoords | null = null;
    let endOfDragRecreationIndex = 0;

    switch (direction) {
      case 'up':
        inclusionFunctionName = 'includesVertically';
        endOfDragRecreationIndex = baseEnd - partials + 1;
        break;

      case 'left':
        inclusionFunctionName = 'includesHorizontally';
        endOfDragRecreationIndex = baseEnd - partials + 1;
        break;

      case 'down':
        inclusionFunctionName = 'includesVertically';
        endOfDragRecreationIndex = baseStart + partials - 1;
        break;

      case 'right':
        inclusionFunctionName = 'includesHorizontally';
        endOfDragRecreationIndex = baseStart + partials - 1;
        break;

      default:
    }

    mergedCellArray.forEach((currentCollection) => {
      if (inclusionFunctionName && currentCollection[inclusionFunctionName](endOfDragRecreationIndex) &&
        currentCollection.isFarther(farthestCollection, direction)) {
        farthestCollection = currentCollection;
      }
    });

    return farthestCollection;
  }

  /**
   * Recreate the merged cells after the autofill process.
   *
   * @param changes Changes made.
   */
  recreateAfterDataPopulation(changes: Change[]): void {
    if (!this.currentFillData) {
      return;
    }

    const fillRange = this.getRangeFromChanges(changes);
    const foundMergedCells = this.currentFillData.foundMergedCells!;
    const { dragDirection } = this.currentFillData;
    const inBounds = (current: MergedCellCoords, offset: number) => {
      switch (dragDirection) {
        case 'up':
          return current.row - offset >= fillRange.from.row;
        case 'down':
          return current.row + current.rowspan - 1 + offset <= fillRange.to.row;
        case 'left':
          return current.col - offset >= fillRange.from.column;
        case 'right':
          return current.col + current.colspan - 1 + offset <= fillRange.to.column;
        default:
          return null;
      }
    };
    let fillOffset = 0;
    let current: MergedCellCoords = null!;
    let multiplier = 1;

    do {
      for (let j = 0; j < foundMergedCells.length; j += 1) {
        current = foundMergedCells[j];

        fillOffset = multiplier * this.currentFillData.cycleLength!;

        if (inBounds(current, fillOffset)) {
          switch (dragDirection) {
            case 'up':
              this.plugin.mergedCellsCollection.add({
                row: current.row - fillOffset,
                rowspan: current.rowspan,
                col: current.col,
                colspan: current.colspan
              });
              break;

            case 'down':
              this.plugin.mergedCellsCollection.add({
                row: current.row + fillOffset,
                rowspan: current.rowspan,
                col: current.col,
                colspan: current.colspan
              });
              break;

            case 'left':
              this.plugin.mergedCellsCollection.add({
                row: current.row,
                rowspan: current.rowspan,
                col: current.col - fillOffset,
                colspan: current.colspan
              });
              break;

            case 'right':
              this.plugin.mergedCellsCollection.add({
                row: current.row,
                rowspan: current.rowspan,
                col: current.col + fillOffset,
                colspan: current.colspan
              });
              break;

            default:
          }
        }

        if (j === foundMergedCells.length - 1) {
          multiplier += 1;
        }
      }

    } while (inBounds(current, fillOffset));

    this.currentFillData = null;
    this.plugin.hot.render();
  }

  /**
   * Get the drag range from the changes made.
   *
   * @private
   * @param changes The changes made.
   * @returns Object with `from` and `to` properties, both containing `row` and `column` keys.
   */
  getRangeFromChanges(changes: Change[]): { from: { row: number; column: number }; to: { row: number; column: number } } {
    const rows: { min: number | null; max: number | null } = { min: null, max: null };
    const columns: { min: number | null; max: number | null } = { min: null, max: null };

    changes.forEach((change) => {
      const rowIndex = change[0];
      const columnIndex: number = this.plugin.hot.propToCol(change[1]);

      if (rows.min === null || rowIndex < rows.min) {
        rows.min = rowIndex;
      }

      if (rows.max === null || rowIndex > rows.max) {
        rows.max = rowIndex;
      }

      if (columns.min === null || columnIndex < columns.min) {
        columns.min = columnIndex;
      }

      if (columns.max === null || columnIndex > columns.max) {
        columns.max = columnIndex;
      }
    });

    // The changes are not empty: every bound is set.
    return {
      from: { row: rows.min!, column: columns.min! },
      to: { row: rows.max!, column: columns.max! },
    };
  }

  /**
   * Check if the drag area contains any merged cells.
   *
   * @param baseArea The base selection area.
   * @param fullArea The base area extended by the drag area.
   * @param direction Drag direction.
   */
  dragAreaOverlapsCollections(baseArea: number[], fullArea: number[], direction: string): boolean {
    const dragArea = this.getDragArea(baseArea, fullArea, direction);
    const [dragAreaStartRow, dragAreaStartColumn, dragAreaEndRow, dragAreaEndColumn] = dragArea!;
    const topLeft = new CellCoords(dragAreaStartRow, dragAreaStartColumn);
    const bottomRight = new CellCoords(dragAreaEndRow, dragAreaEndColumn);
    const dragRange = new CellRange(topLeft, topLeft, bottomRight);

    return !!this.mergedCellsCollection.getWithinRange(dragRange, true);
  }
}

export default AutofillCalculations;
