describe('Core copy and paste with formatting', () => {
  const id = 'testContainer';

  beforeEach(function() {
    this.$container = $(`<div id="${id}"></div>`).appendTo('body');
  });

  afterEach(function() {
    if (this.$container) {
      destroy();
      this.$container.remove();
    }
  });

  /** A clipboard event with the given data (and room for what a copy puts there). */
  const clipboardEvent = (data = {}) => ({
    clipboardData: {
      data: { ...data },
      getData(type) {
        return this.data[type] || '';
      },
      setData(type, value) {
        this.data[type] = value;
      },
    },
    preventDefault() {},
  });

  // What a spreadsheet puts on the clipboard: class rules in <style>, and inline styles.
  const EXCEL_HTML = '<html><head><style><!--' +
    '.xl65 {font-weight:700; text-align:center;} .xl66 {color:red; background:yellow; mso-pattern:black none;}' +
    '.xl67 {text-decoration:underline; font-style:italic; color:windowtext;}' +
    '--></style></head><body><table>' +
    '<tr><td class=xl65>Title</td><td class=xl66>12</td></tr>' +
    '<tr><td class=xl67>note</td><td style="background-color:#d9e1f2;text-align:right">7</td></tr>' +
    '</table></body></html>';

  it('pastes the formatting of an HTML table, and undoes values and formatting in one step', () => {
    const hot = handsontable({ data: [['a', 'b'], ['c', 'd']], cell: [{ row: 0, col: 1, style: { color: '#00ff00' } }] });

    selectCell(0, 0);
    hot.getPlugin('copyPaste').onPaste(clipboardEvent({ 'text/html': EXCEL_HTML }));

    expect(hot.getData()).toEqual([['Title', '12'], ['note', '7']]);
    expect(hot.getCellMeta(0, 0).style).toEqual({ fontWeight: 'bold' });
    expect(hot.getCellMeta(0, 0).className).toBe('fs-center');
    expect(hot.getCellMeta(0, 1).style).toEqual({ color: '#ff0000', background: '#ffff00' });
    expect(hot.getCellMeta(1, 0).style).toEqual({ fontStyle: 'italic', textDecoration: 'underline' });
    expect(hot.getCellMeta(1, 1).style).toEqual({ background: '#d9e1f2' });
    expect(hot.getCellMeta(1, 1).className).toBe('fs-right');
    expect(getCell(0, 1).style.background).toContain('rgb(255, 255, 0)');

    hot.undo();
    expect(hot.getData()).toEqual([['a', 'b'], ['c', 'd']]);
    expect(hot.getCellMeta(0, 0).style).toBeUndefined();
    expect(hot.getCellMeta(0, 1).style).toEqual({ color: '#00ff00' });
    expect(hot.isUndoAvailable()).toBe(false);

    hot.redo();
    expect(hot.getCellMeta(0, 0).style).toEqual({ fontWeight: 'bold' });
    expect(hot.getDataAtCell(0, 0)).toBe('Title');
  });

  it('keeps the cells\' formatting for text and for tables without formatting, and with formats: false', () => {
    const hot = handsontable({ data: [['a']], cell: [{ row: 0, col: 0, style: { fontWeight: 'bold' } }] });
    const plugin = hot.getPlugin('copyPaste');

    selectCell(0, 0);
    plugin.onPaste(clipboardEvent({ 'text/plain': 'x' }));
    expect(hot.getCellMeta(0, 0).style).toEqual({ fontWeight: 'bold' });

    plugin.onPaste(clipboardEvent({ 'text/html': '<table><tr><td>y</td></tr></table>' }));
    expect(hot.getDataAtCell(0, 0)).toBe('y');
    expect(hot.getCellMeta(0, 0).style).toEqual({ fontWeight: 'bold' });

    hot.updateSettings({ copyPaste: { formats: false } });
    plugin.onPaste(clipboardEvent({ 'text/html': EXCEL_HTML }));
    expect(hot.getCellMeta(0, 0).style).toEqual({ fontWeight: 'bold' });
    expect(hot.getCellMeta(0, 0).className).toBeUndefined();
  });

  it('copies the formatting into the clipboard\'s HTML, and pastes it back', () => {
    const hot = handsontable({
      data: [['a', 'b'], [null, null]],
      cell: [{ row: 0, col: 0, style: { fontWeight: 'bold', background: '#ffff00' }, className: 'fs-right' }],
    });
    const plugin = hot.getPlugin('copyPaste');
    const copy = clipboardEvent();

    selectCell(0, 0, 0, 1);
    plugin.setCopyableText();
    plugin.onCopy(copy);
    expect(copy.clipboardData.data['text/html'])
      .toContain('<td style="font-weight:bold;background-color:#ffff00;text-align:right">a</td><td>b</td>');

    selectCell(1, 0);
    plugin.onPaste(clipboardEvent(copy.clipboardData.data));
    expect(hot.getCellMeta(1, 0).style).toEqual({ fontWeight: 'bold', background: '#ffff00' });
    expect(hot.getCellMeta(1, 0).className).toBe('fs-right');
    expect(hot.getCellMeta(1, 1).style).toBeUndefined();
  });
});
