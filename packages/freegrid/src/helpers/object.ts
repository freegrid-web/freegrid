import { arrayEach } from './array';

type AnyObject = Record<PropertyKey, unknown>;
type Constructor = { new (...args: never[]): unknown; prototype: object };

/**
 * Builds an empty "schema" with the same shape as `object`: nested objects are recreated, arrays become `[]`
 * (or `[schemaOfFirstItem]` for arrays of objects), other values become `null`. `__children` is skipped.
 */
export const duckSchema = (object: unknown): AnyObject | unknown[] => {
  if (Array.isArray(object)) {
    return [];
  }
  const schema: AnyObject = {};

  objectEach(object as AnyObject, (value, key) => {
    if (key === '__children') {
      return;
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      schema[key] = duckSchema(value);

    } else if (Array.isArray(value)) {
      if (value.length && typeof value[0] === 'object' && !Array.isArray(value[0])) {
        schema[key] = [duckSchema(value[0])];
      } else {
        schema[key] = [];
      }

    } else {
      schema[key] = null;
    }
  });

  return schema;
};

/**
 * Makes `Child` inherit from `Parent` (prototype chain), for constructor functions.
 */
export const inherit = <C extends Constructor>(Child: C, Parent: Constructor): C => {
  Parent.prototype.constructor = Parent;
  Child.prototype = new Parent() as AnyObject;
  Child.prototype.constructor = Child;

  return Child;
};

/**
 * Copies the own enumerable properties of `extension` onto `target` (shallow). Returns `target`.
 */
export const extend = <T extends object>(target: T, extension: object): T => {
  objectEach(extension as AnyObject, (value, key) => {
    // A `__proto__` key (e.g. from JSON) would replace the target's prototype, and `constructor` leads to it.
    if (key !== '__proto__' && key !== 'constructor') {
      (target as AnyObject)[key] = value;
    }
  });

  return target;
};

/**
 * Copies `extension` onto `target` recursively: nested objects and arrays are merged, dates are copied by reference.
 */
export const deepExtend = (target: AnyObject, extension: AnyObject): void => {
  objectEach(extension, (value, key) => {
    // A `__proto__` key (e.g. from JSON) would reach Object.prototype.
    if (key === '__proto__') {
      return;
    }
    if (extension[key] && typeof extension[key] === 'object') {
      // Only the target's own values are merged into: an inherited one (`constructor`, …) is replaced by a new copy.
      if (!hasOwnProperty(target, key) || !target[key]) {
        if (Array.isArray(extension[key])) {
          target[key] = [];
        } else if (Object.prototype.toString.call(extension[key]) === '[object Date]') {
          target[key] = extension[key];
        } else {
          target[key] = {};
        }
      }
      deepExtend(target[key] as AnyObject, extension[key] as AnyObject);

    } else {
      target[key] = extension[key];
    }
  });
};

/**
 * Deep-copies an object through JSON (functions, dates and `undefined` values do not survive). Other values are
 * returned as they are.
 */
export const deepClone = <T>(obj: T): T => {
  if (typeof obj === 'object') {
    return JSON.parse(JSON.stringify(obj));
  }

  return obj;
};

/**
 * Shallow-copies the own enumerable properties of `object` into a new plain object.
 */
export const clone = <T extends object>(object: T): T => {
  const result: AnyObject = {};

  objectEach(object as AnyObject, (value, key) => {
    result[key] = value;
  });

  return result as T;
};

/**
 * Adds the members of mixin objects to `Base.prototype`. Functions are copied; other values become lazily
 * initialized per-instance properties (arrays and objects are deep-cloned for each instance). Throws on a name
 * that `Base.prototype` already has.
 */
export const mixin = <B extends Constructor>(Base: B, ...mixins: AnyObject[]): B => {
  const target = Base as B & { MIXINS?: unknown[] };

  if (!target.MIXINS) {
    target.MIXINS = [];
  }
  arrayEach(mixins, (mixinItem: AnyObject) => {
    target.MIXINS?.push(mixinItem.MIXIN_NAME);

    objectEach(mixinItem, (value, key) => {
      if ((Base.prototype as AnyObject)[key] !== void 0) {
        throw new Error(`Mixin conflict. Property '${key}' already exist and cannot be overwritten.`);
      }
      if (typeof value === 'function') {
        (Base.prototype as AnyObject)[key] = value;

      } else {
        const getter = (property: string, initialValue: unknown) => {
          const propertyName = `_${property}`;

          const initValue = (newValue: unknown): unknown => {
            let result = newValue;

            if (Array.isArray(result) || isObject(result)) {
              result = deepClone(result);
            }

            return result;
          };

          // A function, not an arrow: `this` is the instance the property is read on.
          return function(this: AnyObject): unknown {
            if (this[propertyName] === void 0) {
              this[propertyName] = initValue(initialValue);
            }

            return this[propertyName];
          };
        };
        const setter = (property: string) => {
          const propertyName = `_${property}`;

          return function(this: AnyObject, newValue: unknown): void {
            this[propertyName] = newValue;
          };
        };

        Object.defineProperty(Base.prototype, key, {
          get: getter(key, value),
          set: setter(key),
          configurable: true,
        });
      }
    });
  });

  return Base;
};

/**
 * Compares two values by their JSON representation.
 */
export const isObjectEqual = (object1: unknown, object2: unknown): boolean => JSON.stringify(object1) === JSON.stringify(object2);

/**
 * Checks if the value is a plain object (`[object Object]`).
 */
export const isObject = (obj: unknown): obj is AnyObject => Object.prototype.toString.call(obj) === '[object Object]';

/**
 * Defines `property` on `object` with `value`. Unless `options` says `false`, the property is writable,
 * enumerable and configurable. `options` is modified.
 */
export const defineGetter = (object: object, property: PropertyKey, value: unknown, options: PropertyDescriptor): void => {
  options.value = value;
  options.writable = options.writable !== false;
  options.enumerable = options.enumerable !== false;
  options.configurable = options.configurable !== false;

  Object.defineProperty(object, property, options);
};

/**
 * Calls `iteratee` for each own enumerable property (all enumerable properties when the object has no
 * `hasOwnProperty`, e.g. `Object.create(null)`); stops when it returns `false`. Returns `object`.
 */
export const objectEach = <T extends object>(
  object: T,
  iteratee: (value: T[keyof T], key: string, object: T) => unknown,
): T => {
  const record = object as T & { hasOwnProperty?: unknown };

  for (const key in object) {
    if (!record.hasOwnProperty || Object.prototype.hasOwnProperty.call(object, key)) {
      if (iteratee(object[key], key, object) === false) {
        break;
      }
    }
  }

  return object;
};

/**
 * Reads a nested property by a dot-separated path (`'a.b.c'`); `undefined` when a step is missing.
 */
export const getProperty = (object: unknown, name: string): unknown => {
  let result = object;

  for (const nameItem of name.split('.')) {
    result = (result as AnyObject)[nameItem];

    if (result === void 0) {
      break;
    }
  }

  return result;
};

/**
 * Counts the leaf values of a plain object, recursively; 0 for anything that is not a plain object.
 */
export const deepObjectSize = (object: unknown): number => {
  if (!isObject(object)) {
    return 0;
  }
  const recursObjLen = (obj: unknown): number => {
    let result = 0;

    if (isObject(obj)) {
      objectEach(obj, (value) => {
        result += recursObjLen(value);
      });
    } else {
      result += 1;
    }

    return result;
  };

  return recursObjLen(object);
};

export type ObjectPropListener<T> = {
  _touched: boolean;
  isTouched(): boolean;
} & Record<string, T | boolean | (() => boolean)>;

/**
 * Creates an object with a `propertyToListen` property that remembers whether it was ever assigned
 * (`isTouched()`).
 */
export const createObjectPropListener = <T>(defaultValue: T, propertyToListen = 'value'): ObjectPropListener<T> => {
  const privateProperty = `_${propertyToListen}`;
  const holder = {
    _touched: false,
    [privateProperty]: defaultValue,
    isTouched() {
      return this._touched;
    },
  } as ObjectPropListener<T>;

  Object.defineProperty(holder, propertyToListen, {
    get(this: AnyObject) {
      return this[privateProperty];
    },
    set(this: AnyObject, value: T) {
      this._touched = true;
      this[privateProperty] = value;
    },
    enumerable: true,
    configurable: true,
  });

  return holder;
};

/**
 * `Object.prototype.hasOwnProperty`, safe for objects without a prototype.
 */
export const hasOwnProperty = (object: object, key: PropertyKey): boolean => Object.prototype.hasOwnProperty.call(object, key);
