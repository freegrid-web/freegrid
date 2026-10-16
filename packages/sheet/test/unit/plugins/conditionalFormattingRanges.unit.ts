import {
  parseRange, formatRange, rectContains, removeRows, insertRows, subtractRect, shiftFormula,
} from '../../../src/plugins/conditionalFormatting/ranges';

describe('conditional formatting ranges', () => {
  it('reads A1 ranges: cells, areas, whole columns and whole rows', () => {
    expect(parseRange('B2')).toEqual({ r1: 1, c1: 1, r2: 1, c2: 1 });
    expect(parseRange('f20:b2')).toEqual({ r1: 1, c1: 1, r2: 19, c2: 5 });
    expect(parseRange('$C$3:$D$4')).toEqual({ r1: 2, c1: 2, r2: 3, c2: 3 });
    expect(parseRange('C:C')).toEqual({ r1: 0, c1: 2, r2: Infinity, c2: 2 });
    expect(parseRange('3:5')).toEqual({ r1: 2, c1: 0, r2: 4, c2: Infinity });
    expect(parseRange('nonsense')).toBeNull();
  });

  it('writes ranges back as A1', () => {
    expect(formatRange({ r1: 1, c1: 1, r2: 19, c2: 5 })).toBe('B2:F20');
    expect(formatRange({ r1: 1, c1: 1, r2: 1, c2: 1 })).toBe('B2');
    expect(formatRange({ r1: 0, c1: 2, r2: Infinity, c2: 3 })).toBe('C:D');
    expect(formatRange({ r1: 2, c1: 0, r2: 4, c2: Infinity })).toBe('3:5');
  });

  it('knows which cells a range holds', () => {
    expect(rectContains(parseRange('B2:C3')!, 2, 2)).toBe(true);
    expect(rectContains(parseRange('B2:C3')!, 3, 2)).toBe(false);
    expect(rectContains(parseRange('C:C')!, 5000, 2)).toBe(true);
  });

  it('moves and grows a range when rows are inserted, and shrinks or drops it when rows are removed', () => {
    expect(insertRows(parseRange('B2:B5')!, 0, 2)).toEqual(parseRange('B4:B7'));
    expect(insertRows(parseRange('B2:B5')!, 3, 1)).toEqual(parseRange('B2:B6'));
    expect(insertRows(parseRange('B2:B5')!, 9, 1)).toEqual(parseRange('B2:B5'));
    expect(removeRows(parseRange('B2:B5')!, [0])).toEqual(parseRange('B1:B4'));
    expect(removeRows(parseRange('B2:B5')!, [2, 3])).toEqual(parseRange('B2:B3'));
    expect(removeRows(parseRange('B2:B3')!, [1, 2])).toBeNull();
    expect(removeRows(parseRange('C:C')!, [1])).toEqual(parseRange('C:C'));
  });

  it('removes one range from another', () => {
    const parts = subtractRect(parseRange('A1:C3')!, parseRange('B2')!).map(formatRange).sort();

    expect(parts).toEqual(['A1:C1', 'A2', 'A3:C3', 'C2'].sort());
    expect(subtractRect(parseRange('A1:B2')!, parseRange('A1:C3')!)).toEqual([]);
    expect(subtractRect(parseRange('A1:B2')!, parseRange('D4')!)).toEqual([parseRange('A1:B2')]);
  });

  it('moves the relative references of a formula, keeping the fixed parts and the text in quotes', () => {
    expect(shiftFormula('=$F2<0', 3, 1)).toBe('=$F5<0');
    expect(shiftFormula('=A1+B$1+$C$1', 1, 1)).toBe('=B2+C$1+$C$1');
    expect(shiftFormula('=LOG10(A1)>1', 1, 0)).toBe('=LOG10(A2)>1');
    expect(shiftFormula('=A1="B2"', 1, 0)).toBe('=A2="B2"');
    expect(shiftFormula('=Costs!A1>0', 2, 0)).toBe('=Costs!A3>0');
  });
});
