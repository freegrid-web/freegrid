import { isEmpty } from '../../../helpers/mixed';
import { DO_NOT_SWAP, FIRST_BEFORE_SECOND, FIRST_AFTER_SECOND } from '../sortService';
import type { CompareFunctionFactory } from '../utils';

/**
 * Default sorting compare function factory. Method get as parameters `sortOrder` and `columnMeta` and return compare function.
 *
 * @param sortOrder Sort order (`asc` for ascending, `desc` for descending).
 * @param columnMeta Column meta object.
 * @param columnPluginSettings Plugin settings for the column.
 * @returns The compare function.
 */
export const compareFunctionFactory: CompareFunctionFactory = (sortOrder, columnMeta, columnPluginSettings) => (
  (firstValue, secondValue) => {
    const { sortEmptyCells } = columnPluginSettings;
    // Strings compare case-insensitively; values that are numbers (also as strings) compare as numbers.
    let value = typeof firstValue === 'string' ? firstValue.toLowerCase() : firstValue;
    let nextValue = typeof secondValue === 'string' ? secondValue.toLowerCase() : secondValue;
    const notNumber = (item: unknown) => Number.isNaN(Number(item));

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

    if (notNumber(value) && !notNumber(nextValue)) {
      return sortOrder === 'asc' ? FIRST_AFTER_SECOND : FIRST_BEFORE_SECOND;

    } else if (!notNumber(value) && notNumber(nextValue)) {
      return sortOrder === 'asc' ? FIRST_BEFORE_SECOND : FIRST_AFTER_SECOND;

    } else if (!(notNumber(value) || notNumber(nextValue))) {
      value = parseFloat(value as string);
      nextValue = parseFloat(nextValue as string);
    }

    if ((value as number) < (nextValue as number)) {
      return sortOrder === 'asc' ? FIRST_BEFORE_SECOND : FIRST_AFTER_SECOND;
    }

    if ((value as number) > (nextValue as number)) {
      return sortOrder === 'asc' ? FIRST_AFTER_SECOND : FIRST_BEFORE_SECOND;
    }

    return DO_NOT_SWAP;
  });

export const COLUMN_DATA_TYPE = 'default';
