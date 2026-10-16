describe('Core files (xlsx, csv)', () => {
  const id = 'testContainer';
  let Model;

  beforeAll(async() => {
    const engine = await import(/* @vite-ignore */ '/node_modules/@ironcalc/wasm/wasm.js');

    await engine.default({ module_or_path: '/node_modules/@ironcalc/wasm/wasm_bg.wasm' });
    Model = engine.Model;
  });

  beforeEach(function() {
    this.$container = $(`<div id="${id}" style="width: 800px; height: 300px"></div>`).appendTo('body');
  });

  afterEach(function() {
    if (this.$container) {
      destroy();
      this.$container.remove();
    }
    $('.fs-sheet-tabs, .fs-context-menu').remove();
  });

  /** A new grid in the container, for the file to go into. */
  const fresh = (settings = {}) => {
    destroy();
    $('.fs-sheet-tabs').remove();

    return handsontable({ data: [[null]], ...settings });
  };

  it('exports the document as an .xlsx file and imports it back', async() => {
    const hot = handsontable({
      data: [['Region', 'Q1', 'Total'], ['North', 1200.5, '=B2*2'], ['South', 900, '=B3*2']],
      sheetName: 'Sales',
      formulas: { engine: Model },
      colWidths: [120, 80, 90],
      fixedRowsTop: 1,
      comments: true,
      mergeCells: [{ row: 0, col: 1, rowspan: 1, colspan: 2 }],
      hiddenRows: { rows: [2] },
      conditionalFormatting: [{ range: 'C2:C3', when: 'gt', value: 2000, style: { color: '#c00000' } }],
      cell: [
        { row: 0, col: 0, style: { fontWeight: 'bold', background: '#d9e1f2' }, className: 'fs-center' },
        { row: 1, col: 1, type: 'numeric', numericFormat: { pattern: '0,0.00' } },
        { row: 1, col: 0, comment: { value: 'Check', author: 'Ada' } },
      ],
    });

    hot.addSheet('dates', { name: 'Dates', data: [['2026-01-15']], columns: [{ type: 'date', dateFormat: 'YYYY-MM-DD' }] });

    const blob = await hot.exportFile('xlsx');

    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(blob.size).toBeGreaterThan(1000);

    const next = fresh({ formulas: { engine: Model } });

    await next.importFile(blob);

    expect(next.getSheets()).toEqual([{ id: 'sheet1', name: 'Sales' }, { id: 'sheet2', name: 'Dates' }]);
    expect(next.getSourceDataAtRow(1)).toEqual(['North', 1200.5, '=B2*2']);
    expect(next.getDataAtCell(1, 2)).toBe(2401);
    expect(next.getCellMeta(0, 0).style).toEqual({ fontWeight: 'bold', background: '#d9e1f2' });
    expect(next.getCellMeta(0, 0).className).toBe('fs-center');
    expect(next.getCellMeta(1, 1).numericFormat).toEqual({ pattern: '0,0.00' });
    expect(next.getCellMeta(1, 0).comment).toEqual({ value: 'Check', author: 'Ada' });
    expect(next.getColWidth(0)).toBe(120);
    expect(next.getSettings().fixedRowsTop).toBe(1);
    expect(next.getPlugin('hiddenRows').getHiddenRows()).toEqual([2]);
    expect(next.getPlugin('mergeCells').mergedCellsCollection.mergedCells.length).toBe(1);
    expect(next.getPlugin('conditionalFormatting').getRules().map(rule => rule.when)).toEqual(['gt']);

    const dates = next.getSheet('sheet2');

    expect(dates.getSourceDataAtCell(0, 0)).toBe('2026-01-15');
    expect(dates.getCellMeta(0, 0).type).toBe('date');
  });

  it('writes the column headers as a first row, and reads them back as headers', async() => {
    const hot = handsontable({ data: [['North', 1], ['South', 2]], colHeaders: ['Region', 'Units'] });
    const blob = await hot.exportFile('xlsx', { headers: true });
    const next = fresh();

    await next.importFile(blob, { headers: true });

    expect(next.getColHeader()).toEqual(['Region', 'Units']);
    expect(next.getData()).toEqual([['North', 1], ['South', 2]]);
  });

  it('exports the active sheet as CSV (formula results) and imports CSV text', async() => {
    const hot = handsontable({ data: [['a, b', 'say "hi"'], [1, '=A2+1']], formulas: { engine: Model } });
    const blob = await hot.exportFile('csv');
    const bytes = new Uint8Array(await blob.arrayBuffer());

    // UTF-8 with a byte order mark, so Excel reads the characters right (text() drops the mark).
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(await blob.text()).toBe('"a, b","say ""hi"""\r\n1,2');

    await hot.importFile('x;y\n1;2', { headers: true });

    expect(hot.getColHeader()).toEqual(['x', 'y']);
    expect(hot.getData()).toEqual([[1, 2]]);
  });

  it('opens a .csv file by its name, and runs the events', async() => {
    const before = jasmine.createSpy('beforeImportFile');
    const after = jasmine.createSpy('afterImportFile');
    const exported = jasmine.createSpy('afterExportFile');
    const hot = handsontable({ data: [[null]], beforeImportFile: before, afterImportFile: after,
      afterExportFile: exported });

    await hot.importFile(new File(['1,2\n3,4'], 'numbers.csv'));

    expect(hot.getData()).toEqual([[1, 2], [3, 4]]);
    expect(before.calls.argsFor(0)[0]).toBe('csv');
    expect(after.calls.argsFor(0)[0]).toBe('csv');

    await hot.exportFile('xlsx');
    expect(exported.calls.argsFor(0)[0]).toBe('xlsx');
  });

  it('does not import when beforeImportFile returns false, and refuses unknown formats', async() => {
    const hot = handsontable({ data: [['keep']], beforeImportFile: () => false });

    await hot.importFile('a,b');
    expect(hot.getData()).toEqual([['keep']]);

    await expectAsync(hot.exportFile('pdf')).toBeRejectedWithError(/Unknown file format/);
  });

  it('downloads a file through a link', async() => {
    const hot = handsontable({ data: [[1]] });
    const clicks = [];
    const click = HTMLAnchorElement.prototype.click;

    HTMLAnchorElement.prototype.click = function() {
      clicks.push(this.download);
    };
    try {
      await hot.downloadFile('csv', 'numbers.csv');
    } finally {
      HTMLAnchorElement.prototype.click = click;
    }

    expect(clicks).toEqual(['numbers.csv']);
  });
});

describe('Core cell style', () => {
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

  it('draws a cell\'s style meta, under conditional formatting, and removes it from reused cells', () => {
    const hot = handsontable({
      data: [[1, 2], [3, 4]],
      cell: [{ row: 0, col: 0, style: { fontWeight: 'bold', background: '#ffff00' } }],
      conditionalFormatting: [{ range: 'A1:A2', when: 'gt', value: 2, style: { background: '#ff0000' } }],
    });

    expect(getCell(0, 0).style.fontWeight).toBe('bold');
    expect(getCell(0, 0).style.background).toContain('rgb(255, 255, 0)');
    expect(getCell(1, 0).style.background).toContain('rgb(255, 0, 0)');

    // The rule now matches the styled cell too: its background wins, and goes when the rule goes.
    hot.getPlugin('conditionalFormatting').updateRule(hot.getPlugin('conditionalFormatting').getRules()[0].id,
      { range: 'A1:A2', when: 'gt', value: 0, style: { background: '#ff0000' } });
    expect(getCell(0, 0).style.background).toContain('rgb(255, 0, 0)');

    hot.getPlugin('conditionalFormatting').clearRules();
    expect(getCell(0, 0).style.background).toContain('rgb(255, 255, 0)');

    hot.setCellMeta(0, 0, 'style', void 0);
    hot.render();
    expect(getCell(0, 0).style.fontWeight).toBe('');
  });
});
