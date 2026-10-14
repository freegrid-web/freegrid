import { defineGetter } from './../helpers/object';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a hook may take any arguments
type LocalHook = (...params: any[]) => unknown;

/** What `localHooks` adds to a class (with `mixin(Class, localHooks)`). */
export type LocalHooks = {
  _localHooks: Record<string, LocalHook[]>;
  addLocalHook(key: string, callback: LocalHook): LocalHooks;
  runLocalHooks(key: string, ...params: unknown[]): void;
  clearLocalHooks(): LocalHooks;
};

/**
 * Hooks of one object (not of the grid): `addLocalHook('change', callback)` and `runLocalHooks('change', ...params)`.
 * Each instance gets its own hooks (see `mixin` in helpers/object).
 */
const localHooks = {
  _localHooks: Object.create(null) as Record<string, LocalHook[]>,

  addLocalHook(this: LocalHooks, key: string, callback: LocalHook): LocalHooks {
    if (!this._localHooks[key]) {
      this._localHooks[key] = [];
    }
    this._localHooks[key].push(callback);

    return this;
  },

  /** Calls the hooks of `key`, with this object as `this`. */
  runLocalHooks(this: LocalHooks, key: string, ...params: unknown[]): void {
    this._localHooks[key]?.forEach(callback => callback.apply(this, params));
  },

  clearLocalHooks(this: LocalHooks): LocalHooks {
    this._localHooks = {};

    return this;
  },
};

defineGetter(localHooks, 'MIXIN_NAME', 'localHooks', {
  writable: false,
  enumerable: false,
});

export default localHooks;
