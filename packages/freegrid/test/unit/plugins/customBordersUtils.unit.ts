import {
  createId,
  createEmptyBorders,
  extendDefaultBorder,
  checkSelectionBorders,
  markSelected,
} from '../../../src/plugins/customBorders/utils';

const DEFAULT_BORDER = { width: 1, color: 'var(--fg-custom-border-color)' };

describe('customBorders utils', () => {
  it('createEmptyBorders gives a cell hidden borders on every side', () => {
    expect(createId(1, 2)).toBe('border_row1col2');
    expect(createEmptyBorders(1, 2)).toEqual({
      id: 'border_row1col2',
      border: { ...DEFAULT_BORDER, cornerVisible: false },
      row: 1,
      col: 2,
      top: { hide: true },
      right: { hide: true },
      bottom: { hide: true },
      left: { hide: true },
    });
  });

  it('extendDefaultBorder takes the given sides: an object as it is, true as the default border, false as hidden', () => {
    const custom: Record<string, unknown> = { top: { width: 2, color: 'red' }, right: true, bottom: false };
    const result = extendDefaultBorder(createEmptyBorders(0, 0), custom);

    expect(result.top).toEqual({ width: 2, color: 'red' });
    expect(result.right).toEqual(DEFAULT_BORDER);
    expect(result.bottom).toEqual({ hide: true });
    expect(result.left).toEqual({ hide: true });
    // The given object gets the same sides.
    expect(custom.right).toBe(result.right);
    expect(custom.bottom).toBe(result.bottom);
  });

  it('checkSelectionBorders tells whether a selected cell has a border (on a side)', () => {
    const metas: Record<string, unknown> = {
      '0,0': { borders: { top: { width: 1 }, left: { hide: true } } },
      '0,1': {},
    };
    const hot = {
      getSelectedRange: () => [{
        forAll(callback: (row: number, col: number) => boolean | void) {
          for (let col = 0; col <= 1; col += 1) {
            if (callback(0, col) === false) {
              return;
            }
          }
        },
      }],
      getCellMeta: (row: number, col: number) => metas[`${row},${col}`],
    };

    expect(checkSelectionBorders(hot, 'top')).toBe(true);
    expect(checkSelectionBorders(hot, 'left')).toBe(false);
    expect(checkSelectionBorders(hot)).toBe(true);
  });

  it('markSelected adds a check mark to a label', () => {
    expect(markSelected('Top')).toBe('<span class="selected">✓</span>Top');
  });
});
