describe('Core paste special', () => {
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

  const clipboardEvent = () => ({
    clipboardData: { data: {}, getData(type) { return this.data[type] || ''; }, setData(type, value) { this.data[type] = value; } },
    preventDefault() {},
  });

  /** A grid with a formula and a bold cell, A1:B2 copied. */
  const copied = async() => {
    const engine = await import(/* @vite-ignore */ '/node_modules/@ironcalc/wasm/wasm.js');

    await engine.default({ module_or_path: '/node_modules/@ironcalc/wasm/wasm_bg.wasm' });
    const hot = handsontable({
      data: [[1, '=A1*10', null, null], [2, 'x', null, null], [null, null, null, null], [null, null, null, null]],
      formulas: { engine: engine.Model },
      contextMenu: ['copy', 'paste', 'paste_special'],
      cell: [{ row: 0, col: 0, style: { fontWeight: 'bold' } }],
    });
    const plugin = hot.getPlugin('copyPaste');

    selectCell(0, 0, 1, 1);
    plugin.setCopyableText();
    plugin.onCopy(clipboardEvent());

    return { hot, plugin };
  };

  it('pastes all (formulas with formatting), values only or formulas only', async() => {
    const { hot, plugin } = await copied();

    selectCell(2, 2);
    await plugin.pasteSpecial('all');
    expect(hot.getSourceDataAtCell(2, 3)).toBe('=C3*10');
    expect(hot.getCellMeta(2, 2).style).toEqual({ fontWeight: 'bold' });

    hot.undo();
    expect(hot.getSourceDataAtCell(2, 3)).toBe(null);
    expect(hot.getCellMeta(2, 2).style).toBeUndefined();

    await plugin.pasteSpecial('values');
    expect(hot.getSourceDataAtCell(2, 3)).toBe(10);
    expect(hot.getCellMeta(2, 2).style).toBeUndefined();

    selectCell(2, 0);
    await plugin.pasteSpecial('formulas');
    expect(hot.getSourceDataAtCell(2, 1)).toBe('=A3*10');
    expect(hot.getCellMeta(2, 0).style).toBeUndefined();
  });

  it('pastes only the formatting, or transposed', async() => {
    const { hot, plugin } = await copied();

    selectCell(2, 2);
    await plugin.pasteSpecial('formats');
    expect(hot.getDataAtCell(2, 2)).toBe(null);
    expect(hot.getCellMeta(2, 2).style).toEqual({ fontWeight: 'bold' });

    selectCell(2, 2);
    await plugin.pasteSpecial('transpose');
    // The formula moves with the paste: =C3*10.
    expect(hot.getData(2, 2, 3, 3)).toEqual([[1, 2], [10, 'x']]);
  });

  it('is in the context menu with the keys paste and paste_special', async() => {
    await copied();
    contextMenu();
    const text = $('.fs-context-menu td').map((i, td) => $(td).text()).get();

    expect(text).toContain('Paste');
    expect(text).toContain('Paste special');
  });
});
