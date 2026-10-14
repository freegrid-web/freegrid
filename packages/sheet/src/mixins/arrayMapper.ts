import { arrayMax } from './../helpers/array';
import { defineGetter } from './../helpers/object';
import { rangeEach } from './../helpers/number';

/** What `arrayMapper` adds to a class (with `mixin(Class, arrayMapper)`). */
export type ArrayMapper = {
  _arrayMap: number[];
  getValueByIndex(physicalIndex: number): number | null;
  getIndexByValue(translatedIndex: number): number | null;
  insertItems(physicalIndex: number, amount?: number): number[][];
  removeItems(physicalIndex: number | number[], amount?: number): number[];
  unshiftItems(physicalIndex: number | number[], amount?: number): void;
  shiftItems(physicalIndex: number, amount?: number): void;
  swapIndexes(physicalIndexFrom: number, physicalIndexTo: number): void;
  clearMap(): void;
};

/**
 * Maps indexes to other indexes (e.g. physical rows to moved or sorted rows) in `_arrayMap`: the value at a physical
 * index is its translated index.
 */
const arrayMapper = {
  _arrayMap: [] as number[],

  /** The translated index of `physicalIndex`, or `null` past the end. */
  getValueByIndex(this: ArrayMapper, physicalIndex: number): number | null {
    return physicalIndex < this._arrayMap.length ? this._arrayMap[physicalIndex] : null;
  },

  /** The physical index of `translatedIndex`, or `null`. */
  getIndexByValue(this: ArrayMapper, translatedIndex: number): number | null {
    const physicalIndex = this._arrayMap.indexOf(translatedIndex);

    return physicalIndex === -1 ? null : physicalIndex;
  },

  /**
   * Inserts `amount` new entries at `physicalIndex`, numbered after the largest value. Returns what `splice` returned
   * for each insertion (empty arrays), as before.
   */
  insertItems(this: ArrayMapper, physicalIndex: number, amount = 1): number[][] {
    const newIndex = (arrayMax(this._arrayMap) as number) + 1;
    const addedItems: number[][] = [];

    rangeEach(amount - 1, (count) => {
      addedItems.push(this._arrayMap.splice(physicalIndex + count, 0, newIndex + count));
    });

    return addedItems;
  },

  /** Removes `amount` entries at `physicalIndex`, or the entries at each index of a list. Returns their values. */
  removeItems(this: ArrayMapper, physicalIndex: number | number[], amount = 1): number[] {
    if (!Array.isArray(physicalIndex)) {
      return this._arrayMap.splice(physicalIndex, amount);
    }
    const mapCopy = [...this._arrayMap];

    // Largest index first, so that the other indexes stay valid.
    physicalIndex.sort((a, b) => b - a);

    return physicalIndex.map((indexToRemove) => {
      this._arrayMap.splice(indexToRemove, 1);

      return mapCopy[indexToRemove];
    });
  },

  /** Removes entries (as `removeItems`) and lowers the values above each removed one, so that none is missing. */
  unshiftItems(this: ArrayMapper, physicalIndex: number | number[], amount = 1): void {
    const removedItems = this.removeItems(physicalIndex, amount);

    this._arrayMap = this._arrayMap
      .map(logicalRow => logicalRow - removedItems.filter(removed => logicalRow > removed).length);
  },

  /** Raises the values from `physicalIndex` by `amount` and inserts `amount` entries there, valued as their index. */
  shiftItems(this: ArrayMapper, physicalIndex: number, amount = 1): void {
    this._arrayMap = this._arrayMap.map(row => (row >= physicalIndex ? row + amount : row));

    rangeEach(amount - 1, (count) => {
      this._arrayMap.splice(physicalIndex + count, 0, physicalIndex + count);
    });
  },

  /** Moves the entry at `physicalIndexFrom` to `physicalIndexTo`. */
  swapIndexes(this: ArrayMapper, physicalIndexFrom: number, physicalIndexTo: number): void {
    this._arrayMap.splice(physicalIndexTo, 0, ...this._arrayMap.splice(physicalIndexFrom, 1));
  },

  clearMap(this: ArrayMapper): void {
    this._arrayMap.length = 0;
  },
};

defineGetter(arrayMapper, 'MIXIN_NAME', 'arrayMapper', {
  writable: false,
  enumerable: false,
});

export default arrayMapper;
