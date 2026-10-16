describe('NestedHeaders and CollapsibleColumns', () => {
  const id = 'testContainer';

  beforeEach(function() {
    this.$container = $(`<div id="${id}" style="width: 800px"></div>`).appendTo('body');
  });

  afterEach(function() {
    if (this.$container) {
      destroy();
      this.$container.remove();
    }
  });

  const data = () => [['North', 1, 2, 3, 4, 10, 5, 6], ['South', 2, 3, 4, 5, 14, 6, 7]];
  const nestedHeaders = [
    ['Region', { label: '2026', colspan: 5 }, { label: '2027', colspan: 2 }],
    ['', 'Q1', 'Q2', 'Q3', 'Q4', 'Total', 'Q1', 'Q2'],
  ];
  const headerRows = () => Array.from(spec().$container[0].querySelectorAll('.ht_clone_top thead tr'));
  const rowTexts = tr => Array.from(tr.querySelectorAll('th')).map(TH => TH.textContent);

  it('draws a header row per row of nestedHeaders, the last one as the column headers', () => {
    handsontable({ data: data(), nestedHeaders, rowHeaders: true });

    const [groups, columns] = headerRows();

    expect(headerRows().length).toBe(2);
    expect(rowTexts(groups)).toEqual(['', 'Region', '2026', '', '', '', '', '2027', '']);
    expect(rowTexts(columns)).toEqual(['', '', 'Q1', 'Q2', 'Q3', 'Q4', 'Total', 'Q1', 'Q2']);
  });

  it('draws a group label as wide as its columns', () => {
    const hot = handsontable({ data: data(), nestedHeaders, colWidths: 60 });
    const label = headerRows()[0].querySelectorAll('th')[1].querySelector('.fs-group-label');

    expect(label.offsetWidth).toBe(5 * 60 - 1);
    expect(hot.getPlugin('nestedHeaders').getGroup(0, 3)).toEqual({ label: '2026', columns: [1, 2, 3, 4, 5] });
  });

  it("selects a group's columns after a click on its header", () => {
    handsontable({ data: data(), nestedHeaders });

    const TH = headerRows()[0].querySelectorAll('th')[1];

    $(TH).simulate('mousedown');
    $(TH).simulate('mouseup');

    expect(getSelectedLast()).toEqual([0, 1, 1, 5]);
  });

  it('collapses a group to the column `show` gives, with the button or the API', () => {
    const afterCollapse = jasmine.createSpy('afterColumnCollapse');
    const hot = handsontable({ data: data(), nestedHeaders, afterColumnCollapse: afterCollapse,
      collapsibleColumns: [{ row: 0, col: 1, show: 'last' }, { row: 0, col: 6 }] });
    const plugin = hot.getPlugin('collapsibleColumns');

    $(headerRows()[0].querySelectorAll('th')[1].querySelector('.fs-group-toggle')).simulate('mousedown');

    expect(getDataAtRow(0)).toEqual(['North', 10, 5, 6]);
    expect(plugin.isCollapsed(0, 1)).toBe(true);
    expect(afterCollapse.calls.argsFor(0).slice(0, 2)).toEqual([0, 1]);
    expect(getSelected()).toBeUndefined();

    plugin.collapse(0, 2);
    expect(getDataAtRow(0)).toEqual(['North', 10, 5]);

    plugin.expandAll();
    expect(countCols()).toBe(8);

    plugin.collapseAll();
    expect(getDataAtRow(0)).toEqual(['North', 10, 5]);
  });

  it('makes every group wider than a column collapsible with true, keeping its first column', () => {
    const hot = handsontable({ data: data(), nestedHeaders, collapsibleColumns: true });

    expect(headerRows()[0].querySelectorAll('.fs-group-toggle').length).toBe(2);
    expect(headerRows()[0].querySelector('.fs-group-toggle').title).toBe('Collapse: 2026');

    hot.getPlugin('collapsibleColumns').collapse(0, 1);

    expect(getDataAtRow(0)).toEqual(['North', 1, 5, 6]);
  });

  it('works together with hidden columns', () => {
    const hot = handsontable({ data: data(), nestedHeaders, collapsibleColumns: true, hiddenColumns: { columns: [7] } });

    hot.getPlugin('collapsibleColumns').collapse(0, 1);
    expect(getDataAtRow(0)).toEqual(['North', 1, 5]);

    hot.getPlugin('collapsibleColumns').expand(0, 1);
    expect(getDataAtRow(0)).toEqual(['North', 1, 2, 3, 4, 10, 5]);
  });

  it('moves a column inside its group, not out of it', () => {
    const hot = handsontable({ data: data(), nestedHeaders, manualColumnMove: true });
    const move = hot.getPlugin('manualColumnMove');

    move.moveColumn(1, 3);
    hot.render();
    expect(getDataAtRow(0)).toEqual(['North', 2, 1, 3, 4, 10, 5, 6]);

    move.moveColumn(1, 7);
    hot.render();
    expect(getDataAtRow(0)).toEqual(['North', 2, 1, 3, 4, 10, 5, 6]);
  });

  it('removes the group rows when turned off', () => {
    handsontable({ data: data(), nestedHeaders, colHeaders: true });

    updateSettings({ nestedHeaders: false });

    expect(headerRows().length).toBe(1);
    expect(rowTexts(headerRows()[0]).slice(0, 2)).toEqual(['A', 'B']);
  });
});
