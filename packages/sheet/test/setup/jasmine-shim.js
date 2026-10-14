/* Jasmine-compatible API on top of Vitest, so upstream unit specs run unchanged. */
import { vi, expect } from 'vitest';

function callInfo(spy, i) {
  return { args: spy.mock.calls[i], object: spy.mock.contexts[i], returnValue: spy.mock.results[i]?.value };
}

function decorate(spy, original) {
  spy.and = {
    returnValue(value) { spy.mockImplementation(() => value); return spy; },
    callFake(fn) { spy.mockImplementation(fn); return spy; },
    callThrough() { spy.mockImplementation(original || (() => undefined)); return spy; },
    stub() { spy.mockImplementation(() => undefined); return spy; },
    throwError(err) {
      spy.mockImplementation(() => { throw typeof err === 'string' ? new Error(err) : err; });
      return spy;
    },
  };
  spy.calls = {
    count: () => spy.mock.calls.length,
    any: () => spy.mock.calls.length > 0,
    argsFor: i => spy.mock.calls[i] || [],
    allArgs: () => spy.mock.calls.slice(),
    all: () => spy.mock.calls.map((args, i) => callInfo(spy, i)),
    mostRecent: () => (spy.mock.calls.length ? callInfo(spy, spy.mock.calls.length - 1) : undefined),
    first: () => (spy.mock.calls.length ? callInfo(spy, 0) : undefined),
    reset: () => spy.mockClear(),
  };
  return spy;
}

const jasmineShim = {
  DEFAULT_TIMEOUT_INTERVAL: 15000,
  createSpy(name, impl) {
    return decorate(vi.fn(impl || (() => undefined)).mockName(name || 'spy'), impl);
  },
  createSpyObj(baseName, methodNames) {
    const names = Array.isArray(methodNames) ? methodNames : Object.keys(methodNames);
    const obj = {};

    names.forEach((m) => {
      obj[m] = jasmineShim.createSpy(`${baseName}.${m}`);
      if (!Array.isArray(methodNames)) obj[m].and.returnValue(methodNames[m]);
    });
    return obj;
  },
  any: ctor => expect.any(ctor),
  anything: () => expect.anything(),
  arrayContaining: arr => expect.arrayContaining(arr),
  objectContaining: obj => expect.objectContaining(obj),
  stringMatching: s => expect.stringMatching(s),
  addMatchers(matchers) {
    const extensions = {};

    Object.keys(matchers).forEach((name) => {
      extensions[name] = function(received, ...args) {
        const result = matchers[name]({ equals: this.equals }, []).compare(received, ...args);
        const { message } = result;

        return {
          pass: !!result.pass,
          message: () => (typeof message === 'function' ? message() : message || `expected ${this.utils.printReceived(received)} ${name}`),
        };
      };
    });
    expect.extend(extensions);
  },
  getEnv: () => ({ addReporter() {}, configure() {} }),
};

globalThis.jasmine = jasmineShim;
/*
 * `jest` → `vi`, except useFakeTimers, which mimics Jest 23 legacy timers in jsdom: the timer
 * functions become mock functions (`setTimeout.mock.calls`) and return numeric ids.
 */
const TIMER_FNS = [['setTimeout', 'clearTimeout'], ['setInterval', 'clearInterval']];

// Like Jest's jsdom environment (and browsers), timers return numeric ids. Node's clearTimeout and
// clearInterval accept the number returned by a Timeout's Symbol.toPrimitive.
TIMER_FNS.forEach(([set]) => {
  const nodeSet = globalThis[set];

  globalThis[set] = (...args) => Number(nodeSet(...args));
});
let restoreTimers = null;

function useLegacyFakeTimers() {
  if (restoreTimers) restoreTimers();
  const real = Object.fromEntries(TIMER_FNS.flat().map(n => [n, globalThis[n]]));

  vi.useFakeTimers();
  const handles = new Map();
  let nextId = 1;

  TIMER_FNS.forEach(([set, clear]) => {
    const fakeSet = globalThis[set];
    const fakeClear = globalThis[clear];

    globalThis[set] = vi.fn((...args) => {
      const id = nextId++;

      handles.set(id, fakeSet(...args));
      return id;
    });
    globalThis[clear] = vi.fn((id) => {
      fakeClear(handles.has(id) ? handles.get(id) : id);
      handles.delete(id);
    });
  });
  restoreTimers = () => {
    restoreTimers = null;
    vi.useRealTimers();
    Object.assign(globalThis, real);
  };
  return jestCompat;
}

const jestCompat = new Proxy(vi, {
  get: (target, prop) => (prop === 'useFakeTimers' ? useLegacyFakeTimers : target[prop]),
});

globalThis.jest = jestCompat;
const activeSpies = [];

globalThis.spyOn = (obj, method) => {
  const original = obj[method];
  const spy = vi.spyOn(obj, method).mockImplementation(() => undefined);

  activeSpies.push(spy);
  return decorate(spy, original);
};

// Jasmine removes spyOn() spies after every spec.
globalThis.afterEach(() => {
  while (activeSpies.length) activeSpies.pop().mockRestore();
  if (restoreTimers) restoreTimers();
});

/*
 * In Vitest's jsdom environment the global `window` is not jsdom's Window object, so jsdom rejects
 * it as the `view` argument of initUIEvent/initMouseEvent (a browser accepts it). Map it to the real one.
 */
const realWindow = globalThis.jsdom?.window;

if (realWindow && realWindow !== globalThis.window) {
  [['UIEvent', 'initUIEvent'], ['MouseEvent', 'initMouseEvent']].forEach(([ctor, method]) => {
    const proto = realWindow[ctor].prototype;
    const init = proto[method];

    proto[method] = function(...args) {
      if (args[3] === globalThis.window || args[3] === globalThis) args[3] = realWindow;
      return init.apply(this, args);
    };
  });
}

/* Jasmine-style `done` callbacks: a test/hook function declaring one parameter receives `done`. */
function withDone(fn) {
  if (typeof fn !== 'function' || fn.length === 0) return fn;

  return function() {
    return new Promise((resolve, reject) => {
      const done = err => (err ? reject(err instanceof Error ? err : new Error(String(err))) : resolve());

      done.fail = err => reject(err instanceof Error ? err : new Error(String(err || 'done.fail() called')));
      try {
        fn.call(this, done);
      } catch (e) {
        reject(e);
      }
    });
  };
}

['it', 'fit', 'xit', 'beforeEach', 'afterEach', 'beforeAll', 'afterAll'].forEach((name) => {
  let original = globalThis[name];

  if (!original && name === 'fit') original = globalThis.it.only;
  if (!original && name === 'xit') original = globalThis.it.skip;
  if (!original) return;

  const wrapped = (...args) => original(...args.map(a => withDone(a)));

  Object.assign(wrapped, original); // keep it.skip / it.only / it.each
  globalThis[name] = wrapped;
});
if (!globalThis.xdescribe) globalThis.xdescribe = globalThis.describe.skip;
if (!globalThis.fdescribe) globalThis.fdescribe = globalThis.describe.only;
