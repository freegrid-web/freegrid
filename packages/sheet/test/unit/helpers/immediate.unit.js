import { setImmediate as fsSetImmediate, clearImmediate as fsClearImmediate } from 'handsontable/helpers/immediate';

describe('immediate helper', () => {
  it('runs the callback asynchronously, with arguments', async() => {
    const calls = [];

    fsSetImmediate((a, b) => calls.push([a, b]), 1, 2);
    expect(calls).toEqual([]);
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(calls).toEqual([[1, 2]]);
  });

  it('clearImmediate cancels a pending callback', async() => {
    const spy = jasmine.createSpy('cb');
    const id = fsSetImmediate(spy);

    fsClearImmediate(id);
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(spy).not.toHaveBeenCalled();
  });

  it('runs callbacks queued in the same turn together, in one task (like Node setImmediate)', async() => {
    const order = [];

    fsSetImmediate(() => {
      order.push('first');
      Promise.resolve().then(() => order.push('microtask after first'));
    });
    fsSetImmediate(() => order.push('second'));
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(order).toEqual(['first', 'second', 'microtask after first']);
  });

  it('clearImmediate from inside a callback cancels a sibling queued in the same turn', async() => {
    const order = [];
    let secondId;

    fsSetImmediate(() => {
      order.push('first');
      fsClearImmediate(secondId);
    });
    secondId = fsSetImmediate(() => order.push('second'));
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(order).toEqual(['first']);
  });

  it('an exception in one callback does not drop the rest; it is re-thrown asynchronously', async() => {
    const order = [];
    const error = new Error('boom');
    const rethrows = [];
    const realSetTimeout = globalThis.setTimeout;

    globalThis.setTimeout = (fn, delay, ...args) => {
      if (delay === 0 && /^\(\) => \{\s*throw /.test(String(fn))) { // the helper's asynchronous re-throw
        rethrows.push(fn);
        return 0;
      }
      return realSetTimeout(fn, delay, ...args);
    };
    try {
      fsSetImmediate(() => { throw error; });
      fsSetImmediate(() => order.push('second'));
      await new Promise(resolve => realSetTimeout(resolve, 20));
    } finally {
      globalThis.setTimeout = realSetTimeout;
    }
    expect(order).toEqual(['second']);
    expect(rethrows.length).toBe(1);
    expect(() => rethrows[0]()).toThrow(error);
  });

  it('runs before a setTimeout(0) scheduled after it, in every browser', async() => {
    const order = [];

    // Firefox and WebKit may deliver a MessageChannel message after an already-due timer.
    // Simulate a channel that is slower than timers.
    const RealChannel = globalThis.MessageChannel;

    globalThis.MessageChannel = class SlowChannel {
      constructor() {
        this.port1 = {};
        this.port2 = { postMessage: () => setTimeout(() => this.port1.onmessage({ data: null }), 30) };
      }
    };
    try {
      vi.resetModules();
      const { setImmediate: freshSetImmediate } = await import('handsontable/helpers/immediate');

      freshSetImmediate(() => order.push('immediate'));
      setTimeout(() => order.push('timeout'), 0);
      await new Promise(resolve => setTimeout(resolve, 60));
    } finally {
      globalThis.MessageChannel = RealChannel;
    }
    expect(order).toEqual(['immediate', 'timeout']);
  });
});
