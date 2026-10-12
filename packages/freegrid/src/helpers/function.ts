// The wrappers below are `function`s, not arrows, on purpose: they pass their own `this` on to `func`, because
// FreeGrid calls them as methods. `Fn` accepts any function: callers pass arbitrary methods and callbacks.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any function signature, as in `Function`
type Fn = (...args: any[]) => unknown;

/**
 * Checks if the value is a function.
 */
export const isFunction = (func: unknown): func is Fn => typeof func === 'function';

export type ThrottleResult = { lastCallThrottled: boolean };

/**
 * Creates a throttled function that calls `func` at most once per `wait` ms: the first call runs at once, later
 * calls within `wait` collapse into one call at the end of the interval.
 */
export const throttle = (func: Fn, wait = 200) => {
  let lastCalled = 0;
  const result: ThrottleResult = {
    lastCallThrottled: true,
  };
  let lastTimer: ReturnType<typeof setTimeout> | null | undefined = null;

  return function _throttle(this: unknown, ...args: unknown[]): ThrottleResult {
    const stamp = Date.now();
    let needCall = false;

    result.lastCallThrottled = true;

    if (!lastCalled) {
      lastCalled = stamp;
      needCall = true;
    }
    const remaining = wait - (stamp - lastCalled);

    if (needCall) {
      result.lastCallThrottled = false;
      func.apply(this, args);
    } else {
      if (lastTimer) {
        clearTimeout(lastTimer);
      }
      lastTimer = setTimeout(() => {
        result.lastCallThrottled = false;
        func.apply(this, args);
        lastCalled = 0;
        lastTimer = void 0;
      }, remaining);
    }

    return result;
  };
};

/**
 * Like `throttle`, but the first `hits` calls go straight to `func`. `clearHits()` restores the free calls.
 */
export const throttleAfterHits = (func: Fn, wait = 200, hits = 10) => {
  const funcThrottle = throttle(func, wait);
  let remainHits = hits;

  const _throttleAfterHits = function(this: unknown, ...args: unknown[]): unknown {
    if (remainHits) {
      remainHits -= 1;

      return func.apply(this, args);
    }

    return funcThrottle.apply(this, args);
  };

  return Object.assign(_throttleAfterHits, {
    clearHits: (): void => {
      remainHits = hits;
    },
  });
};

/**
 * Creates a debounced function: `func` runs `wait` ms after the last call. Returns the result of the previous run.
 */
export const debounce = (func: Fn, wait = 200) => {
  let lastTimer: ReturnType<typeof setTimeout> | null = null;
  let result: unknown;

  return function _debounce(this: unknown, ...args: unknown[]): unknown {
    if (lastTimer) {
      clearTimeout(lastTimer);
    }
    lastTimer = setTimeout(() => {
      result = func.apply(this, args);
    }, wait);

    return result;
  };
};

/**
 * Composes functions left to right: the first gets all arguments, each next one gets the previous result.
 */
export const pipe = (...functions: Fn[]) => {
  const [firstFunc, ...restFunc] = functions;

  return function _pipe(this: unknown, ...args: unknown[]): unknown {
    return restFunc.reduce((acc: unknown, fn) => fn(acc), firstFunc.apply(this, args));
  };
};

/**
 * Creates a function with the first arguments bound to `params`.
 */
export const partial = (func: Fn, ...params: unknown[]) => function _partial(this: unknown, ...restParams: unknown[]): unknown {
  return func.apply(this, params.concat(restParams));
};

/**
 * Curries `func`: it runs once `func.length` arguments have been collected, left to right.
 *
 * @example
 * ```
 * const replace = curry((find, replacement, string) => string.replace(find, replacement));
 *
 * replace('foo')('bar', 'Some test with foo...'); // 'Some test with bar...'
 * ```
 */
export const curry = (func: Fn) => {
  const argsLength = func.length;

  const given = (argsSoFar: unknown[]) => function _curry(this: unknown, ...params: unknown[]): unknown {
    const passedArgsSoFar = argsSoFar.concat(params);

    return passedArgsSoFar.length >= argsLength ? func.apply(this, passedArgsSoFar) : given(passedArgsSoFar);
  };

  return given([]);
};

/**
 * Like `curry`, but the collected arguments are applied right to left.
 *
 * @example
 * ```
 * const replace = curryRight((find, replacement, string) => string.replace(find, replacement));
 *
 * replace('Some test with foo...')('bar', 'foo'); // 'Some test with bar...'
 * ```
 */
export const curryRight = (func: Fn) => {
  const argsLength = func.length;

  const given = (argsSoFar: unknown[]) => function _curry(this: unknown, ...params: unknown[]): unknown {
    const passedArgsSoFar = argsSoFar.concat(params.reverse());

    return passedArgsSoFar.length >= argsLength ? func.apply(this, passedArgsSoFar) : given(passedArgsSoFar);
  };

  return given([]);
};
