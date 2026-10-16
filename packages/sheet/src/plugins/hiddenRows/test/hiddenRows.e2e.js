describe('HiddenRows', () => {
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

  const data = () => [['A1', 1], ['A2', 2], ['A3', 3], ['A4', 4], ['A5', 5], ['A6', 6]];
  const firstColumn = () => getDataAtCol(0);
  const rowHeaderTexts = () => Array.from(spec().$container[0].querySelectorAll('.ht_clone_left tbody th'))
    .map(TH => TH.textContent);
  const rowHeaderTH = row => spec().$container.data('handsontable').view.wt.wtTable.getCell({ row, col: -1 });
  const clickMenuItem = (text) => {
    $('.htContextMenu .ht_master .htCore tbody td').not('.htSeparator')
      .filter((_, td) => td.textContent === text).simulate('mousedown');
  };

  it('hides the rows listed in the settings: they leave the visual order', () => {
    handsontable({ data: data(), rowHeaders: true, hiddenRows: { rows: [1, 2] } });

    expect(countRows()).toBe(4);
    expect(countSourceRows()).toBe(6);
    expect(firstColumn()).toEqual(['A1', 'A4', 'A5', 'A6']);
    expect(getSourceDataAtCell(1, 0)).toBe('A2');
    expect(getPlugin('hiddenRows').hot.toPhysicalRow(1)).toBe(3);
    expect(getPlugin('hiddenRows').hot.toVisualRow(3)).toBe(1);
    expect(getPlugin('hiddenRows').hot.toVisualRow(1)).toBeNull();
  });

  it('keeps the row numbers of the visible rows in the headers (gaps where rows are hidden)', () => {
    handsontable({ data: data(), rowHeaders: true, hiddenRows: { rows: [1, 2] } });

    expect(rowHeaderTexts()).toEqual(['1', '4', '5', '6']);
    expect(getRowHeader(1)).toBe(4);
  });

  it('marks the headers next to hidden rows, unless indicators are turned off', () => {
    handsontable({ data: data(), rowHeaders: true, hiddenRows: { rows: [1, 2] } });

    expect(rowHeaderTH(0).classList.contains('fs-hidden-after')).toBe(true);
    expect(rowHeaderTH(1).classList.contains('fs-hidden-before')).toBe(true);
    expect(rowHeaderTH(2).classList.contains('fs-hidden-before')).toBe(false);

    updateSettings({ hiddenRows: { rows: [1, 2], indicators: false } });

    expect(rowHeaderTH(0).classList.contains('fs-hidden-after')).toBe(false);
    expect(rowHeaderTH(1).classList.contains('fs-hidden-before')).toBe(false);
  });

  it('hides and shows rows with the API, running the hooks', () => {
    const beforeHide = jasmine.createSpy('beforeHideRows');
    const afterHide = jasmine.createSpy('afterHideRows');
    const afterUnhide = jasmine.createSpy('afterUnhideRows');
    const hot = handsontable({ data: data(), hiddenRows: true, beforeHideRows: beforeHide,
      afterHideRows: afterHide, afterUnhideRows: afterUnhide });
    const plugin = hot.getPlugin('hiddenRows');

    plugin.hideRows([1, 3]);

    expect(firstColumn()).toEqual(['A1', 'A3', 'A5', 'A6']);
    expect(plugin.getHiddenRows()).toEqual([1, 3]);
    expect(plugin.isHidden(3)).toBe(true);
    expect(beforeHide.calls.argsFor(0)[0]).toEqual([1, 3]);
    expect(afterHide.calls.argsFor(0).slice(0, 2)).toEqual([[1, 3], []]);

    // Visual row 1 is now A3.
    plugin.hideRows([1]);
    expect(plugin.getHiddenRows()).toEqual([1, 2, 3]);

    plugin.showRows([2]);
    expect(firstColumn()).toEqual(['A1', 'A3', 'A5', 'A6']);
    expect(afterUnhide.calls.argsFor(0).slice(0, 2)).toEqual([[2], [1, 2, 3]]);

    plugin.showAllRows();
    expect(countRows()).toBe(6);
  });

  it('does not hide rows when beforeHideRows returns false', () => {
    const hot = handsontable({ data: data(), hiddenRows: true, beforeHideRows: () => false });

    hot.getPlugin('hiddenRows').hideRows([0]);

    expect(countRows()).toBe(6);
  });

  it('keeps the same rows hidden when the rows are sorted', () => {
    handsontable({ data: data(), hiddenRows: { rows: [0, 1] }, columnSorting: true });

    getPlugin('columnSorting').sort({ column: 1, sortOrder: 'desc' });

    expect(firstColumn()).toEqual(['A6', 'A5', 'A4', 'A3']);

    getPlugin('columnSorting').sort({ column: 1, sortOrder: 'asc' });

    expect(firstColumn()).toEqual(['A3', 'A4', 'A5', 'A6']);
  });

  it('inserts a row after the hidden rows above it, and keeps them hidden', () => {
    handsontable({ data: data(), hiddenRows: { rows: [1, 2] } });

    alter('insert_row', 1);

    expect(countRows()).toBe(5);
    expect(firstColumn()).toEqual(['A1', null, 'A4', 'A5', 'A6']);
    expect(getPlugin('hiddenRows').getHiddenRows()).toEqual([1, 2]);
    expect(getSourceDataAtCell(3, 0)).toBe(null);
  });

  it('moves the hidden rows when rows above them are removed', () => {
    handsontable({ data: data(), hiddenRows: { rows: [3] } });

    alter('remove_row', 0, 2);

    expect(firstColumn()).toEqual(['A3', 'A5', 'A6']);
    expect(getPlugin('hiddenRows').getHiddenRows()).toEqual([1]);
  });

  it('skips hidden rows when moving the selection with the keyboard', () => {
    handsontable({ data: data(), hiddenRows: { rows: [1, 2] } });

    selectCell(0, 0);
    keyDownUp('arrow_down');

    expect(getSelectedLast()).toEqual([1, 0, 1, 0]);
    expect(getDataAtCell(1, 0)).toBe('A4');
  });

  it('copies only the visible rows', () => {
    const hot = handsontable({ data: data(), hiddenRows: { rows: [1, 2] } });

    expect(hot.getCopyableText(0, 0, 1, 1)).toBe('A1\t1\nA4\t4');
  });

  it('hides the selected rows and shows them again from the context menu', () => {
    handsontable({ data: data(), rowHeaders: true, contextMenu: true, hiddenRows: true });

    selectCell(1, 0, 2, 1);
    contextMenu();
    clickMenuItem('Hide rows');

    expect(firstColumn()).toEqual(['A1', 'A4', 'A5', 'A6']);

    selectCell(0, 0, 1, 0);
    contextMenu();
    clickMenuItem('Show rows');

    expect(countRows()).toBe(6);
  });

  it('shows arrows with a tooltip next to hidden rows; a click on one shows them, without selecting the row', () => {
    handsontable({ data: data(), rowHeaders: true, hiddenRows: { rows: [1, 2] } });

    const toggle = rowHeaderTH(1).querySelector('.fs-hidden-toggle--before');

    expect(rowHeaderTH(0).querySelector('.fs-hidden-toggle--after')).not.toBeNull();
    expect(rowHeaderTH(2).querySelector('.fs-hidden-toggle')).toBeNull();
    expect(toggle.title).toBe('Show rows: 2–3');

    $(toggle).simulate('mousedown');

    expect(countRows()).toBe(6);
    expect(getSelected()).toBeUndefined();
    expect(spec().$container[0].querySelector('.fs-hidden-toggle')).toBeNull();
  });

  it('selects the row after a click on its header away from the arrow', () => {
    handsontable({ data: data(), rowHeaders: true, hiddenRows: { rows: [1, 2] } });

    $(rowHeaderTH(1)).simulate('mousedown');
    $(rowHeaderTH(1)).simulate('mouseup');

    expect(countRows()).toBe(4);
    expect(getSelectedLast()[0]).toBe(1);
  });

  it('shows the hidden columns after a click on the arrow in a column header', () => {
    const hot = handsontable({ data: data(), colHeaders: true, hiddenColumns: { columns: [1] } });

    const toggle = hot.view.wt.wtTable.getColumnHeader(0).querySelector('.fs-hidden-toggle--after');

    expect(toggle.title).toBe('Show column: B');

    $(toggle).simulate('mousedown');

    expect(countCols()).toBe(2);
  });

  it('undoes and redoes hiding', () => {
    const hot = handsontable({ data: data(), hiddenRows: true });

    hot.getPlugin('hiddenRows').hideRows([0, 1]);
    hot.undo();

    expect(countRows()).toBe(6);

    hot.redo();

    expect(firstColumn()).toEqual(['A3', 'A4', 'A5', 'A6']);
  });

  it('shows every row when turned off', () => {
    handsontable({ data: data(), hiddenRows: { rows: [1] } });

    updateSettings({ hiddenRows: false });

    expect(countRows()).toBe(6);
  });
  it('moves visible rows past hidden rows (moveRows takes visual rows)', () => {
    handsontable({ data: data(), hiddenRows: { rows: [1, 2] }, manualRowMove: true });

    // Visual rows: A1, A4, A5, A6. Move A1 to before A6.
    getPlugin('manualRowMove').moveRows([0], 3);
    render();

    expect(firstColumn()).toEqual(['A4', 'A5', 'A1', 'A6']);
    expect(getPlugin('hiddenRows').getHiddenRows()).toEqual([1, 2]);

    getPlugin('hiddenRows').showAllRows();

    expect(firstColumn()).toEqual(['A2', 'A3', 'A4', 'A5', 'A1', 'A6']);
  });

  it('moves merged cells with their rows, and does not hide rows inside a merged cell', () => {
    handsontable({ data: data(), hiddenRows: true, mergeCells: [{ row: 3, col: 0, rowspan: 2, colspan: 1 }] });

    getPlugin('hiddenRows').hideRows([4]);
    expect(countRows()).toBe(6);

    getPlugin('hiddenRows').hideRows([1]);
    expect(getCell(2, 0).rowSpan).toBe(2);
    expect(getDataAtCell(2, 0)).toBe('A4');

    getPlugin('hiddenRows').showAllRows();
    expect(getCell(3, 0).rowSpan).toBe(2);
  });
});
