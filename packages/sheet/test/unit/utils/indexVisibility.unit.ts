import { IndexVisibility } from '../../../src/utils/indexVisibility';

/** A visibility map over `total` indexes whose order is `order` (ordered index → physical index). */
const create = (total: number, order?: number[]) => {
  const state = { total, order };

  return {
    state,
    map: new IndexVisibility(() => state.total,
      () => (state.order ? (ordered: number) => state.order![ordered] : null)),
  };
};

describe('IndexVisibility', () => {
  it('is the identity while nothing is hidden', () => {
    const { map } = create(5);

    expect(map.isActive()).toBe(false);
    expect(map.count()).toBe(5);
    expect(map.toOrdered(3)).toBe(3);
    expect(map.toVisual(3)).toBe(3);
  });

  it('removes hidden indexes from the visual order', () => {
    const { map } = create(6);

    map.setHidden('test', [1, 2]);

    expect(map.count()).toBe(4);
    expect([0, 1, 2, 3].map(visual => map.toOrdered(visual))).toEqual([0, 3, 4, 5]);
    expect([0, 1, 2, 3, 4, 5].map(ordered => map.toVisual(ordered))).toEqual([0, null, null, 1, 2, 3]);
  });

  it('keeps indexes past the end and header indexes as they are, shifted by the hidden count', () => {
    const { map } = create(4);

    map.setHidden('test', [0]);

    expect(map.toOrdered(-1)).toBe(-1);
    expect(map.toVisual(-1)).toBe(-1);
    expect(map.toOrdered(3)).toBe(4);
    expect(map.toVisual(4)).toBe(3);
  });

  it('hides an index while any source hides it', () => {
    const { map } = create(4);

    map.setHidden('a', [1]);
    map.setHidden('b', [1, 2]);

    expect(map.count()).toBe(2);
    expect(map.isHiddenBy('a', 2)).toBe(false);
    expect(map.isHidden(2)).toBe(true);

    map.setHidden('b', null);

    expect(map.count()).toBe(3);
    expect(map.getHidden('a')).toEqual([1]);

    map.setHidden('a', []);

    expect(map.isActive()).toBe(false);
  });

  it('hides physical indexes: a sorted order keeps the same rows hidden', () => {
    const { map, state } = create(4);

    map.setHidden('test', [0]);
    state.order = [3, 2, 1, 0];
    map.invalidate();

    expect([0, 1, 2].map(visual => state.order![map.toOrdered(visual)])).toEqual([3, 2, 1]);
  });

  it('follows a changed total', () => {
    const { map, state } = create(3);

    map.setHidden('test', [1]);
    expect(map.count()).toBe(2);

    state.total = 5;

    expect(map.count()).toBe(4);
    expect(map.toOrdered(3)).toBe(4);
  });

  it('shifts the hidden indexes when indexes are inserted and removed', () => {
    const { map, state } = create(6);

    map.setHidden('test', [1, 4]);

    state.total = 8;
    map.onInsert(2, 2);
    expect(map.getHidden('test')).toEqual([1, 6]);

    state.total = 5;
    map.onRemove([1, 3, 7]);
    expect(map.getHidden('test')).toEqual([4]);
    expect(map.count()).toBe(4);
  });
});
