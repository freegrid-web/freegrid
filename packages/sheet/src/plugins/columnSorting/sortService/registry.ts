import { compareFunctionFactory as defaultSort, COLUMN_DATA_TYPE as DEFAULT_DATA_TYPE } from '../sortFunction/default';
import { compareFunctionFactory as numericSort, COLUMN_DATA_TYPE as NUMERIC_DATA_TYPE } from '../sortFunction/numeric';
import { compareFunctionFactory as dateSort, COLUMN_DATA_TYPE as DATE_DATA_TYPE } from '../sortFunction/date';
import { compareFunctionFactory as timeSort, COLUMN_DATA_TYPE as TIME_DATA_TYPE } from '../sortFunction/time';
import staticRegister from '../../../utils/staticRegister';
import type { CompareFunctionFactory } from '../utils';

/** Makes the comparator of two rows for `Array.prototype.sort` (each root comparator takes its own arguments). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each root comparator takes its own arguments and rows
export type RootComparatorFactory = (...args: any[]) => (row: any, nextRow: any) => number;

const {
  register: registerCompareFunctionFactory,
  getItem: getGloballyCompareFunctionFactory,
  hasItem: hasGloballyCompareFunctionFactory,
} = staticRegister<CompareFunctionFactory>('sorting.compareFunctionFactory');

const {
  register: registerRootComparator,
  getItem: getRootComparator,
} = staticRegister<RootComparatorFactory>('sorting.mainSortComparator');

/**
 * Gets sort function for the particular column basing on it's data type (the default one for other types).
 *
 * @param type Data type for the particular column.
 */
export const getCompareFunctionFactory = (type: string): CompareFunctionFactory => (
  getGloballyCompareFunctionFactory(hasGloballyCompareFunctionFactory(type) ? type : DEFAULT_DATA_TYPE)!);

registerCompareFunctionFactory(NUMERIC_DATA_TYPE, numericSort);
registerCompareFunctionFactory(DATE_DATA_TYPE, dateSort);
registerCompareFunctionFactory(TIME_DATA_TYPE, timeSort);
registerCompareFunctionFactory(DEFAULT_DATA_TYPE, defaultSort);

export {
  registerRootComparator,
  getRootComparator
};
