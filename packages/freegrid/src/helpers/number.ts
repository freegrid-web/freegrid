/** Called with each index; returning `false` stops the iteration. */
export type RangeIteratee = (index: number) => unknown;

/**
 * Checks if a value is numeric: a finite number, a `Number` object, or a string in decimal, exponent or hex
 * notation (surrounding whitespace allowed). Dates are not numeric.
 */
export function isNumeric(value: unknown): boolean {
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (typeof value === 'string') {
    if (value.length === 0) {
      return false;
    }
    if (value.length === 1) {
      return /\d/.test(value);
    }

    return /^\s*[+-]?\s*(?:(?:\d+(?:\.\d+)?(?:e[+-]?\d+)?)|(?:0x[a-f\d]+))\s*$/i.test(value);
  }
  if (typeof value === 'object' && value !== null) {
    return typeof value.valueOf() === 'number' && !(value instanceof Date);
  }

  return false;
}

/**
 * Calls `iteratee` for each index from `rangeFrom` to `rangeTo`, both included. With two arguments, iterates
 * from 0 to the first argument.
 */
export function rangeEach(rangeTo: number, iteratee: RangeIteratee): void;
export function rangeEach(rangeFrom: number, rangeTo: number, iteratee: RangeIteratee): void;
export function rangeEach(rangeFrom: number, rangeTo: number | RangeIteratee, iteratee?: RangeIteratee): void {
  let from = rangeFrom;
  let to: number;
  let callback: RangeIteratee;

  if (typeof rangeTo === 'function') {
    from = 0;
    to = rangeFrom;
    callback = rangeTo;
  } else {
    to = rangeTo;
    // The overloads require an iteratee whenever `rangeTo` is a number.
    callback = iteratee as RangeIteratee;
  }
  // `from - 1` then `++index` (not `index = from`) keeps the original coercion of a non-number start from JS callers.
  let index = from - 1;

  while (++index <= to) {
    if (callback(index) === false) {
      break;
    }
  }
}

/**
 * Calls `iteratee` for each index from `rangeFrom` down to `rangeTo`, both included. With two arguments,
 * iterates down to 0.
 */
export function rangeEachReverse(rangeFrom: number, iteratee: RangeIteratee): void;
export function rangeEachReverse(rangeFrom: number, rangeTo: number, iteratee: RangeIteratee): void;
export function rangeEachReverse(rangeFrom: number, rangeTo: number | RangeIteratee, iteratee?: RangeIteratee): void {
  let to: number;
  let callback: RangeIteratee;

  if (typeof rangeTo === 'function') {
    to = 0;
    callback = rangeTo;
  } else {
    to = rangeTo;
    // The overloads require an iteratee whenever `rangeTo` is a number.
    callback = iteratee as RangeIteratee;
  }
  // `rangeFrom + 1` then `--index` keeps the original coercion of a non-number start from JS callers.
  let index = rangeFrom + 1;

  while (--index >= to) {
    if (callback(index) === false) {
      break;
    }
  }
}

/**
 * Returns `percent` of `value`, truncated to an integer. `percent` is a number or a string such as `'33%'`;
 * its fraction is dropped first.
 */
export function valueAccordingPercent(value: number, percent: string | number): number {
  const wholePercent = parseInt(percent.toString().replace('%', ''), 10);

  return parseInt(String(value * wholePercent / 100), 10);
}
