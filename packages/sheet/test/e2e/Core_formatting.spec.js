describe('Core formatting', () => {
  const id = 'testContainer';

  beforeEach(function() {
    this.$container = $(`<div id="${id}"></div>`).appendTo('body');
  });

  afterEach(function() {
    if (this.$container) {
      destroy();
      this.$container.remove();
    }
    $('.fs-context-menu').remove();
  });

  it('merges a style into the selected cells, removes null properties, and clears with null', () => {
    const hot = handsontable({ data: [[1, 2], [3, 4]], cell: [{ row: 0, col: 0, style: { color: '#ff0000' } }] });

    selectCell(0, 0, 0, 1);
    hot.setCellStyle({ fontWeight: 'bold' });

    expect(hot.getCellMeta(0, 0).style).toEqual({ color: '#ff0000', fontWeight: 'bold' });
    expect(hot.getCellMeta(0, 1).style).toEqual({ fontWeight: 'bold' });
    expect(getCell(0, 1).style.fontWeight).toBe('bold');
    expect(hot.getCellMeta(1, 0).style).toBeUndefined();

    hot.setCellStyle({ color: null });
    expect(hot.getCellMeta(0, 0).style).toEqual({ fontWeight: 'bold' });

    hot.setCellStyle(null);
    expect(hot.getCellMeta(0, 0).style).toBeUndefined();
    expect(getCell(0, 0).style.fontWeight).toBe('');
  });

  it('styles given ranges, and runs afterSetCellStyle with the changes', () => {
    const changed = jasmine.createSpy('afterSetCellStyle');
    const hot = handsontable({ data: [[1, 2], [3, 4]], afterSetCellStyle: changed });

    selectCell(1, 1);
    const ranges = hot.getSelectedRange();

    selectCell(0, 0);
    hot.setCellStyle({ background: '#ffff00' }, ranges);

    expect(hot.getCellMeta(1, 1).style).toEqual({ background: '#ffff00' });
    expect(hot.getCellMeta(0, 0).style).toBeUndefined();
    expect(changed.calls.argsFor(0)[0]).toEqual([[1, 1, undefined, { background: '#ffff00' }]]);
  });

  it('toggles bold, italic, underline and strikethrough with Ctrl+B, Ctrl+I and Ctrl+U, and undoes them', () => {
    const hot = handsontable({ data: [[1, 2], [3, 4]], cell: [{ row: 0, col: 0, style: { fontWeight: 'bold' } }] });

    selectCell(0, 0, 0, 1);
    keyDownUp(66, { ctrlKey: true });
    // Not every cell was bold, so all of them become bold; again, and none is.
    expect(hot.getCellMeta(0, 1).style).toEqual({ fontWeight: 'bold' });
    keyDownUp(66, { ctrlKey: true });
    expect(hot.getCellMeta(0, 0).style).toBeUndefined();

    keyDownUp(73, { ctrlKey: true });
    keyDownUp(85, { ctrlKey: true });
    expect(hot.getCellMeta(0, 0).style).toEqual({ fontStyle: 'italic', textDecoration: 'underline' });

    hot.undo();
    expect(hot.getCellMeta(0, 0).style).toEqual({ fontStyle: 'italic' });
    hot.redo();
    expect(hot.getCellMeta(0, 0).style).toEqual({ fontStyle: 'italic', textDecoration: 'underline' });
  });

  it('formats from the context menu: toggles, colors and clear formatting', () => {
    const hot = handsontable({ data: [[1, 2], [3, 4]], contextMenu: ['alignment', 'formatting'] });
    const menu = hot.getPlugin('contextMenu');

    selectCell(0, 0, 1, 0);
    contextMenu();
    expect($('.fs-context-menu td').filter((i, td) => $(td).text() === 'Format').length).toBe(1);

    menu.executeCommand('formatting:strikethrough');
    expect(hot.getCellMeta(1, 0).style).toEqual({ textDecoration: 'line-through' });

    menu.executeCommand('formatting:fill_color:fill_color_5');
    expect(hot.getCellMeta(0, 0).style).toEqual({ textDecoration: 'line-through', background: '#ffff00' });
    menu.executeCommand('formatting:text_color:text_color_2');
    expect(hot.getCellMeta(0, 0).style.color).toBe('#c00000');
    menu.executeCommand('formatting:fill_color:fill_color_none');
    expect(hot.getCellMeta(0, 0).style).toEqual({ textDecoration: 'line-through', color: '#c00000' });

    menu.executeCommand('formatting:clear');
    expect(hot.getCellMeta(0, 0).style).toBeUndefined();
    expect(hot.getCellMeta(1, 0).style).toBeUndefined();
  });
});
