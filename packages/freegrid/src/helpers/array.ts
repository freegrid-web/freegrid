/**
 * Array helpers. Unlike the built-in methods, the iteration helpers accept array-likes (they are copied with
 * `Array.from`) and visit every index up to the starting length, holes included (as `undefined`).
 */

export type ArrayIteratee<T, R> = (value: T, index: number, array: T[]) => R;

type ArrayInput<T> = ArrayLike<T> | Iterable<T>;

const toArray = <T>(array: ArrayInput<T>): T[] => (Array.isArray(array) ? array : Array.from(array));

/**
 * Wraps every item of `arr` in an array, in place (`[1, 2]` becomes `[[1], [2]]`).
 */
export const to2dArray = (arr: unknown[]): void => {
  for (let i = 0; i < arr.length; i++) {
    arr[i] = [arr[i]];
  }
};

/**
 * Appends the items of `extension` to `arr`, in place.
 */
export const extendArray = <T>(arr: T[], extension: ArrayLike<T>): void => {
  const length = extension.length;

  for (let i = 0; i < length; i++) {
    arr.push(extension[i]);
  }
};

/**
 * Transposes a 2D array (rows become columns).
 */
export const pivot = <T>(arr: T[][]): T[][] => {
  const pivotedArr: T[][] = [];

  if (!arr || arr.length === 0 || !arr[0] || arr[0].length === 0) {
    return pivotedArr;
  }

  const rowCount = arr.length;
  const colCount = arr[0].length;

  for (let i = 0; i < rowCount; i++) {
    for (let j = 0; j < colCount; j++) {
      if (!pivotedArr[j]) {
        pivotedArr[j] = [];
      }

      pivotedArr[j][i] = arr[i][j];
    }
  }

  return pivotedArr;
};

/**
 * Reduces `array` to one value. With `initFromArray`, the first item is the initial value instead of `accumulator`.
 */
export const arrayReduce = <T, A>(
  array: ArrayInput<T>,
  iteratee: (accumulator: A, value: T, index: number, array: T[]) => A,
  accumulator: A,
  initFromArray = false,
): A => {
  const items = toArray(array);
  const length = items.length;
  let index = 0;
  let result = accumulator;

  if (initFromArray && length) {
    // The caller asks for the first item as the start value, so here A is T.
    result = items[0] as unknown as A;
    index = 1;
  }

  for (; index < length; index++) {
    result = iteratee(result, items[index], index, items);
  }

  return result;
};

/**
 * Returns the items for which `predicate` returns a truthy value.
 */
export const arrayFilter = <T>(array: ArrayInput<T>, predicate: ArrayIteratee<T, unknown>): T[] => {
  const items = toArray(array);
  const length = items.length;
  const result: T[] = [];

  for (let index = 0; index < length; index++) {
    const value = items[index];

    if (predicate(value, index, items)) {
      result.push(value);
    }
  }

  return result;
};

/**
 * Returns the results of calling `iteratee` for every item.
 */
export const arrayMap = <T, R>(array: ArrayInput<T>, iteratee: ArrayIteratee<T, R>): R[] => {
  const items = toArray(array);
  const length = items.length;
  const result: R[] = [];

  for (let index = 0; index < length; index++) {
    result.push(iteratee(items[index], index, items));
  }

  return result;
};

/**
 * Calls `iteratee` for every item; stops when it returns `false`. Returns `array` itself.
 */
export const arrayEach = <T>(array: ArrayInput<T>, iteratee: ArrayIteratee<T, unknown>): ArrayInput<T> => {
  const items = toArray(array);
  const length = items.length;

  for (let index = 0; index < length; index++) {
    if (iteratee(items[index], index, items) === false) {
      break;
    }
  }

  return array;
};

/**
 * Sums the items (with `+`, so strings concatenate).
 */
export const arraySum = (array: ArrayInput<number>): number => arrayReduce(array, (a, b) => a + b, 0);

// `>` and `<` compare any values the way JavaScript does; the casts only let the type checker accept that.
type Loose = number;

/**
 * Returns the largest item (compared with `>`), or `undefined` when `array` is not a real array.
 */
export const arrayMax = <T>(array: ArrayInput<T>): T | undefined =>
  arrayReduce<T, T | undefined>(array, (a, b) => ((a as Loose) > (b as Loose) ? a : b), Array.isArray(array) ? array[0] : undefined);

/**
 * Returns the smallest item (compared with `<`), or `undefined` when `array` is not a real array.
 */
export const arrayMin = <T>(array: ArrayInput<T>): T | undefined =>
  arrayReduce<T, T | undefined>(array, (a, b) => ((a as Loose) < (b as Loose) ? a : b), Array.isArray(array) ? array[0] : undefined);

/**
 * Returns the average of the items, or 0 for an empty array.
 */
export const arrayAvg = (array: ArrayLike<number>): number => {
  if (!array.length) {
    return 0;
  }

  return arraySum(array) / array.length;
};

/**
 * Flattens nested arrays into one array (any depth).
 */
export const arrayFlatten = (array: ArrayInput<unknown>): unknown[] =>
  arrayReduce<unknown, unknown[]>(array, (initial, value) => initial.concat(Array.isArray(value) ? arrayFlatten(value) : value), []);

/**
 * Returns the items without duplicates (compared with `indexOf`), in first-seen order.
 */
export const arrayUnique = <T>(array: ArrayInput<T>): T[] => {
  const unique: T[] = [];

  arrayEach(array, (value: T) => {
    if (unique.indexOf(value) === -1) {
      unique.push(value);
    }
  });

  return unique;
};
