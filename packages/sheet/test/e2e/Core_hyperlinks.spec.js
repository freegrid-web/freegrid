describe('Core hyperlinks', () => {
  const id = 'testContainer';

  beforeEach(function() {
    this.$container = $(`<div id="${id}"></div>`).appendTo('body');
  });

  afterEach(function() {
    if (this.$container) {
      destroy();
      this.$container.remove();
    }
    $('.fs-link-card, .fs-link-editor, .fs-context-menu').remove();
  });

  it('draws linked cells, and shows the address under a selected one', () => {
    handsontable({ data: [['FreeGrid', 'plain']], cell: [{ row: 0, col: 0, link: 'https://example.com/a' }] });

    expect(getCell(0, 0).classList.contains('fs-link')).toBe(true);
    expect(getCell(0, 1).classList.contains('fs-link')).toBe(false);

    selectCell(0, 0);
    const address = $('.fs-link-card a');

    expect(address.attr('href')).toBe('https://example.com/a');
    expect(address.attr('target')).toBe('_blank');
    expect(address.attr('rel')).toBe('noopener noreferrer');

    selectCell(0, 1);
    expect($('.fs-link-card').length).toBe(0);
  });

  it('edits the text and the link with Ctrl+K, in one undo step, and refuses other addresses', () => {
    const hot = handsontable({ data: [['old']] });

    selectCell(0, 0);
    keyDownUp(75, { ctrlKey: true });
    const editor = $('.fs-link-editor');

    expect(editor.length).toBe(1);
    editor.find('[name="text"]').val('Docs');
    editor.find('[name="link"]').val('javascript:alert(1)');
    editor.find('.fs-link-editor__apply').simulate('click');
    expect(editor.find('[name="link"]').attr('aria-invalid')).toBe('true');
    expect(hot.getCellMeta(0, 0).link).toBeUndefined();

    editor.find('[name="link"]').val('example.com/docs');
    editor.find('.fs-link-editor__apply').simulate('click');
    expect(hot.getDataAtCell(0, 0)).toBe('Docs');
    expect(hot.getCellMeta(0, 0).link).toBe('https://example.com/docs');
    expect($('.fs-link-editor').length).toBe(0);

    hot.undo();
    expect(hot.getDataAtCell(0, 0)).toBe('old');
    expect(hot.getCellMeta(0, 0).link).toBeUndefined();
  });

  it('removes a link from its card, and has an entry in the context menu', () => {
    const hot = handsontable({ data: [['a']], contextMenu: true, cell: [{ row: 0, col: 0, link: 'mailto:a@b.c' }] });

    selectCell(0, 0);
    contextMenu();
    expect($('.fs-context-menu td').filter((i, td) => $(td).text() === 'Edit link').length).toBe(1);
    hot.getPlugin('contextMenu').close();

    selectCell(0, 0);
    $('.fs-link-card .fs-link-button').filter((i, button) => button.textContent === 'Remove').simulate('click');
    expect(hot.getCellMeta(0, 0).link).toBeUndefined();
    expect(getCell(0, 0).classList.contains('fs-link')).toBe(false);
  });

  it('is kept by getDocument and by Excel files', async() => {
    const hot = handsontable({ data: [['site', 'mail']] });

    hot.getPlugin('hyperlinks').setLink(0, 0, 'https://example.com');
    hot.getPlugin('hyperlinks').setLink(0, 1, 'mailto:team@example.com');
    expect(hot.getDocument().sheets[0].cell).toEqual(jasmine.arrayContaining([
      jasmine.objectContaining({ row: 0, col: 0, link: 'https://example.com' })]));

    const blob = await hot.exportFile('xlsx');

    destroy();
    const next = handsontable({ data: [[null]] });

    await next.importFile(blob);
    expect(next.getActiveSheet().getCellMeta(0, 0).link).toBe('https://example.com');
    expect(next.getActiveSheet().getCellMeta(0, 1).link).toBe('mailto:team@example.com');
    $('.fs-sheet-tabs').remove();
  });
});
