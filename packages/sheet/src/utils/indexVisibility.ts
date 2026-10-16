/**
 * Which rows (or columns) are hidden, and the visual order without them. Several sources can hide indexes (hidden
 * rows, filters, collapsed nested rows, …); an index is visible when no source hides it.
 *
 * Three kinds of index:
 * - physical: the index in the data; sources hide physical indexes, so a hidden row stays hidden when rows are sorted;
 * - ordered: the index after sorting and moving (what the visual index was before anything was hidden);
 * - visual: the index of a visible row, as the grid draws it.
 *
 * While nothing is hidden the map is the identity and costs nothing. Otherwise the two lookups are kept in arrays,
 * built again on the first lookup after a change.
 */
export class IndexVisibility {
  /** The number of ordered indexes. */
  #getTotal: () => number;
  /** Ordered index → physical index; `null` while they are the same (nothing sorted or moved). */
  #toPhysical: () => ((ordered: number) => number) | null;
  #sources = new Map<string, Set<number>>();
  /** Visual → ordered, for the visible indexes. */
  #visualToOrdered: Int32Array | null = null;
  /** Ordered → visual, −1 for a hidden index. */
  #orderedToVisual: Int32Array | null = null;
  #builtTotal = -1;

  constructor(getTotal: () => number, toPhysical: () => ((ordered: number) => number) | null) {
    this.#getTotal = getTotal;
    this.#toPhysical = toPhysical;
  }

  /** Whether any source hides an index. */
  isActive(): boolean {
    return this.#sources.size > 0;
  }

  /** Sets which physical indexes a source hides (`null` or none: the source hides nothing). */
  setHidden(source: string, physicalIndexes: Iterable<number> | null): void {
    const indexes = new Set(physicalIndexes || []);

    if (indexes.size) {
      this.#sources.set(source, indexes);
    } else {
      this.#sources.delete(source);
    }
    this.invalidate();
  }

  /** The physical indexes a source hides, in ascending order. */
  getHidden(source: string): number[] {
    return Array.from(this.#sources.get(source) || []).sort((a, b) => a - b);
  }

  isHidden(physicalIndex: number): boolean {
    for (const indexes of this.#sources.values()) {
      if (indexes.has(physicalIndex)) {
        return true;
      }
    }

    return false;
  }

  isHiddenBy(source: string, physicalIndex: number): boolean {
    return !!this.#sources.get(source)?.has(physicalIndex);
  }

  /** Marks the lookups for a rebuild (after sorting or moving, or when a source changes). */
  invalidate(): void {
    this.#visualToOrdered = null;
    this.#orderedToVisual = null;
  }

  /** The number of indexes, hidden ones included. */
  total(): number {
    return this.#getTotal();
  }

  /** The number of visible indexes. */
  count(): number {
    const total = this.#getTotal();

    return this.isActive() ? this.#build(total).length : total;
  }

  /**
   * Visual → ordered. Header indexes (negative) stay as they are; an index past the last visible one (as when rows are
   * added at the end) keeps its distance from the end.
   */
  toOrdered(visual: number): number {
    if (!this.isActive() || visual < 0) {
      return visual;
    }
    const total = this.#getTotal();
    const visualToOrdered = this.#build(total);

    return visual < visualToOrdered.length ? visualToOrdered[visual] : total + visual - visualToOrdered.length;
  }

  /** Ordered → visual; `null` for a hidden index. */
  toVisual(ordered: number): number | null {
    if (!this.isActive() || ordered < 0) {
      return ordered;
    }
    const total = this.#getTotal();
    const visualToOrdered = this.#build(total);

    if (ordered >= total) {
      return visualToOrdered.length + ordered - total;
    }
    const visual = this.#orderedToVisual![ordered];

    return visual === -1 ? null : visual;
  }

  /** Shifts the hidden indexes after `amount` physical indexes were inserted at `physicalIndex`. */
  onInsert(physicalIndex: number, amount: number): void {
    this.#remap(index => (index >= physicalIndex ? index + amount : index));
  }

  /** Drops the removed physical indexes and shifts the ones after them. */
  onRemove(physicalIndexes: number[]): void {
    const removed = [...new Set(physicalIndexes)].sort((a, b) => a - b);

    this.#remap((index) => {
      let below = 0;

      for (const removedIndex of removed) {
        if (removedIndex === index) {
          return null;
        }
        if (removedIndex > index) {
          break;
        }
        below += 1;
      }

      return index - below;
    });
  }

  #remap(map: (index: number) => number | null): void {
    if (!this.isActive()) {
      return;
    }
    for (const [source, indexes] of Array.from(this.#sources)) {
      const moved = new Set<number>();

      indexes.forEach((index) => {
        const next = map(index);

        if (next !== null) {
          moved.add(next);
        }
      });
      if (moved.size) {
        this.#sources.set(source, moved);
      } else {
        this.#sources.delete(source);
      }
    }
    this.invalidate();
  }

  #build(total: number): Int32Array {
    if (this.#visualToOrdered && this.#builtTotal === total) {
      return this.#visualToOrdered;
    }
    const orderedToVisual = new Int32Array(total);
    const visualToOrdered = new Int32Array(total);
    const toPhysical = this.#toPhysical();
    const sources = Array.from(this.#sources.values());
    let count = 0;

    for (let ordered = 0; ordered < total; ordered += 1) {
      const physical = toPhysical ? toPhysical(ordered) : ordered;
      let hidden = false;

      for (let i = 0; i < sources.length && !hidden; i += 1) {
        hidden = sources[i].has(physical);
      }
      if (hidden) {
        orderedToVisual[ordered] = -1;
      } else {
        orderedToVisual[ordered] = count;
        visualToOrdered[count] = ordered;
        count += 1;
      }
    }
    this.#visualToOrdered = visualToOrdered.subarray(0, count);
    this.#orderedToVisual = orderedToVisual;
    this.#builtTotal = total;

    return this.#visualToOrdered;
  }
}
