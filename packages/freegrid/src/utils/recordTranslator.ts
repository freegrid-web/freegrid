import Core from './../core';
import { isObject } from './../helpers/object';

/** What the translator needs from a grid: its index hooks. */
type HooksRunner = { runHooks(name: string, index: number): number };
type Coords = { row: number; column: number };

/**
 * Translates between visual indexes (what the user sees, e.g. after sorting) and physical indexes (the data source).
 */
export class RecordTranslator {
  hot: HooksRunner;

  constructor(hot: HooksRunner) {
    this.hot = hot;
  }

  toVisualRow(row: number): number {
    return this.hot.runHooks('unmodifyRow', row);
  }

  toVisualColumn(column: number): number {
    return this.hot.runHooks('unmodifyCol', column);
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

  toPhysicalRow(row: number): number {
    return this.hot.runHooks('modifyRow', row);
  }

  toPhysicalColumn(column: number): number {
    return this.hot.runHooks('modifyCol', column);
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
  const instance = identity instanceof Core ? identity as unknown as HooksRunner : getIdentity(identity);
  let translator = translatorSingletons.get(instance);

  if (!translator) {
    translator = new RecordTranslator(instance);
    translatorSingletons.set(instance, translator);
  }

  return translator;
};
