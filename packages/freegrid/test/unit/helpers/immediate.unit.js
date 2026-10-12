import { setImmediate as fgSetImmediate, clearImmediate as fgClearImmediate } from 'handsontable/helpers/immediate';

describe('immediate helper', () => {
  it('runs the callback asynchronously, with arguments', async() => {
    const calls = [];

    fgSetImmediate((a, b) => calls.push([a, b]), 1, 2);
    expect(calls).toEqual([]);
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(calls).toEqual([[1, 2]]);
  });

  it('clearImmediate cancels a pending callback', async() => {
    const spy = jasmine.createSpy('cb');
    const id = fgSetImmediate(spy);

    fgClearImmediate(id);
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(spy).not.toHaveBeenCalled();
  });

  it('runs callbacks queued in the same turn together, in one task (like Node setImmediate)', async() => {
    const order = [];

    fgSetImmediate(() => {
      order.push('first');
      Promise.resolve().then(() => order.push('microtask after first'));
    });
    fgSetImmediate(() => order.push('second'));
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(order).toEqual(['first', 'second', 'microtask after first']);
  });

  it('clearImmediate from inside a callback cancels a sibling queued in the same turn', async() => {
    const order = [];
    let secondId;

    fgSetImmediate(() => {
      order.push('first');
      fgClearImmediate(secondId);
    });
    secondId = fgSetImmediate(() => order.push('second'));
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(order).toEqual(['first']);
  });

  it('an exception in one callback does not drop the rest; it is re-thrown asynchronously', async() => {
    const order = [];
    const error = new Error('boom');
    const rethrows = [];
    const realSetTimeout = globalThis.setTimeout;

    globalThis.setTimeout = (fn, delay, ...args) => {
      if (delay === 0 && fn.length === 0) {
        rethrows.push(fn);
        return 0;
      }
      return realSetTimeout(fn, delay, ...args);
    };
    try {
      fgSetImmediate(() => { throw error; });
      fgSetImmediate(() => order.push('second'));
      await new Promise(resolve => realSetTimeout(resolve, 20));
    } finally {
      globalThis.setTimeout = realSetTimeout;
    }
    expect(order).toEqual(['second']);
    expect(rethrows.length).toBe(1);
    expect(() => rethrows[0]()).toThrow(error);
  });
});
