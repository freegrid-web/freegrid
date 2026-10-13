import { isObject } from './../../helpers/object';
import { isDefined } from './../../helpers/mixed';
import { CellCoords } from './../../3rdparty/walkontable/src';

export const DIRECTIONS = {
  horizontal: 'horizontal',
  vertical: 'vertical',
} as const;

/** The `fillHandle` setting. */
export type FillHandleSetting = boolean | string | { direction?: string; autoInsertRow?: boolean } | undefined;

/** Where the selection was dragged, and the cells it was dragged over. */
export type DragDirectionAndRange = {
  directionOfDrag?: 'left' | 'right' | 'up' | 'down';
  startOfDragCoords?: CellCoords;
  endOfDragCoords?: CellCoords;
};

/**
 * The step between the numbers of each column (dragging down or up) or row (right or left) of `data`: the difference
 * between the first and the last number, divided by the gaps between them (`0` where they are not numbers). One array
 * for down and up; an array per row for right and left.
 */
export const getDeltas = (start: CellCoords, end: CellCoords, data: unknown[][], direction: string): number[][] => {
  const rowsLength = data.length;
  const columnsLength = data ? data[0].length : 0;
  const deltas: number[][] = [];
  const toNumber = (value: unknown) => parseInt(value as string, 10);

  if (direction === 'down' || direction === 'up') {
    const columnDeltas: number[] = [];

    for (let col = 0; col <= end.col - start.col; col += 1) {
      const startValue = toNumber(data[0][col]);
      const endValue = toNumber(data[rowsLength - 1][col]);

      columnDeltas.push((direction === 'down' ? endValue - startValue : startValue - endValue) / (rowsLength - 1) || 0);
    }
    deltas.push(columnDeltas);
  }

  if (direction === 'right' || direction === 'left') {
    for (let row = 0; row <= end.row - start.row; row += 1) {
      const startValue = toNumber(data[row][0]);
      const endValue = toNumber(data[row][columnsLength - 1]);

      deltas.push([(direction === 'right' ? endValue - startValue : startValue - endValue) / (columnsLength - 1) || 0]);
    }
  }

  return deltas;
};

/**
 * The direction the selection `startSelection` was dragged in to become `endSelection` (both
 * `[row, column, row2, column2]`), and the cells it was dragged over. Nothing for no or a diagonal drag.
 */
export const getDragDirectionAndRange = (startSelection: number[], endSelection: number[]): DragDirectionAndRange => {
  const [startRow, startColumn, startRow2, startColumn2] = startSelection;
  const [endRow, endColumn, endRow2, endColumn2] = endSelection;

  if (endRow === startRow && endColumn < startColumn) {
    return {
      directionOfDrag: 'left',
      startOfDragCoords: new CellCoords(endRow, endColumn),
      endOfDragCoords: new CellCoords(endRow2, startColumn - 1),
    };
  }
  if (endRow2 === startRow2 && endRow === startRow && endColumn2 > startColumn2) {
    return {
      directionOfDrag: 'right',
      startOfDragCoords: new CellCoords(endRow, startColumn2 + 1),
      endOfDragCoords: new CellCoords(endRow2, endColumn2),
    };
  }
  if (endRow < startRow && endColumn === startColumn) {
    return {
      directionOfDrag: 'up',
      startOfDragCoords: new CellCoords(endRow, endColumn),
      endOfDragCoords: new CellCoords(startRow - 1, endColumn2),
    };
  }
  if (endRow2 > startRow2 && endColumn === startColumn) {
    return {
      directionOfDrag: 'down',
      startOfDragCoords: new CellCoords(startRow2 + 1, endColumn),
      endOfDragCoords: new CellCoords(endRow2, endColumn2),
    };
  }

  return { directionOfDrag: undefined, startOfDragCoords: undefined, endOfDragCoords: undefined };
};

/**
 * The `fillHandle` setting as the directions the fill handle may be dragged in (`horizontal`, `vertical`) and whether
 * dragging past the last row adds rows (never for horizontal only).
 */
export const getMappedFillHandleSetting = (fillHandle: FillHandleSetting): { directions: string[]; autoInsertRow: boolean } => {
  if (fillHandle === true) {
    return { directions: Object.keys(DIRECTIONS), autoInsertRow: true };
  }
  if (isObject(fillHandle)) {
    const { direction, autoInsertRow } = fillHandle as { direction?: string; autoInsertRow?: boolean };

    return {
      directions: isDefined(direction) ? [direction as string] : Object.keys(DIRECTIONS),
      autoInsertRow: isDefined(autoInsertRow) && direction !== DIRECTIONS.horizontal ? autoInsertRow as boolean : false,
    };
  }
  if (typeof fillHandle === 'string') {
    return { directions: [fillHandle], autoInsertRow: true };
  }

  return { directions: [], autoInsertRow: false };
};
