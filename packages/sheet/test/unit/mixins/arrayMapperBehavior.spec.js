import { it } from 'vitest';
import arrayMapper from '../../../src/mixins/arrayMapper';
import RowsMapper from '../../../src/plugins/manualRowMove/rowsMapper';
import ColumnsMapper from '../../../src/plugins/manualColumnMove/columnsMapper';
import SortingMapper from '../../../src/plugins/columnSorting/rowsMapper';

const mapperFor = values => ({ ...arrayMapper, _arrayMap: values });
const sparse = (values, ...holes) => {
  for (const index of holes) delete values[index];

  return values;
};

describe('arrayMapper behavior for bulk operations', () => {
  it('keeps the map reference and returns separate empty arrays when inserting', () => {
    const values = Array.from({ length: 800 }, (_, index) => 799 - index);
    const mapper = mapperFor(values);
    const inserted = mapper.insertItems(30, 300);

    expect(mapper._arrayMap).toBe(values);
    expect(values).toEqual([
      ...Array.from({ length: 30 }, (_, index) => 799 - index),
      ...Array.from({ length: 300 }, (_, index) => 800 + index),
      ...Array.from({ length: 770 }, (_, index) => 769 - index),
    ]);
    expect(inserted).toEqual(Array.from({ length: 300 }, () => []));
    expect(new Set(inserted).size).toBe(300);
  });

  it('sorts the caller indexes and returns removed values in descending index order', () => {
    const values = Array.from({ length: 800 }, (_, index) => 799 - index);
    const indexes = Array.from({ length: 300 }, (_, index) => index * 2);
    const mapper = mapperFor(values);
    const removed = mapper.removeItems(indexes);

    expect(mapper._arrayMap).toBe(values);
    expect(indexes).toEqual(Array.from({ length: 300 }, (_, index) => 598 - index * 2));
    expect(removed).toEqual(indexes.map(index => 799 - index));
    expect(values).toEqual(Array.from({ length: 800 }, (_, index) => 799 - index)
      .filter((value, index) => !indexes.includes(index)));
  });

  it('preserves holes while inserting, removing and shifting', () => {
    for (const operation of ['insertItems', 'shiftItems']) {
      const mapper = mapperFor(sparse([0, 1, 2, 3, 4], 1, 3));

      mapper[operation](2, 300);
      expect(mapper._arrayMap.length).toBe(305);
      expect(1 in mapper._arrayMap).toBe(false);
      expect(303 in mapper._arrayMap).toBe(false);
      expect(mapper._arrayMap[304]).toBe(operation === 'insertItems' ? 4 : 304);
    }
    const values = Array.from({ length: 1000 }, (_, index) => index);

    delete values[900];
    const mapper = mapperFor(values);
    const removed = mapper.removeItems(Array.from({ length: 400 }, (_, index) => index));

    expect(removed).toEqual(Array.from({ length: 400 }, (_, index) => 399 - index));
    expect(500 in values).toBe(false);
    expect(values.length).toBe(600);
  });

  it.each([
    [[2, 2, 2], [0, 1, 5], [2, 2, 2]],
    [[-1, 20, 1.8, NaN], [2, 3, 4], [undefined, undefined, undefined, undefined]],
    [['2', 0], [1, 3, 4, 5], [2, 0]],
  ])('keeps splice coercion and duplicate removal behavior for %j', (indexes, remaining, removed) => {
    const mapper = mapperFor([0, 1, 2, 3, 4, 5]);

    expect(mapper.removeItems(indexes)).toEqual(removed);
    expect(mapper._arrayMap).toEqual(remaining);
  });

  it('keeps sparse removal lists sparse', () => {
    const indexes = sparse([1, 2, 3], 1);
    const mapper = mapperFor([0, 1, 2, 3, 4]);
    const result = mapper.removeItems(indexes);

    expect(result).toEqual(sparse([3, 1, 0], 2));
    expect(2 in result).toBe(false);
    expect(mapper._arrayMap).toEqual([0, 2, 4]);
  });

  it.each([0, -1, 1.5, '2', null, NaN])('preserves insertion counts/coercions for amount %j', (amount) => {
    const mapper = mapperFor([0, 1, 2]);
    const expected = [0, 1, 2];

    for (let count = 0; count <= amount - 1; count++) expected.splice(-1 + count, 0, 3 + count);
    mapper.insertItems(-1, amount);
    expect(mapper._arrayMap).toEqual(expected);
  });

  it('counts duplicate removed values, ignores NaN, and keeps map holes when lowering indexes', () => {
    const values = sparse([3, 3, NaN, ...Array(40).fill(8), 9, 0, 10], 44);
    const mapper = mapperFor(values);

    mapper.unshiftItems(0, 43);
    expect(mapper._arrayMap).toEqual(sparse([-33, 0, -32], 1));
    expect(mapper._arrayMap).not.toBe(values);
  });

  it('preserves mixed removed-value comparisons', () => {
    const mapper = mapperFor([...Array(40).fill('2'), 10, 1, NaN]);

    mapper.unshiftItems(0, 40);
    expect(mapper._arrayMap).toEqual([-30, 1, NaN]);
  });
});

describe('arrayMapper reverse lookups', () => {
  const check = (mapper) => {
    for (let repeat = 0; repeat < 140; repeat++) {
      for (const value of [0, 1, 25, 999, 1000, undefined, null, '3', NaN, -0]) {
        const index = mapper._arrayMap.indexOf(value);

        expect(mapper.getIndexByValue(value)).toBe(index === -1 ? null : index);
      }
    }
  };

  it('returns the first duplicate, skips holes, preserves equality and sees replacement arrays', () => {
    const values = Array.from({ length: 1000 }, (_, index) => index);

    delete values[4];
    values[20] = undefined;
    values[30] = NaN;
    values[40] = 25;
    const mapper = mapperFor(values);

    check(mapper);
    mapper._arrayMap = values.slice().reverse();
    check(mapper);
  });

  it.each(['insertItems', 'removeItems', 'unshiftItems', 'shiftItems', 'swapIndexes', 'clearMap'])('sees changes made by %s after repeated lookups', (operation) => {
    const mapper = mapperFor(Array.from({ length: 1000 }, (_, index) => 999 - index));

    check(mapper);
    mapper[operation](1, 40);
    check(mapper);
  });

  it.each([RowsMapper, ColumnsMapper, SortingMapper])('sees mapper reset and destruction', (Mapper) => {
    const mapper = new Mapper(null);

    mapper.createMap(1000);
    mapper.swapIndexes(0, 999);
    check(mapper);
    mapper.createMap();
    check(mapper);
    mapper.destroy();
    expect(mapper._arrayMap).toBe(null);
  });

  it.each([RowsMapper, ColumnsMapper])('sees moves and null removal after repeated lookups', (Mapper) => {
    const mapper = new Mapper(null);

    mapper.createMap(1000);
    check(mapper);
    mapper[Mapper === RowsMapper ? 'moveRow' : 'moveColumn'](999, 0);
    check(mapper);
    mapper.clearNull();
    check(mapper);
  });
});
