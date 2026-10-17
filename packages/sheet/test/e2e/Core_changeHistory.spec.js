describe('Core change history', () => {
  const id = 'testContainer';

  beforeEach(function() {
    this.$container = $(`<div id="${id}" style="width: 900px; height: 400px"></div>`).appendTo('body');
  });

  afterEach(function() {
    if (this.$container) {
      destroy();
      this.$container.remove();
    }
    $('.fs-context-menu, .fs-sheet-tabs').remove();
  });

  it('records edits with the old and new values, rows added and removed, the user and the time', () => {
    const hot = handsontable({ data: [[1, 2], [3, 4]], changeHistory: { user: 'Ada' } });
    const history = hot.getPlugin('changeHistory');

    hot.setDataAtCell(0, 1, 20);
    hot.setDataAtCell([[1, 0, 30], [1, 1, 40]]);
    hot.alter('insert_row', 1, 2);
    hot.undo();

    const changes = history.getChanges();

    expect(changes.map(change => change.kind)).toEqual(['edit', 'edit', 'insert_row', 'remove_row']);
    expect(changes[0]).toEqual(jasmine.objectContaining({ user: 'Ada',
      cells: [{ row: 0, col: 1, before: 2, after: 20 }] }));
    expect(changes[1].cells.length).toBe(2);
    expect(changes[2]).toEqual(jasmine.objectContaining({ index: 1, amount: 2 }));
    expect(Date.now() - changes[0].time).toBeLessThan(5000);

    history.clearChanges();
    expect(history.getChanges()).toEqual([]);
  });

  it('does not record loading data, and keeps the last changes up to its limit', () => {
    const hot = handsontable({ data: [[1]], changeHistory: { limit: 2 } });

    hot.loadData([[5]]);
    [1, 2, 3].forEach(value => hot.setDataAtCell(0, 0, value));

    expect(hot.getPlugin('changeHistory').getChanges().map(change => change.cells[0].after)).toEqual([2, 3]);
  });

  it('lists the changes in the Changes panel, newest first; a click selects the cells', () => {
    const hot = handsontable({ data: [[1, 2], [3, 4]], changeHistory: { user: 'Ada' },
      contextMenu: ['show_changes'], sidePanel: true });

    hot.setDataAtCell(0, 0, 10);
    hot.setDataAtCell([[1, 0, 'x'], [1, 1, 'y']]);
    selectCell(0, 0);
    contextMenu();
    hot.getPlugin('contextMenu').executeCommand('show_changes');

    expect(hot.getOpenPanel()).toBe('changes');
    const cards = $('.fs-changes-panel__change');

    expect(cards.length).toBe(2);
    expect($('.fs-changes-panel__day').first().text()).toBe('Today');
    expect(cards.eq(0).find('.fs-changes-panel__what').text()).toBe('2 cells in A2:B2');
    expect(cards.eq(1).find('.fs-changes-panel__what').text()).toBe('A1');
    expect(cards.eq(1).find('.fs-changes-panel__value').text()).toBe('1 → 10');
    expect(cards.eq(1).text()).toContain('Ada');

    cards.eq(0).simulate('click');
    expect(getSelected()).toEqual([[1, 0, 1, 1]]);

    // A new change shows at once.
    hot.setDataAtCell(0, 1, 'z');
    expect($('.fs-changes-panel__change').length).toBe(3);

    // Only the changes of the selected cells.
    selectCell(0, 0);
    $('.fs-changes-panel__filter').val('selection').get(0).dispatchEvent(new Event('change'));
    expect($('.fs-changes-panel__change').length).toBe(1);
  });
});
