import { getCompareFunctionFactory } from './sortService';
import type { CompareFunctionFactory, SortOrder, SortSettings } from './utils';

/** A row to sort: `[rowIndex, value]` (the sorted column's value). */
export type RowWithValues = [number, ...unknown[]];

/**
 * Sort comparator handled by conventional sort algorithm: compares the sorted column's values of two rows, with the
 * column's compare function (its `compareFunctionFactory` setting, or the one of its type).
 *
 * @param sortingOrders Sort orders (`asc` for ascending, `desc` for descending).
 * @param columnMetas Column meta objects.
 */
// eslint-disable-next-line import/prefer-default-export
export const rootComparator = (sortingOrders: SortOrder[], columnMetas: Record<string, unknown>[]) => (
  [, ...values]: RowWithValues, [, ...nextValues]: RowWithValues): number => {
  // Only the first column: ColumnSorting sorts by one column.
  const columnMeta = columnMetas[0];
  const pluginSettings = columnMeta.columnSorting as SortSettings;
  const compareFunctionFactory: CompareFunctionFactory = pluginSettings.compareFunctionFactory ||
    getCompareFunctionFactory(columnMeta.type as string);

  return compareFunctionFactory(sortingOrders[0], columnMeta, pluginSettings)(values[0], nextValues[0]);
};
