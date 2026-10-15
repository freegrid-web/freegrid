import DataMap from '../../src/dataMap';
import DataSource from '../../src/dataSource';
import { getProperty } from '../../src/helpers/object';

const dataMap = (data) => {
  const map = Object.create(DataMap.prototype);

  map.dataSource = data;
  map.instance = { runHooks: (_, value) => value, hasHook: () => false };

  return map;
};

describe('data property path behavior', () => {
  it('reads empty, leading and trailing path segments as actual keys', () => {
    expect(getProperty({ '': 1 }, '')).toBe(1);
    expect(getProperty({ '': { a: 2 } }, '.a')).toBe(2);
    expect(getProperty({ a: { '': 3 } }, 'a.')).toBe(3);
    expect(getProperty({ a: { '': { b: 4 } } }, 'a..b')).toBe(4);
  });

  it('stops on undefined and keeps null traversal errors', () => {
    expect(getProperty({}, 'a.b.c')).toBeUndefined();
    expect(() => getProperty({ a: null }, 'a.b')).toThrow(TypeError);
    expect(() => getProperty(null, 'a')).toThrow(TypeError);
  });

  it('reads inherited properties and numeric array keys', () => {
    expect(getProperty(Object.create({ group: { value: 7 } }), 'group.value')).toBe(7);
    expect(getProperty({ rows: [{ value: 8 }] }, 'rows.0.value')).toBe(8);
    expect(getProperty({ rows: new Array(2) }, 'rows.0.value')).toBeUndefined();
  });

  it('keeps helper traversal distinct from literal dotted object keys', () => {
    expect(getProperty({ 'a.b': 1, a: { b: 2 } }, 'a.b')).toBe(2);
  });

  it('evaluates row getters again on every read', () => {
    let count = 0;
    const row = { get group() { return { value: ++count }; } };

    expect(getProperty(row, 'group.value')).toBe(1);
    expect(getProperty(row, 'group.value')).toBe(2);
  });

  it('keeps the runtime split behavior of non-primitive path arguments', () => {
    let calls = 0;
    const path = { split() { calls++; return [calls === 1 ? 'first' : 'second']; } };

    expect(getProperty({ first: 1, second: 2 }, path)).toBe(1);
    expect(getProperty({ first: 1, second: 2 }, path)).toBe(2);
    expect(() => getProperty({}, 5)).toThrow(TypeError);
  });

  it('keeps property access order and supports reentrant reads', () => {
    const calls = [];
    const inner = { group: { value: 9 } };
    const outer = { get group() {
      calls.push('group');
      return { get value() { calls.push('value'); return getProperty(inner, 'group.value'); } };
    } };

    expect(getProperty(outer, 'group.value')).toBe(9);
    expect(getProperty(outer, 'group.value')).toBe(9);
    expect(calls).toEqual(['group', 'value', 'group', 'value']);
  });

  it('reads data after nested objects have been replaced', () => {
    const row = { group: { value: 1 } };

    expect(getProperty(row, 'group.value')).toBe(1);
    row.group = { value: 2 };
    expect(getProperty(row, 'group.value')).toBe(2);
    delete row.group;
    expect(getProperty(row, 'group.value')).toBeUndefined();
  });

  it('keeps results across many distinct and long column paths', () => {
    for (let index = 0; index < 1100; index++) {
      expect(getProperty({ group: { [`field${index}`]: index } }, `group.field${index}`)).toBe(index);
    }
    const key = 'x'.repeat(2048);

    expect(getProperty({ group: { [key]: 3 } }, `group.${key}`)).toBe(3);
    expect(getProperty({ group: { field0: 4 } }, 'group.field0')).toBe(4);
  });

  it('keeps data-map literal dotted keys ahead of nested traversal', () => {
    const map = dataMap([{ a: { b: 1 } }, { 'a.b': 2, a: { b: 3 } }]);

    expect(map.get(0, 'a.b')).toBe(1);
    expect(map.get(1, 'a.b')).toBe(2);
    map.set(1, 'a.b', 4);
    expect(map.dataSource[1]).toEqual({ 'a.b': 4, a: { b: 3 } });
  });

  it('keeps the data-map missing-value and null behavior', () => {
    const map = dataMap([{}, { group: null }]);

    expect(map.get(0, 'group.value')).toBeNull();
    expect(() => map.get(1, 'group.value')).toThrow(TypeError);
    expect(() => map.set(1, 'group.value', 2)).toThrow(TypeError);
  });

  it('writes a repeated nested path without losing its final segment', () => {
    const map = dataMap([{}, {}]);

    map.set(0, 'group.branch.value', 1);
    map.set(1, 'group.branch.value', 2);
    map.set(0, 'group.branch.value', 3);
    expect(map.get(0, 'group.branch.value')).toBe(3);
    expect(map.get(1, 'group.branch.value')).toBe(2);
    expect(map.dataSource).toEqual([{ group: { branch: { value: 3 } } }, { group: { branch: { value: 2 } } }]);
  });

  it('creates empty-name intermediate and final properties', () => {
    const map = dataMap([{}]);

    map.set(0, 'group..value', 1);
    map.set(0, 'group.', 2);
    expect(map.dataSource[0]).toEqual({ group: { '': 2 } });
  });

  it('rejects unsafe segments even after reading the same path', () => {
    const map = dataMap([{}]);

    for (const key of ['__proto__', 'constructor', 'prototype']) {
      const row = { group: { [key]: { value: 1 } } };

      expect(getProperty(row, `group.${key}.value`)).toBe(1);
      map.set(0, `group.${key}.value`, 2);
      map.set(0, key, 3);
    }
    expect(map.dataSource[0]).toEqual({});
  });

  it('continues to use row replacement and value-modification hooks', () => {
    const map = dataMap([{ group: { value: 1 } }]);
    const replacement = { group: { value: 4 } };
    const calls = [];

    map.instance.hasHook = name => name === 'modifyData';
    map.propToCol = () => 0;
    map.instance.runHooks = (name, value, column, holder, mode) => {
      calls.push(name);
      if (name === 'modifyRowData') return replacement;
      if (name === 'modifyData') holder.value += mode === 'set' ? 10 : 20;
      return value;
    };
    expect(map.get(0, 'group.value')).toBe(24);
    map.set(0, 'group.value', 2);
    expect(replacement.group.value).toBe(12);
    expect(map.dataSource[0].group.value).toBe(1);
    expect(calls).toEqual(['modifyRow', 'modifyRowData', 'modifyData', 'modifyRow', 'modifyRowData', 'modifyData']);
  });

  it('keeps source-column reads live across changing mappings', () => {
    const source = new DataSource({ runHooks: (_, row) => row }, [{ a: { value: 1 }, b: { value: 2 } }]);
    let mapping = 'a.value';

    source.colToProp = () => mapping;
    expect(source.getAtCell(0, 0)).toBe(1);
    mapping = 'b.value';
    expect(source.getAtCell(0, 0)).toBe(2);
  });
});
