import { CellRange } from './../3rdparty/walkontable/src';

export const SELECTION_TYPE_UNRECOGNIZED = 0;
export const SELECTION_TYPE_EMPTY = 1;
export const SELECTION_TYPE_ARRAY = 2;
export const SELECTION_TYPE_OBJECT = 3;
export const SELECTION_TYPES = [
  SELECTION_TYPE_OBJECT,
  SELECTION_TYPE_ARRAY,
];

/** `[rowStart, columnStart, rowEnd?, columnEnd?]`; columns may be props. */
export type SelectionArray = [number, number | string, number?, (number | string)?];
export type SelectionInput = SelectionArray | CellRange;
/** `[rowStart, columnStart, rowEnd, columnEnd]`. */
export type NormalizedSelection = [number, number, number, number];

const ARRAY_TYPE_PATTERN = [['number'], ['number', 'string'], ['number', 'undefined'], ['number', 'string', 'undefined']];
const rootCall = Symbol('root');
const childCall = Symbol('child');

/**
 * The format of selection ranges (as `getSelected()` and `getSelectedRange()` give them): empty, a list of
 * `[row, column, row2, column2]` arrays, a list of CellRanges, or unrecognized (`SELECTION_TYPE_*`).
 */
export const detectSelectionType = (selectionRanges: unknown, _callSymbol: symbol = rootCall): number => {
  if (_callSymbol !== rootCall && _callSymbol !== childCall) {
    throw new Error('The second argument is used internally only and cannot be overwritten.');
  }
  if (!Array.isArray(selectionRanges)) {
    return SELECTION_TYPE_UNRECOGNIZED;
  }
  const isRootCall = _callSymbol === rootCall;
  const [firstItem] = selectionRanges;

  if (selectionRanges.length === 0) {
    return SELECTION_TYPE_EMPTY;
  }
  if (isRootCall && firstItem instanceof CellRange) {
    return SELECTION_TYPE_OBJECT;
  }
  if (isRootCall && Array.isArray(firstItem)) {
    return detectSelectionType(firstItem, childCall);
  }
  if (selectionRanges.length >= 2 && selectionRanges.length <= 4
    && selectionRanges.every((value, index) => ARRAY_TYPE_PATTERN[index].includes(typeof value))) {
    return SELECTION_TYPE_ARRAY;
  }

  return SELECTION_TYPE_UNRECOGNIZED;
};

type NormalizeOptions = { keepDirection?: boolean; propToCol?: (prop: string) => number };

/**
 * A function that turns one selection range of `type` into `[rowStart, columnStart, rowEnd, columnEnd]`: a missing
 * end is the start, column props become indexes (with `propToCol`), and without `keepDirection` the range runs from
 * top-left to bottom-right.
 */
export const normalizeSelectionFactory = (type: number, { keepDirection = false, propToCol }: NormalizeOptions = {}) => {
  if (!SELECTION_TYPES.includes(type)) {
    throw new Error('Unsupported selection ranges schema type was provided.');
  }

  return (selection: SelectionInput): NormalizedSelection => {
    const isObjectType = type === SELECTION_TYPE_OBJECT;
    const range = selection as CellRange;
    const array = selection as SelectionArray;
    let rowStart = isObjectType ? range.from.row : array[0];
    let columnStart = isObjectType ? range.from.col : array[1];
    let rowEnd = isObjectType ? range.to.row : array[2];
    let columnEnd = isObjectType ? range.to.col : array[3];

    if (typeof propToCol === 'function') {
      if (typeof columnStart === 'string') {
        columnStart = propToCol(columnStart);
      }
      if (typeof columnEnd === 'string') {
        columnEnd = propToCol(columnEnd);
      }
    }
    if (rowEnd === undefined) {
      rowEnd = rowStart;
    }
    if (columnEnd === undefined) {
      columnEnd = columnStart;
    }

    if (!keepDirection) {
      [rowStart, rowEnd] = [Math.min(rowStart, rowEnd), Math.max(rowStart, rowEnd)];
      [columnStart, columnEnd] = [Math.min(columnStart as number, columnEnd as number),
        Math.max(columnStart as number, columnEnd as number)];
    }

    return [rowStart, columnStart as number, rowEnd, columnEnd as number];
  };
};

/**
 * The selected rows or columns (`axis` 0 or 1 of the normalized range) as consecutive runs, smallest first:
 * `[[start, count], …]`. Ranges that overlap are merged.
 */
const transformSelectionToDistance = (selectionRanges: SelectionInput[], axis: 0 | 1): [number, number][] => {
  const selectionType = detectSelectionType(selectionRanges);

  if (selectionType === SELECTION_TYPE_UNRECOGNIZED || selectionType === SELECTION_TYPE_EMPTY) {
    return [];
  }
  const selectionSchemaNormalizer = normalizeSelectionFactory(selectionType);
  const indexes = new Set<number>();

  selectionRanges.forEach((selection) => {
    const normalized = selectionSchemaNormalizer(selection);
    const start = normalized[axis];
    const end = normalized[axis + 2];

    for (let index = start; index <= end; index += 1) {
      indexes.add(index);
    }
  });

  return [...indexes].sort((a, b) => a - b).reduce<[number, number][]>((runs, index, position, sorted) => {
    if (position !== 0 && index === sorted[position - 1] + 1) {
      runs[runs.length - 1][1] += 1;
    } else {
      runs.push([index, 1]);
    }

    return runs;
  }, []);
};

/** The selected columns as `[[visualColumnStart, count], …]`, left to right. */
export const transformSelectionToColumnDistance = (selectionRanges: SelectionInput[]): [number, number][] => (
  transformSelectionToDistance(selectionRanges, 1));

/** The selected rows as `[[visualRowStart, count], …]`, top to bottom. */
export const transformSelectionToRowDistance = (selectionRanges: SelectionInput[]): [number, number][] => (
  transformSelectionToDistance(selectionRanges, 0));

/** Whether `coord` is an index of a table with `maxTableItemsCount` rows or columns. */
export const isValidCoord = (coord: unknown, maxTableItemsCount = Infinity): boolean => typeof coord === 'number'
  && coord >= 0 && coord < maxTableItemsCount;
