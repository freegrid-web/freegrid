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

    hot.setCellStyle({ background: '#ffff00' });
    menu.executeCommand('formatting:clear');
    expect(hot.getCellMeta(0, 0).style).toBeUndefined();
    expect(hot.getCellMeta(1, 0).style).toBeUndefined();
  });

  const itemOf = (menu, text) => $(menu).find('.fs-core tbody td').filter((i, td) => $(td).text().endsWith(text));

  /** Opens Format ▸ Fill color in the context menu; returns the palette. */
  const openFillPalette = async() => {
    contextMenu();
    itemOf('.fs-context-menu', 'Format').simulate('mouseover');
    await sleep(350);
    itemOf('.fs-context-menu-sub_Format', 'Fill color').simulate('mouseover');
    await sleep(350);

    return $('.fs-context-menu-sub_Fill_color .fs-palette');
  };

  it('shows a color while the pointer is on it, sets it on a click, and closes every menu', async() => {
    const hot = handsontable({ data: [[1, 2], [3, 4]], contextMenu: ['alignment', 'formatting'] });

    selectCell(0, 0, 0, 1);
    const palette = await openFillPalette();

    expect(palette.find('[data-color]').length).toBe(70);
    palette.find('[data-color="#ffff00"]').simulate('mouseover');
    expect(hot.getCellMeta(0, 1).style).toEqual({ background: '#ffff00' });
    expect(getCell(0, 1).style.background).toContain('rgb(255, 255, 0)');
    palette.simulate('mouseleave');
    expect(hot.getCellMeta(0, 1).style).toBeUndefined();

    palette.find('[data-color="#ffff00"]').simulate('mouseover').simulate('mousedown');
    await sleep(50);

    expect(hot.getCellMeta(0, 0).style).toEqual({ background: '#ffff00' });
    expect($('.fs-context-menu:visible').length).toBe(0);
    hot.undo();
    expect(hot.getCellMeta(0, 0).style).toBeUndefined();
  });

  it('puts the cells back when the menu closes while a color is shown', async() => {
    const hot = handsontable({ data: [[1, 2], [3, 4]], contextMenu: ['alignment', 'formatting'] });

    selectCell(0, 0);
    const palette = await openFillPalette();

    palette.find('[data-color="#ff0000"]').simulate('mouseover');
    expect(hot.getCellMeta(0, 0).style).toEqual({ background: '#ff0000' });
    hot.getPlugin('contextMenu').close();

    expect(hot.getCellMeta(0, 0).style).toBeUndefined();
    expect(getCell(0, 0).style.background).toBe('');
    expect(hot.isUndoAvailable()).toBe(false);
  });

  describe('formatting bar', () => {
    afterEach(() => {
      $('.fs-formatting-bar').remove();
    });

    it('opens above the context menu and closes with it', async() => {
      handsontable({ data: [[1, 2], [3, 4]], contextMenu: true, formattingBar: true });

      selectCell(1, 1);
      contextMenu();
      await sleep(0);

      const bar = $('.fs-formatting-bar');
      const menu = $('.fs-context-menu').get(0).getBoundingClientRect();

      expect(bar.length).toBe(1);
      expect(bar.attr('role')).toBe('toolbar');
      expect(bar.get(0).getBoundingClientRect().bottom).toBeLessThanOrEqual(menu.top);
      expect(bar.find('[data-action]').map((i, b) => b.dataset.action).get())
        .toEqual(['bold', 'italic', 'underline', 'fill_color', 'text_color', 'left', 'center', 'right', 'clear']);

      $('body').simulate('mousedown');
      expect($('.fs-formatting-bar').length).toBe(0);
    });

    it('formats the selected cells and keeps the menu open', async() => {
      const hot = handsontable({ data: [[1, 2], [3, 4]], contextMenu: true, formattingBar: true });

      selectCell(0, 0, 1, 0);
      contextMenu();
      await sleep(0);
      const button = action => $(`.fs-formatting-bar [data-action="${action}"]`);

      button('bold').simulate('mousedown');
      expect(hot.getCellMeta(1, 0).style).toEqual({ fontWeight: 'bold' });
      expect(button('bold').attr('aria-pressed')).toBe('true');
      expect($('.fs-context-menu:visible').length).toBe(1);

      button('center').simulate('mousedown');
      expect(hot.getCellMeta(0, 0).className).toContain('fs-center');
      expect(button('center').attr('aria-pressed')).toBe('true');

      // The color buttons set the last chosen color; the arrow opens the palette.
      button('fill_color').simulate('mousedown');
      expect(hot.getCellMeta(0, 0).style.background).toBe('#ffff00');
      $('.fs-formatting-bar [data-palette="fill_color"]').simulate('mousedown');
      $('.fs-formatting-bar .fs-palette [data-color="#00b050"]').simulate('mouseover').simulate('mousedown');
      expect(hot.getCellMeta(0, 0).style.background).toBe('#00b050');
      expect($('.fs-formatting-bar .fs-palette').length).toBe(0);
      expect($('.fs-formatting-bar [data-color-of="fill_color"]').get(0).style.background).toContain('rgb(0, 176, 80)');

      button('clear').simulate('mousedown');
      expect(hot.getCellMeta(0, 0).style).toBeUndefined();
      hot.undo();
      expect(hot.getCellMeta(0, 0).style).toEqual({ fontWeight: 'bold', background: '#00b050' });
    });

    it('previews palette colors and puts the cells back when it closes without a choice', async() => {
      const hot = handsontable({ data: [[1, 2], [3, 4]], contextMenu: true, formattingBar: true });

      selectCell(0, 0);
      contextMenu();
      await sleep(0);
      $('.fs-formatting-bar [data-palette="text_color"]').simulate('mousedown');
      $('.fs-formatting-bar .fs-palette [data-color="#c00000"]').simulate('mouseover');
      expect(getCell(0, 0).style.color).toBe('rgb(192, 0, 0)');

      $('body').simulate('mousedown');
      expect(hot.getCellMeta(0, 0).style).toBeUndefined();
      expect(getCell(0, 0).style.color).toBe('');
      expect(hot.isUndoAvailable()).toBe(false);
    });

    it('shows the buttons of its items setting', async() => {
      handsontable({ data: [[1]], contextMenu: true, formattingBar: { items: ['italic', 'strikethrough'] } });

      selectCell(0, 0);
      contextMenu();
      await sleep(0);

      expect($('.fs-formatting-bar [data-action]').map((i, b) => b.dataset.action).get())
        .toEqual(['italic', 'strikethrough']);
    });
  });
});
