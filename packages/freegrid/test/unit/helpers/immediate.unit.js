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
});
