describe('Core context menu entries', () => {
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
    $('body').removeClass('fs-style-modern');
  });

  const entry = text => $('.fs-context-menu td').filter((i, td) => $(td).text() === text);

  it('show an icon and a shortcut, and keep their name as their text', () => {
    handsontable({ data: [[1, 2]], contextMenu: ['row_above', 'undo', 'redo', 'alignment'] });

    selectCell(0, 0);
    contextMenu();
    const undo = entry('Undo');

    expect(undo.length).toBe(1);
    expect(undo.find('.fs-menu-item__icon svg').length).toBe(1);
    expect(undo.find('.fs-menu-item__shortcut').attr('data-shortcut')).toMatch(/^(Ctrl\+Z|⌘Z)$/);
    expect(undo.attr('aria-keyshortcuts')).toBe('Control+Z');
    // The shortcut is drawn at the right of the name.
    const shortcut = undo.find('.fs-menu-item__shortcut').get(0);

    expect(getComputedStyle(shortcut, '::after').content).toMatch(/Ctrl\+Z|⌘Z/);
    expect(shortcut.getBoundingClientRect().left).toBeGreaterThan(undo.find('.fs-menu-item__label').get(0)
      .getBoundingClientRect().right);
    expect(entry('Insert row above').find('.fs-menu-item__icon svg').length).toBe(1);
    expect(entry('Insert row above').find('.fs-menu-item__shortcut').length).toBe(0);
  });

  it('take an icon and a shortcut of your own', () => {
    handsontable({ data: [[1]], contextMenu: { items: { mine: { name: 'Mine', icon: '<b class="my-icon">★</b>',
      shortcut: 'Ctrl+Shift+M', callback() {} } } } });

    selectCell(0, 0);
    contextMenu();

    expect(entry('★Mine').find('.fs-menu-item__icon .my-icon').length).toBe(1);
    expect(entry('★Mine').attr('aria-keyshortcuts')).toBe('Control+Shift+M');
  });

  it('look rounded in the Modern style', () => {
    $('body').addClass('fs-style-modern');
    handsontable({ data: [[1]], contextMenu: ['undo'] });

    selectCell(0, 0);
    contextMenu();

    expect($('.fs-context-menu').hasClass('fs-style-modern')).toBe(true);
    expect(parseFloat(getComputedStyle($('.fs-context-menu table.fs-core').get(0)).borderTopLeftRadius))
      .toBeGreaterThan(0);
  });
});
