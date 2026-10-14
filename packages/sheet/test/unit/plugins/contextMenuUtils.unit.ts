import {
  filterSeparators,
  prepareHorizontalAlignClass,
  prepareVerticalAlignClass,
  getAlignmentClasses,
  isItemHidden,
  normalizeSelection,
  getValidSelection,
} from '../../../src/plugins/contextMenu/utils';

const SEP = { name: '---------' };
const item = (name: string) => ({ name });

describe('contextMenu utils', () => {
  it('filterSeparators drops separators at the start and the end, and repeated ones', () => {
    expect(filterSeparators([SEP, SEP, item('a'), SEP, SEP, item('b'), SEP]))
      .toEqual([item('a'), SEP, item('b')]);
    expect(filterSeparators([item('a'), item('a')])).toEqual([item('a')]);
    expect(filterSeparators([])).toEqual([]);
  });

  it('prepare…AlignClass replaces the alignment of the same direction (also legacy names)', () => {
    expect(prepareHorizontalAlignClass('foo fs-left', 'fs-right')).toBe('foo  fs-right');
    expect(prepareHorizontalAlignClass('fs-left htCenter', 'fs-right')).toBe('  fs-right');
    expect(prepareHorizontalAlignClass('fs-right', 'fs-right')).toBe('fs-right');
    expect(prepareVerticalAlignClass('fs-left fs-top', 'fs-bottom')).toBe('fs-left  fs-bottom');
  });

  it('getAlignmentClasses collects the class names of the ranges, by row and column', () => {
    const ranges = [{ from: { row: 0, col: 1 }, to: { row: 1, col: 1 } }];

    expect(getAlignmentClasses(ranges, (row: number, col: number) => `c${row}${col}`))
      .toEqual({ 0: [undefined, 'c01'], 1: [undefined, 'c11'] });
  });

  it('isItemHidden is true for a visible item (its name is upside down)', () => {
    expect(isItemHidden({}, {})).toBe(true);
    expect(isItemHidden({ hidden: false }, {})).toBe(true);
    expect(isItemHidden({ hidden() { return true; } }, {})).toBe(false);
    expect(isItemHidden({ hidden() { return false; } }, {})).toBe(true);
    expect(isItemHidden({ hidden: true }, {})).toBe(true);
  });

  it('normalizeSelection and getValidSelection', () => {
    const range = { getTopLeftCorner: () => ({ row: 0, col: 0 }), getBottomRightCorner: () => ({ row: 1, col: 2 }) };

    expect(normalizeSelection([range])).toEqual([{ start: { row: 0, col: 0 }, end: { row: 1, col: 2 } }]);
    expect(getValidSelection({ getSelected: () => undefined })).toBeNull();
    expect(getValidSelection({ getSelected: () => [[0, 0, 1, 1]] })).toEqual([[0, 0, 1, 1]]);
  });
});
