import { tableToArray } from '../../../src/plugins/copyPaste/utils';

describe('copyPaste tableToArray', () => {
  it('reads the cells of a pasted HTML table by rows', () => {
    expect(tableToArray('<table><tr><td>A1</td><td>B1</td></tr><tr><td>A2</td><td>B2</td></tr></table>'))
      .toEqual([['A1', 'B1'], ['A2', 'B2']]);
    expect(tableToArray('<p>no table</p>')).toEqual([]);
    expect(tableToArray(null)).toEqual([]);
  });

  it('takes the text of a cell: entities decoded, tags dropped, the first <br> as a new line', () => {
    expect(tableToArray('<table><tr><td>a &amp; <b>b</b></td></tr></table>')).toEqual([['a & b']]);
    expect(tableToArray('<table><tr><td>one<br>two<br>three</td></tr></table>')).toEqual([['one\ntwothree']]);

    const table = document.createElement('table');

    table.innerHTML = '<tr><td>a<br>\nb</td><td>a<br><i>\nb</i></td></tr>';

    expect(tableToArray(table)).toEqual([['a\nb', 'a\n\nb']]);
  });

  it('trims the whitespace around a cell\'s markup (not inside its first or last element)', () => {
    expect(tableToArray('<table><tr><td>  x  </td></tr></table>')).toEqual([['x']]);
    expect(tableToArray('<table><tr><td>  <b> x </b>  </td></tr></table>')).toEqual([[' x ']]);
  });

  it('does not change a table element it is given', () => {
    const table = document.createElement('table');

    table.innerHTML = '<tr><td> a<br>b </td></tr>';
    tableToArray(table);

    expect(table.rows[0].cells[0].innerHTML).toBe(' a<br>b ');
  });
});
