describe('Core status bar', () => {
  const id = 'testContainer';

  beforeEach(function() {
    this.$container = $(`<div id="${id}"></div>`).appendTo('body');
  });

  afterEach(function() {
    if (this.$container) {
      destroy();
      this.$container.remove();
    }
    $('.fs-sheet-tabs, .fs-context-menu').remove();
  });

  const bar = () => $('.fs-status-bar');
  const items = () => bar().find('.fs-status-bar__item').map((i, item) => item.textContent).get();

  it('shows the average, count and sum of the selected cells, below the grid', () => {
    handsontable({ data: [[1, 'text', 3], [4, null, 6.5]], statusBar: true });

    expect(bar().length).toBe(1);
    expect(bar().attr('role')).toBe('status');
    expect(bar().prev().hasClass('fs-document__sheet')).toBe(true);
    expect(items()).toEqual([]);

    selectCell(0, 0, 1, 2);
    // Count counts every value; average and sum the numbers.
    expect(items()).toEqual(['Average: 3.625', 'Count: 5', 'Sum: 14.5']);

    // One cell: nothing to sum up.
    selectCell(0, 0);
    expect(items()).toEqual([]);

    // Only text: the count.
    selectCell(0, 1, 1, 1);
    expect(items()).toEqual(['Count: 1']);
  });

  it('follows changes, formula results, its items setting and several ranges', async() => {
    const engine = await import(/* @vite-ignore */ '/node_modules/@ironcalc/wasm/wasm.js');

    await engine.default({ module_or_path: '/node_modules/@ironcalc/wasm/wasm_bg.wasm' });
    const hot = handsontable({ data: [[2, '=A1*5'], [8, 1]], formulas: { engine: engine.Model },
      statusBar: { items: ['min', 'max', 'numericalCount', 'sum'] } });

    selectCell(0, 0, 0, 1);
    expect(items()).toEqual(['Min: 2', 'Max: 10', 'Numerical count: 2', 'Sum: 12']);

    hot.setDataAtCell(0, 0, 3);
    expect(items()).toEqual(['Min: 3', 'Max: 15', 'Numerical count: 2', 'Sum: 18']);

    hot.selectCells([[1, 0], [1, 1]]);
    expect(items()).toEqual(['Min: 1', 'Max: 8', 'Numerical count: 2', 'Sum: 9']);
  });

  it('shows the active sheet\'s selection, below the sheet tabs', () => {
    const hot = handsontable({ data: [[1, 2]], statusBar: true, sheetTabs: true });
    const costs = hot.addSheet('costs', { data: [[10, 20, 30]] });

    hot.activateSheet('costs');
    costs.selectCell(0, 0, 0, 2);
    expect(items()).toEqual(['Average: 20', 'Count: 3', 'Sum: 60']);
    expect(bar().prev().hasClass('fs-sheet-tabs')).toBe(true);

    hot.activateSheet('sheet1');
    hot.selectCell(0, 0, 0, 1);
    expect(items()).toEqual(['Average: 1.5', 'Count: 2', 'Sum: 3']);
  });

  it('keeps the sheets of the sheets setting', () => {
    const hot = handsontable({ data: [[1]], statusBar: true, sheets: [{ id: 'costs', name: 'Costs', data: [[5, 6]] }] });

    expect(hot.getSheets().map(sheet => sheet.id)).toEqual(['sheet1', 'costs']);
    hot.activateSheet('costs');
    hot.getSheet('costs').selectCell(0, 0, 0, 1);
    expect(items()).toEqual(['Average: 5.5', 'Count: 2', 'Sum: 11']);
  });

  it('shows items of your own, renames and formats the built-in ones', () => {
    handsontable({
      data: [[1, 2.5, 'x'], [4, 10, null]],
      statusBar: {
        items: [
          { item: 'sum', label: 'Total', format: { style: 'currency', currency: 'EUR' } },
          'average',
          { label: 'Median', value: ({ numbers }) => [...numbers].sort((a, b) => a - b)[Math.floor(numbers.length / 2)] },
          { label: 'Cells', value: ({ cells }) => cells.length, format: value => `${value} selected` },
          { value: () => null },
        ],
        format: { maximumFractionDigits: 1 },
      },
    });

    selectCell(0, 0, 1, 2);
    expect(items()).toEqual(['Total: €17.50', 'Average: 4.4', 'Median: 4', 'Cells: 6 selected']);
  });

  it('formats every number with a function of the bar, which gets the item', () => {
    handsontable({
      data: [[1000, 2000]],
      statusBar: { items: ['sum', 'count'], format: (value, { item }) => (item === 'sum' ? `${value / 1000}k` : value) },
    });

    selectCell(0, 0, 0, 1);
    expect(items()).toEqual(['Sum: 3k', 'Count: 2']);
  });

  it('shows left items always, and refreshes for state of your own', () => {
    let saved = false;
    const hot = handsontable({
      data: [[1, 2]],
      statusBar: { items: [{ align: 'left', value: () => (saved ? 'Saved' : 'Unsaved changes') }, 'sum',
        { label: 'Rows', value: ({ grid }) => grid.countRows(), always: true }] },
    });
    const left = () => bar().find('.fs-status-bar__left .fs-status-bar__item').map((i, item) => item.textContent).get();

    expect(left()).toEqual(['Unsaved changes']);
    expect(items()).toEqual(['Unsaved changes', 'Rows: 1']);

    saved = true;
    hot.getPlugin('statusBar').refresh();
    expect(left()).toEqual(['Saved']);

    selectCell(0, 0, 0, 1);
    expect(items()).toEqual(['Saved', 'Sum: 3', 'Rows: 1']);
  });

  it('goes away when the setting is turned off', () => {
    const hot = handsontable({ data: [[1, 2]], statusBar: true });

    hot.updateSettings({ statusBar: false });
    expect(bar().length).toBe(0);
  });
});

describe('Core freeze menu', () => {
  const id = 'testContainer';

  beforeEach(function() {
    this.$container = $(`<div id="${id}" style="width: 400px; height: 200px; overflow: hidden"></div>`)
      .appendTo('body');
  });

  afterEach(function() {
    if (this.$container) {
      destroy();
      this.$container.remove();
    }
    $('.fs-context-menu').remove();
  });

  it('freezes panes at the selected cell, the top row or the first column, and unfreezes', () => {
    const hot = handsontable({ data: createSpreadsheetData(20, 10), contextMenu: ['freeze'] });
    const menu = hot.getPlugin('contextMenu');

    selectCell(2, 3);
    contextMenu();
    expect($('.fs-context-menu td').filter((i, td) => $(td).text() === 'Freeze').length).toBe(1);

    menu.executeCommand('freeze:panes');
    expect(hot.getSettings().fixedRowsTop).toBe(2);
    expect(hot.getSettings().fixedColumnsLeft).toBe(3);

    menu.executeCommand('freeze:top_row');
    expect([hot.getSettings().fixedRowsTop, hot.getSettings().fixedColumnsLeft]).toEqual([1, 0]);

    menu.executeCommand('freeze:first_column');
    expect([hot.getSettings().fixedRowsTop, hot.getSettings().fixedColumnsLeft]).toEqual([0, 1]);

    menu.executeCommand('freeze:unfreeze');
    expect([hot.getSettings().fixedRowsTop, hot.getSettings().fixedColumnsLeft]).toEqual([0, 0]);
  });
});
