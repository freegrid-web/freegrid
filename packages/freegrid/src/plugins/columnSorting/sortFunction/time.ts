import { temporalCompareFunctionFactory } from './date';

/** Time sorting compare function factory: the column's `timeFormat` (default `h:mm:ss a`, as the time cell type). */
export const compareFunctionFactory = temporalCompareFunctionFactory('timeFormat', 'h:mm:ss a');

export const COLUMN_DATA_TYPE = 'time';
