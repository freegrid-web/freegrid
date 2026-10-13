import { isObject } from '../../helpers/object';
import { isRightClick } from '../../helpers/dom/event';

export const ASC_SORT_STATE = 'asc';
export const DESC_SORT_STATE = 'desc';
export const HEADER_SPAN_CLASS = 'colHeader';

/** A sort order: `asc` (ascending) or `desc` (descending). */
export type SortOrder = typeof ASC_SORT_STATE | typeof DESC_SORT_STATE;

/** A sorted column: its physical index and order. */
export type ColumnSortState = { column: number; sortOrder: SortOrder };

/** Compares two cell values: `-1` keeps the first before the second, `1` after it, `0` keeps their order. */
export type CompareFunction = (value: unknown, nextValue: unknown) => number;

/** The `columnSorting` settings that affect the order (for all columns, or one column's own). */
export type SortSettings = {
  sortEmptyCells?: boolean;
  indicator?: boolean;
  headerAction?: boolean;
  compareFunctionFactory?: CompareFunctionFactory;
};

/** Makes the compare function of a column (from its order, meta and sort settings). */
export type CompareFunctionFactory = (sortOrder: SortOrder, columnMeta: Record<string, unknown>,
  columnPluginSettings: SortSettings) => CompareFunction;

/**
 * Get if column state is valid.
 *
 * @param columnState Particular column state.
 */
const isValidColumnState = (columnState: unknown): boolean => {
  if (columnState === undefined) {
    return false;
  }
  const { column, sortOrder } = columnState as ColumnSortState;

  return Number.isInteger(column) && [ASC_SORT_STATE, DESC_SORT_STATE].includes(sortOrder);
};

/**
 * Get if all sorted columns states are valid: objects with an integer `column` (each column once) and `asc`/`desc`.
 */
export const areValidSortStates = (sortStates: unknown): sortStates is ColumnSortState[] => {
  if (!Array.isArray(sortStates) || !sortStates.every(columnState => isObject(columnState))) {
    return false;
  }
  const sortedColumns = sortStates.map(({ column }) => column);
  const indexOccursOnlyOnce = new Set(sortedColumns).size === sortedColumns.length;

  return indexOccursOnlyOnce && sortStates.every(isValidColumnState);
};

/**
 * Get next sort order for particular column. The order sequence looks as follows: 'asc' -> 'desc' -> undefined -> 'asc'
 *
 * @param sortOrder sort order (`asc` for ascending, `desc` for descending and undefined for not sorted).
 * @returns Next sort order (`asc` for ascending, `desc` for descending and undefined for not sorted).
 */
export const getNextSortOrder = (sortOrder?: SortOrder): SortOrder | undefined => {
  if (sortOrder === DESC_SORT_STATE) {
    return undefined;
  }

  return sortOrder === ASC_SORT_STATE ? DESC_SORT_STATE : ASC_SORT_STATE;
};

/**
 * Get `span` DOM element inside `th` DOM element.
 *
 * @param TH th HTML element.
 */
export const getHeaderSpanElement = (TH: Element): Element | null => TH.querySelector(`.${HEADER_SPAN_CLASS}`);

/**
 * Get if handled header is first level column header (the last header row).
 *
 * @param column Visual column index.
 * @param TH th HTML element.
 */
export const isFirstLevelColumnHeader = (column: number, TH: Element): boolean => {
  if (column < 0 || !TH.parentNode) {
    return false;
  }
  const TRs = TH.parentNode.parentNode!.childNodes;

  return Array.from(TRs).indexOf(TH.parentNode as unknown as ChildNode) - TRs.length === -1;
};

/**
 *  Get if header was clicked properly. Click on column header and NOT done by right click return `true`.
 *
 * @param row Visual row index.
 * @param column Visual column index.
 * @param clickEvent Click event.
 */
export const wasHeaderClickedProperly = (row: number, column: number, clickEvent: MouseEvent): boolean => (
  row === -1 && column >= 0 && !isRightClick(clickEvent));
