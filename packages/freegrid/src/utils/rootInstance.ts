/**
 * Marks the grid instances created by users (root instances), as opposed to the grids FreeGrid creates inside its
 * own UI (e.g. the context menu).
 */
export const holder = new WeakMap<object, true>();

export const rootInstanceSymbol = Symbol('rootInstance');

export const registerAsRootInstance = (object: object): void => {
  holder.set(object, true);
};

/** Whether `rootSymbol` is the symbol that may mark a root instance. */
export const hasValidParameter = (rootSymbol: unknown): boolean => rootSymbol === rootInstanceSymbol;

export const isRootInstance = (object: object): boolean => holder.has(object);
