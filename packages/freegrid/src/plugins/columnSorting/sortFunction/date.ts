import { parseDate } from '../../../helpers/dateFormat';
import { isEmpty } from '../../../helpers/mixed';
import { DO_NOT_SWAP, FIRST_BEFORE_SECOND, FIRST_AFTER_SECOND } from '../sortService';
import type { CompareFunctionFactory } from '../utils';

/**
 * Date sorting compare function factory. Method get as parameters `sortOrder` and `columnMeta` and return compare function.
 *
 * @param sortOrder Sort order (`asc` for ascending, `desc` for descending).
 * @param columnMeta Column meta object.
 * @param columnPluginSettings Plugin settings for the column.
 * @returns The compare function.
 */
export const compareFunctionFactory: CompareFunctionFactory = (sortOrder, columnMeta, columnPluginSettings) => (
  (value, nextValue) => {
    const { sortEmptyCells } = columnPluginSettings;

    if (value === nextValue) {
      return DO_NOT_SWAP;
    }

    if (isEmpty(value)) {
      if (isEmpty(nextValue)) {
        return DO_NOT_SWAP;
      }

      // Just fist value is empty and `sortEmptyCells` option was set
      if (sortEmptyCells) {
        return sortOrder === 'asc' ? FIRST_BEFORE_SECOND : FIRST_AFTER_SECOND;
      }

      return FIRST_AFTER_SECOND;
    }

    if (isEmpty(nextValue)) {
      // Just second value is empty and `sortEmptyCells` option was set
      if (sortEmptyCells) {
        return sortOrder === 'asc' ? FIRST_AFTER_SECOND : FIRST_BEFORE_SECOND;
      }

      return FIRST_BEFORE_SECOND;
    }

    const dateFormat = columnMeta.dateFormat as string | undefined;
    const firstDate = parseDate(value as string, dateFormat);
    const nextDate = parseDate(nextValue as string, dateFormat);

    if (!firstDate) {
      return FIRST_AFTER_SECOND;
    }

    if (!nextDate) {
      return FIRST_BEFORE_SECOND;
    }

    if (nextDate > firstDate) {
      return sortOrder === 'asc' ? FIRST_BEFORE_SECOND : FIRST_AFTER_SECOND;
    }

    if (nextDate < firstDate) {
      return sortOrder === 'asc' ? FIRST_AFTER_SECOND : FIRST_BEFORE_SECOND;
    }

    return DO_NOT_SWAP;
  });

export const COLUMN_DATA_TYPE = 'date';
