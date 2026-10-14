import SheetClip from '../../lib/SheetClip/SheetClip';

describe('SheetClip.parse', () => {
  it('splits rows and cells (tabs, LF, CRLF and CR)', () => {
    expect(SheetClip.parse('a\tb\nc\td')).toEqual([['a', 'b'], ['c', 'd']]);
    expect(SheetClip.parse('a\tb\r\nc\td\r\n')).toEqual([['a', 'b'], ['c', 'd']]);
    expect(SheetClip.parse('a\rb')).toEqual([['a'], ['b']]);
  });

  it('reads a quoted cell over several lines, with "" as a quote', () => {
    expect(SheetClip.parse('"line 1\nsaid ""hi"""\tb')).toEqual([['line 1\nsaid "hi"', 'b']]);
  });

  it('keeps "" in a cell that is not quoted (e.g. JSON with an empty string)', () => {
    expect(SheetClip.parse('{"a":"","b":"x"}')).toEqual([['{"a":"","b":"x"}']]);
    expect(SheetClip.parse('say ""hi""\tb')).toEqual([['say ""hi""', 'b']]);
  });
});

describe('SheetClip.stringify', () => {
  it('quotes a cell with a line break and doubles its quotes', () => {
    expect(SheetClip.stringify([['a\n"b"', 'c']])).toBe('"a\n""b"""\tc');
  });
});
