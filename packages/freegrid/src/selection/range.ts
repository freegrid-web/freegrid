import { CellRange } from './../3rdparty/walkontable/src';
import type { CellCoords } from './../3rdparty/walkontable/src';

/**
 * The ranges of a selection, oldest first: one for a simple selection, several for a non-consecutive one (with Ctrl).
 */
class SelectionRange {
  ranges: CellRange[] = [];

  isEmpty(): boolean {
    return this.size() === 0;
  }

  /** Replaces the ranges with one starting at `coords`. */
  set(coords: CellCoords): this {
    this.clear();
    this.ranges.push(new CellRange(coords));

    return this;
  }

  /** Adds a range starting at `coords`. */
  add(coords: CellCoords): this {
    this.ranges.push(new CellRange(coords));

    return this;
  }

  /** The last added range. */
  current(): CellRange | undefined {
    return this.peekByIndex(0);
  }

  /** The range added before the last one. */
  previous(): CellRange | undefined {
    return this.peekByIndex(-1);
  }

  /** Whether `coords` is in any range. */
  includes(coords: CellCoords): boolean {
    return this.ranges.some(cellRange => cellRange.includes(coords));
  }

  clear(): this {
    this.ranges.length = 0;

    return this;
  }

  size(): number {
    return this.ranges.length;
  }

  /** The range `offset` places before the last one (0: the last). */
  peekByIndex(offset = 0): CellRange | undefined {
    const rangeIndex = this.size() + offset - 1;

    return rangeIndex >= 0 ? this.ranges[rangeIndex] : undefined;
  }

  [Symbol.iterator](): Iterator<CellRange> {
    return this.ranges[Symbol.iterator]();
  }
}

export default SelectionRange;
