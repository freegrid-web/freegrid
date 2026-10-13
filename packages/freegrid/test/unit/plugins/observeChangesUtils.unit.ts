import { cleanPatches, parsePath } from '../../../src/plugins/observeChanges/utils';

describe('observeChanges utils', () => {
  it('parsePath reads the row and the column (an index or a property) from a JSON patch path', () => {
    expect(parsePath('/2/3')).toEqual({ row: 2, col: 3 });
    expect(parsePath('/2/name')).toEqual({ row: 2, col: 'name' });
    expect(parsePath('/2')).toEqual({ row: 2, col: undefined });
    expect(parsePath('/length')).toBeNull();
    expect(parsePath('name')).toBeNull();
  });

  it('cleanPatches drops length and unreadable paths, and adds the coordinates', () => {
    expect(cleanPatches([
      { op: 'replace', path: '/0/1', value: 'a' },
      { op: 'replace', path: '/length', value: 3 },
      { op: 'replace', path: '/0/length', value: 3 },
      { op: 'add', path: 'nonsense', value: 1 },
    ])).toEqual([{ op: 'replace', path: '/0/1', value: 'a', row: 0, col: 1 }]);
  });

  it('cleanPatches keeps one patch for each added or removed column', () => {
    const patches = cleanPatches([
      { op: 'add', path: '/0/2', value: 1 },
      { op: 'add', path: '/1/2', value: 2 },
      { op: 'remove', path: '/0/3' },
      { op: 'remove', path: '/1/3' },
      { op: 'add', path: '/5', value: [] },
      { op: 'add', path: '/6', value: [] },
    ]);

    expect(patches.map(({ op, row, col }) => [op, row, col])).toEqual([
      ['add', 0, 2],
      ['remove', 0, 3],
      ['add', 5, undefined],
      ['add', 6, undefined],
    ]);
  });
});
