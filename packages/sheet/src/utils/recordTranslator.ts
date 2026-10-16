import Core from './../core';
import { isObject } from './../helpers/object';
import type { IndexVisibility } from './indexVisibility';

/** What the translator needs from a grid: its index hooks. */
type HooksRunner = { runHooks(name: string, index: number, source?: string): number };
type Coords = { row: number; column: number };

/**
 * Translates between visual indexes (what the user sees, e.g. after sorting) and physical indexes (the data source).
 */
export class RecordTranslator {
  hot: HooksRunner;
  /** The hidden rows and columns (set by the grid); visual indexes skip them. */
  rows: IndexVisibility | null = null;
  columns: IndexVisibility | null = null;

  constructor(hot: HooksRunner) {
    this.hot = hot;
  }

  #run(name: string, index: number, source?: string): number {
    return source === void 0 ? this.hot.runHooks(name, index) : this.hot.runHooks(name, index, source);
  }

  /** Physical → visual; `null` for a hidden row. `source` is passed to the hooks (a plugin skips its own map). */
  toVisualRow(row: number, source?: string): number {
    const ordered = this.#run('unmodifyRow', row, source);

    return this.rows && ordered !== null ? this.rows.toVisual(ordered) as number : ordered;
  }

  toVisualColumn(column: number, source?: string): number {
    const ordered = this.#run('unmodifyCol', column, source);

    return this.columns && ordered !== null ? this.columns.toVisual(ordered) as number : ordered;
  }

  /**
   * Physical coordinates to visual: `{ row, column }` gives an object, `(row, column)` an array.
   */
  toVisual(row: number | Coords, column?: number): Coords | [number, number] {
    if (isObject(row)) {
      const coords = row as Coords;

      return { row: this.toVisualRow(coords.row), column: this.toVisualColumn(coords.column) };
    }

    return [this.toVisualRow(row as number), this.toVisualColumn(column as number)];
  }

  /** Visual → physical. `source` is passed to the hooks (a plugin skips its own map). */
  toPhysicalRow(row: number, source?: string): number {
    return this.#run('modifyRow', this.rows ? this.rows.toOrdered(row) : row, source);
  }

  toPhysicalColumn(column: number, source?: string): number {
    return this.#run('modifyCol', this.columns ? this.columns.toOrdered(column) : column, source);
  }

  /**
   * Visual coordinates to physical: `{ row, column }` gives an object, `(row, column)` an array.
   */
  toPhysical(row: number | Coords, column?: number): Coords | [number, number] {
    if (isObject(row)) {
      const coords = row as Coords;

      return { row: this.toPhysicalRow(coords.row), column: this.toPhysicalColumn(coords.column) };
    }

    return [this.toPhysicalRow(row as number), this.toPhysicalColumn(column as number)];
  }
}

const identities = new WeakMap<object, HooksRunner>();
const translatorSingletons = new WeakMap<object, RecordTranslator>();

/** Lets an object (e.g. a plugin) use the translator of `hot`. */
export const registerIdentity = (identity: object, hot: HooksRunner): void => {
  identities.set(identity, hot);
};

/** The grid registered for `identity`; throws when there is none. */
export const getIdentity = (identity: object): HooksRunner => {
  if (!identities.has(identity)) {
    throw Error('Record translator was not registered for this object identity');
  }

  return identities.get(identity) as HooksRunner;
};

/** The translator of a grid, or of the grid registered for `identity` (one translator per grid). */
export const getTranslator = (identity: object): RecordTranslator => {
  // A grid, or an object that runs hooks as a grid does; otherwise the grid registered for the object.
  const runsHooks = identity instanceof Core || typeof (identity as Partial<HooksRunner>).runHooks === 'function';
  const instance = runsHooks ? identity as unknown as HooksRunner : getIdentity(identity);
  let translator = translatorSingletons.get(instance);

  if (!translator) {
    translator = new RecordTranslator(instance);
    translatorSingletons.set(instance, translator);
  }

  return translator;
};
