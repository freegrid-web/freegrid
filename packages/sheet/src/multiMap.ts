const canBeAnArrayMapKey = (key: unknown): key is string | number => key !== null && !Number.isNaN(key) &&
  (typeof key === 'string' || typeof key === 'number');

const canBeAWeakMapKey = (key: unknown): key is object => key !== null &&
  (typeof key === 'object' || typeof key === 'function');

/**
 * A map with any kind of key: numbers and strings (not `NaN`), and objects and functions (held weakly). Other keys
 * are ignored by `get` and `delete`, and rejected by `set`.
 */
class MultiMap<V = unknown> {
  #arrayMap: Record<string | number, V> = [] as unknown as Record<string | number, V>;

  #weakMap = new WeakMap<object, V>();

  get(key: unknown): V | undefined {
    if (canBeAnArrayMapKey(key)) {
      return this.#arrayMap[key];
    }

    return canBeAWeakMapKey(key) ? this.#weakMap.get(key) : undefined;
  }

  set(key: unknown, value: V): void {
    if (canBeAnArrayMapKey(key)) {
      this.#arrayMap[key] = value;
    } else if (canBeAWeakMapKey(key)) {
      this.#weakMap.set(key, value);
    } else {
      throw new Error('Invalid key type');
    }
  }

  delete(key: unknown): void {
    if (canBeAnArrayMapKey(key)) {
      delete this.#arrayMap[key];
    } else if (canBeAWeakMapKey(key)) {
      this.#weakMap.delete(key);
    }
  }
}

export default MultiMap;
