/**
 * Registers of named items (editors, renderers, validators, …). Every caller that asks for the same namespace
 * shares its items.
 */
export type Register<T> = {
  /** Adds an item, replacing one registered under the same name. */
  register(name: string, item: T): void;
  getItem(name: string): T | undefined;
  hasItem(name: string): boolean;
  /** The names of all items, in the order they were first registered. */
  getNames(): string[];
  getValues(): T[];
};

export const collection = new Map<string, Map<string, unknown>>();

const staticRegister = <T = unknown>(namespace = 'common'): Register<T> => {
  if (!collection.has(namespace)) {
    collection.set(namespace, new Map());
  }
  const items = collection.get(namespace) as Map<string, T>;

  return {
    register: (name, item) => {
      items.set(name, item);
    },
    getItem: name => items.get(name),
    hasItem: name => items.has(name),
    getNames: () => [...items.keys()],
    getValues: () => [...items.values()],
  };
};

export default staticRegister;
