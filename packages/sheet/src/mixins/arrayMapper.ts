import { arrayMax } from './../helpers/array';
import { defineGetter } from './../helpers/object';
import { rangeEach } from './../helpers/number';

type ReverseLookup = { queries: number; indexes: Map<number, number> | null };
const reverseLookups = new WeakMap<number[], ReverseLookup>();
const exposedMaps = new WeakSet<number[]>();
const BULK_THRESHOLD = 256;
const RENUMBER_THRESHOLD = 32;
const REVERSE_LOOKUP_THRESHOLD = 256;
const REVERSE_QUERY_THRESHOLD = 1024;

/** Call before changing an existing map in place. Replacing the array needs no invalidation. */
export function invalidateArrayMap(map: number[]): void {
  reverseLookups.delete(map);
}

/** Hooks can retain a live array and mutate it later. Such arrays must keep using indexOf. */
export function exposeArrayMap(map: number[]): void {
  if (Array.isArray(map)) {
    exposedMaps.add(map);
    invalidateArrayMap(map);
  }
}

/** Shift the tail once, keeping the array's identity and holes. Only used for ordinary insertion indexes/counts. */
function insertRange(map: number[], index: number, amount: number, firstValue: number): void {
  const length = map.length;

  map.length = length + amount;
  for (let source = length - 1; source >= index; source--) {
    if (source in map) {
      map[source + amount] = map[source];
    } else {
      delete map[source + amount];
    }
  }
  for (let offset = 0; offset < amount; offset++) {
    map[index + offset] = firstValue + offset;
  }
}

function canInsertRange(map: number[], index: number, amount: number): boolean {
  return amount >= BULK_THRESHOLD && Number.isSafeInteger(amount) &&
    Number.isInteger(index) && index >= 0 && index <= map.length;
}

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
    const map = this._arrayMap;

    if (map.length >= REVERSE_LOOKUP_THRESHOLD && Array.isArray(map) && !exposedMaps.has(map)) {
      // indexOf never matches NaN, whereas Map does.
      if (Number.isNaN(translatedIndex)) return null;
      let lookup = reverseLookups.get(map);

      if (!lookup) {
        lookup = { queries: 0, indexes: null };
        reverseLookups.set(map, lookup);
      }
      // Moving entries interleaves mutations and lookups. Do not rebuild an entire inverse for each moved entry.
      if (!lookup.indexes && ++lookup.queries >= REVERSE_QUERY_THRESHOLD) {
        const indexes = new Map<number, number>();

        for (let index = 0; index < map.length; index++) {
          if (index in map && !indexes.has(map[index])) indexes.set(map[index], index);
        }
        lookup.indexes = indexes;
      }
      if (lookup.indexes) return lookup.indexes.get(translatedIndex) ?? null;
    }
    const physicalIndex = map.indexOf(translatedIndex);

    return physicalIndex === -1 ? null : physicalIndex;
  },

  /**
   * Inserts `amount` new entries at `physicalIndex`, numbered after the largest value. Returns what `splice` returned
   * for each insertion (empty arrays), as before.
   */
  insertItems(this: ArrayMapper, physicalIndex: number, amount = 1): number[][] {
    const newIndex = (arrayMax(this._arrayMap) as number) + 1;
    const addedItems: number[][] = [];

    invalidateArrayMap(this._arrayMap);
    if (canInsertRange(this._arrayMap, physicalIndex, amount)) {
      insertRange(this._arrayMap, physicalIndex, amount, newIndex);
      for (let count = 0; count < amount; count++) addedItems.push([]);

      return addedItems;
    }
    rangeEach(amount - 1, (count) => {
      addedItems.push(this._arrayMap.splice(physicalIndex + count, 0, newIndex + count));
    });

    return addedItems;
  },

  /** Removes `amount` entries at `physicalIndex`, or the entries at each index of a list. Returns their values. */
  removeItems(this: ArrayMapper, physicalIndex: number | number[], amount = 1): number[] {
    invalidateArrayMap(this._arrayMap);
    if (!Array.isArray(physicalIndex)) {
      return this._arrayMap.splice(physicalIndex, amount);
    }
    const mapCopy = [...this._arrayMap];

    // Largest index first, so that the other indexes stay valid.
    physicalIndex.sort((a, b) => b - a);

    if (physicalIndex.length >= BULK_THRESHOLD && physicalIndex !== this._arrayMap) {
      let previous = this._arrayMap.length;
      let ordinaryIndexes = true;

      for (let index = 0; index < physicalIndex.length; index++) {
        const value = physicalIndex[index];

        if (!Number.isInteger(value) || value < 0 || value >= previous) {
          ordinaryIndexes = false;
          break;
        }
        previous = value;
      }
      if (ordinaryIndexes) {
        const removedItems = physicalIndex.map(index => mapCopy[index]);
        const map = this._arrayMap;
        let removal = physicalIndex.length - 1;
        let destination = 0;

        for (let source = 0; source < map.length; source++) {
          if (removal >= 0 && source === physicalIndex[removal]) {
            removal--;
          } else {
            if (source in map) {
              map[destination] = map[source];
            } else {
              delete map[destination];
            }
            destination++;
          }
        }
        map.length = destination;

        return removedItems;
      }
    }
    return physicalIndex.map((indexToRemove) => {
      this._arrayMap.splice(indexToRemove, 1);

      return mapCopy[indexToRemove];
    });
  },

  /** Removes entries (as `removeItems`) and lowers the values above each removed one, so that none is missing. */
  unshiftItems(this: ArrayMapper, physicalIndex: number | number[], amount = 1): void {
    const removedItems = this.removeItems(physicalIndex, amount);

    if (removedItems.length >= RENUMBER_THRESHOLD && removedItems.every(value => typeof value === 'number') &&
      this._arrayMap.every(value => typeof value === 'number')) {
      const ordered = removedItems.filter(value => !Number.isNaN(value)).sort((a, b) => a - b);

      this._arrayMap = this._arrayMap.map((logicalRow) => {
        // Count strictly smaller removed values, including duplicates, without allocating a filter per row.
        let low = 0;
        let high = ordered.length;

        while (low < high) {
          const middle = Math.floor((low + high) / 2);

          if (ordered[middle] < logicalRow) low = middle + 1;
          else high = middle;
        }

        return logicalRow - low;
      });

      return;
    }
    this._arrayMap = this._arrayMap
      .map(logicalRow => logicalRow - removedItems.filter(removed => logicalRow > removed).length);
  },

  /** Raises the values from `physicalIndex` by `amount` and inserts `amount` entries there, valued as their index. */
  shiftItems(this: ArrayMapper, physicalIndex: number, amount = 1): void {
    this._arrayMap = this._arrayMap.map(row => (row >= physicalIndex ? row + amount : row));

    if (canInsertRange(this._arrayMap, physicalIndex, amount)) {
      insertRange(this._arrayMap, physicalIndex, amount, physicalIndex);

      return;
    }
    rangeEach(amount - 1, (count) => {
      this._arrayMap.splice(physicalIndex + count, 0, physicalIndex + count);
    });
  },

  /** Moves the entry at `physicalIndexFrom` to `physicalIndexTo`. */
  swapIndexes(this: ArrayMapper, physicalIndexFrom: number, physicalIndexTo: number): void {
    invalidateArrayMap(this._arrayMap);
    this._arrayMap.splice(physicalIndexTo, 0, ...this._arrayMap.splice(physicalIndexFrom, 1));
  },

  clearMap(this: ArrayMapper): void {
    invalidateArrayMap(this._arrayMap);
    this._arrayMap.length = 0;
  },
};

defineGetter(arrayMapper, 'MIXIN_NAME', 'arrayMapper', {
  writable: false,
  enumerable: false,
});

export default arrayMapper;
