/**
 * Converts any value to a string: `null` and `undefined` become `''`, everything else uses its own `toString()`.
 */
export const stringify = (value: unknown): string => {
  switch (typeof value) {
    case 'string':
    case 'number':
      return `${value}`;

    case 'object':
      return value === null ? '' : value.toString();

    case 'undefined':
      return '';

    default:
      // booleans, bigints, symbols and functions
      return (value as { toString(): string }).toString();
  }
};

/**
 * Checks if the value is defined (not `undefined`).
 */
export const isDefined = <T>(variable: T | undefined): variable is T => typeof variable !== 'undefined';

/**
 * Checks if the value is `undefined`.
 */
export const isUndefined = (variable: unknown): variable is undefined => typeof variable === 'undefined';

/**
 * Checks if the value is empty: `null`, `''` or `undefined`.
 */
export const isEmpty = (variable: unknown): boolean => variable === null || variable === '' || isUndefined(variable);

/**
 * Checks if the value is a regular expression.
 */
export const isRegExp = (variable: unknown): variable is RegExp => Object.prototype.toString.call(variable) === '[object RegExp]';
