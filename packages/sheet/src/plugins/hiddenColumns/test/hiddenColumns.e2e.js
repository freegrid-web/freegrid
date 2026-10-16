describe('HiddenColumns', () => {
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

  const data = () => [['A1', 'B1', 'C1', 'D1'], ['A2', 'B2', 'C2', 'D2']];
  const columnHeaderTexts = () => Array.from(spec().$container[0].querySelectorAll('.ht_clone_top thead th'))
    .map(TH => TH.textContent);

  it('hides the columns listed in the settings: they leave the visual order', () => {
    handsontable({ data: data(), colHeaders: true, hiddenColumns: { columns: [1] } });

    expect(countCols()).toBe(3);
    expect(getDataAtRow(0)).toEqual(['A1', 'C1', 'D1']);
    expect(getPlugin('hiddenColumns').hot.toPhysicalColumn(1)).toBe(2);
    expect(getPlugin('hiddenColumns').hot.toVisualColumn(1)).toBeNull();
    expect(columnHeaderTexts()).toEqual(['A', 'C', 'D']);
  });

  it('keeps object data and column settings on the right columns', async() => {
    handsontable({
      data: [{ a: 1, b: 2, c: 3 }],
      columns: [{ data: 'a' }, { data: 'b', readOnly: true }, { data: 'c', type: 'numeric' }],
      colHeaders: ['First', 'Second', 'Third'],
      hiddenColumns: { columns: [1] },
    });

    expect(getDataAtRow(0)).toEqual([1, 3]);
    expect(colToProp(1)).toBe('c');
    expect(propToCol('c')).toBe(1);
    expect(getCellMeta(0, 1).type).toBe('numeric');
    expect(columnHeaderTexts()).toEqual(['First', 'Third']);

    setDataAtCell(0, 1, 30);
    await sleep(100); // The numeric validator runs first.

    expect(getSourceDataAtRow(0)).toEqual({ a: 1, b: 2, c: 30 });
  });

  it('hides and shows columns with the API, and marks the headers next to them', () => {
    const hot = handsontable({ data: data(), colHeaders: true, hiddenColumns: true });
    const plugin = hot.getPlugin('hiddenColumns');

    plugin.hideColumns([1, 2]);

    expect(getDataAtRow(0)).toEqual(['A1', 'D1']);
    expect(plugin.getHiddenColumns()).toEqual([1, 2]);
    expect(hot.view.wt.wtTable.getColumnHeader(0).classList.contains('fs-hidden-after')).toBe(true);
    expect(hot.view.wt.wtTable.getColumnHeader(1).classList.contains('fs-hidden-before')).toBe(true);

    plugin.showColumns([2]);

    expect(getDataAtRow(0)).toEqual(['A1', 'C1', 'D1']);

    plugin.showAllColumns();

    expect(countCols()).toBe(4);
  });

  it('inserts a column after the hidden columns before it', () => {
    handsontable({ data: data(), hiddenColumns: { columns: [1] } });

    alter('insert_col', 1);

    expect(getDataAtRow(0)).toEqual(['A1', null, 'C1', 'D1']);
    expect(getPlugin('hiddenColumns').getHiddenColumns()).toEqual([1]);
  });

  it('copies only the visible columns', () => {
    const hot = handsontable({ data: data(), hiddenColumns: { columns: [1, 2] } });

    expect(hot.getCopyableText(0, 0, 1, 1)).toBe('A1\tD1\nA2\tD2');
  });
});
