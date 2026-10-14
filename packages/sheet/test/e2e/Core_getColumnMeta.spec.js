describe('Core_getColumnMeta', () => {
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

  it('returns the grid settings together with the column settings from `columns`', () => {
    const hot = handsontable({
      data: [[1, 2], [3, 4]],
      readOnly: true,
      columns: [{ type: 'numeric' }, { readOnly: false }],
    });

    expect(hot.getColumnMeta(0).type).toBe('numeric');
    expect(hot.getColumnMeta(0).readOnly).toBe(true);
    expect(hot.getColumnMeta(1).readOnly).toBe(false);
  });

  it('is the object the column\'s cell meta inherits from', () => {
    const hot = handsontable({ data: [[1, 2]], columns: [{}, { className: 'a' }] });

    expect(Object.getPrototypeOf(hot.getCellMeta(0, 1))).toBe(hot.getColumnMeta(1));
  });

  it('takes a visual column index', () => {
    const hot = handsontable({
      data: [[1, 2, 3]],
      columns: [{ className: 'first' }, { className: 'second' }, { className: 'third' }],
      manualColumnMove: [2, 0, 1],
    });

    expect(hot.getColumnMeta(0).className).toBe('third');
  });

  it('creates no cell meta and runs no cell meta hooks', () => {
    const beforeGetCellMeta = jasmine.createSpy('beforeGetCellMeta');
    // 40 columns in a 100px wide grid: the last column is not rendered, so it has no cell meta yet.
    const hot = handsontable({ data: Handsontable.helper.createSpreadsheetData(1, 40), width: 100, height: 100 });

    hot.addHook('beforeGetCellMeta', beforeGetCellMeta);
    const before = hot.getCellsMeta().length;

    hot.getColumnMeta(39);

    expect(hot.getCellsMeta().length).toBe(before);
    expect(beforeGetCellMeta).not.toHaveBeenCalled();
  });
});
