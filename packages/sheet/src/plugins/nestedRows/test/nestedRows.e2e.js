describe('NestedRows', () => {
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

  const tree = () => [
    { task: 'Design', hours: 10, __children: [
      { task: 'Sketches', hours: 4 },
      { task: 'Review', hours: 6, __children: [{ task: 'Notes', hours: 1 }] },
    ] },
    { task: 'Build', hours: 20, __children: [{ task: 'API', hours: 12 }, { task: 'UI', hours: 8 }] },
    { task: 'Ship', hours: 2 },
  ];
  const settings = extra => ({ data: tree(), columns: [{ data: 'task' }, { data: 'hours', type: 'numeric' }],
    rowHeaders: true, nestedRows: true, ...extra });
  const tasks = () => getDataAtCol(0);
  const rowHeaderTH = row => spec().$container.data('handsontable').view.wt.wtTable.getCell({ row, col: -1 });
  const plugin = () => getPlugin('nestedRows');

  it('shows every row of the tree in order, parents before their children', () => {
    handsontable(settings());

    expect(tasks()).toEqual(['Design', 'Sketches', 'Review', 'Notes', 'Build', 'API', 'UI', 'Ship']);
    expect(countSourceRows()).toBe(8);
    expect(plugin().getLevel(3)).toBe(2);
    expect(plugin().getParent(3)).toBe(2);
    expect(plugin().getChildren(0)).toEqual([1, 2]);
    expect(plugin().getSourceData()[0].task).toBe('Design');
    expect(plugin().getSourceData().length).toBe(3);
  });

  it('collapses and expands a parent, running the hooks', () => {
    const beforeCollapse = jasmine.createSpy('beforeRowCollapse');
    const afterExpand = jasmine.createSpy('afterRowExpand');

    handsontable(settings({ beforeRowCollapse: beforeCollapse, afterRowExpand: afterExpand }));

    plugin().collapse(0);
    expect(tasks()).toEqual(['Design', 'Build', 'API', 'UI', 'Ship']);
    expect(plugin().isCollapsed(0)).toBe(true);
    expect(beforeCollapse.calls.argsFor(0)[0]).toBe(0);

    plugin().expand(0);
    expect(countRows()).toBe(8);
    expect(afterExpand).toHaveBeenCalled();

    plugin().collapseAll();
    expect(tasks()).toEqual(['Design', 'Build', 'Ship']);

    plugin().expandAll();
    expect(countRows()).toBe(8);
  });

  it('keeps a collapsed child collapsed when its parent is expanded again', () => {
    handsontable(settings());

    plugin().collapse(2);
    plugin().collapse(0);
    plugin().expand(0);

    expect(tasks()).toEqual(['Design', 'Sketches', 'Review', 'Build', 'API', 'UI', 'Ship']);
  });

  it('shows a button in the row header of each parent; a click toggles it without selecting the row', () => {
    handsontable(settings());

    const toggle = rowHeaderTH(0).querySelector('.fs-nested-toggle');

    expect(rowHeaderTH(1).querySelector('.fs-nested-toggle')).toBeNull();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    $(toggle).simulate('mousedown');

    expect(countRows()).toBe(5);
    expect(getSelected()).toBeUndefined();
    expect(rowHeaderTH(0).querySelector('.fs-nested-toggle').getAttribute('aria-expanded')).toBe('false');
  });

  it('puts the button and the indent in the first column with toggle: "column"', () => {
    handsontable(settings({ nestedRows: { toggle: 'column', indent: 10 } }));

    expect(getCell(0, 0).querySelector('.fs-nested-toggle')).not.toBeNull();
    expect(getCell(3, 0).style.paddingLeft).toBe('40px');
    expect(rowHeaderTH(0).querySelector('.fs-nested-toggle')).toBeNull();
    expect(getCell(3, 0).classList.contains('fs-nested-level-2')).toBe(true);
  });

  it('numbers the rows as an outline with numbering: "outline"', () => {
    handsontable(settings({ nestedRows: { numbering: 'outline' } }));

    expect(Array.from({ length: 8 }, (_, row) => plugin().getRowNumber(row)))
      .toEqual(['1', '1.1', '1.2', '1.2.1', '2', '2.1', '2.2', '3']);
    expect(rowHeaderTH(3).querySelector('.rowHeader').textContent).toBe('1.2.1');
  });

  it('starts collapsed with collapsed: true, or showing some levels with a number', () => {
    handsontable(settings({ nestedRows: { collapsed: true } }));
    expect(tasks()).toEqual(['Design', 'Build', 'Ship']);

    updateSettings({ data: tree(), nestedRows: { collapsed: 2 } });
    expect(tasks()).toEqual(['Design', 'Sketches', 'Review', 'Build', 'API', 'UI', 'Ship']);
  });

  it('reads the children from childrenKey', () => {
    handsontable({ data: [{ name: 'A', children: [{ name: 'A1' }] }, { name: 'B' }], columns: [{ data: 'name' }],
      nestedRows: { childrenKey: 'children' } });

    expect(getDataAtCol(0)).toEqual(['A', 'A1', 'B']);
  });

  it('adds a child at the end of a row\'s children', () => {
    const afterAddChild = jasmine.createSpy('afterAddChild');

    handsontable(settings({ afterAddChild }));
    plugin().collapse(0);
    plugin().addChild(0, { task: 'Mockups', hours: 3 });

    expect(tasks()).toEqual(['Design', 'Sketches', 'Review', 'Notes', 'Mockups', 'Build', 'API', 'UI', 'Ship']);
    expect(plugin().getSourceData()[0].__children.map(row => row.task)).toEqual(['Sketches', 'Review', 'Mockups']);
    expect(afterAddChild).toHaveBeenCalled();
  });

  it('inserts a row as a sibling of the row below it', () => {
    handsontable(settings());

    alter('insert_row', 5); // above API

    expect(plugin().getSourceData()[1].__children.length).toBe(3);
    expect(plugin().getLevel(5)).toBe(1);
    expect(countSourceRows()).toBe(9);
  });

  it('removes a row with its children, collapsed ones too', () => {
    handsontable(settings());

    plugin().collapse(2);
    alter('remove_row', 2); // Review (with Notes)

    expect(tasks()).toEqual(['Design', 'Sketches', 'Build', 'API', 'UI', 'Ship']);
    expect(plugin().getSourceData()[0].__children.map(row => row.task)).toEqual(['Sketches']);
  });

  it('indents a row under the row above it and outdents it again, without moving rows', () => {
    handsontable(settings());

    plugin().indent(2); // Review under Sketches
    expect(tasks()).toEqual(['Design', 'Sketches', 'Review', 'Notes', 'Build', 'API', 'UI', 'Ship']);
    expect(plugin().getLevel(2)).toBe(2);
    expect(plugin().getParent(2)).toBe(1);

    plugin().outdent(2);
    expect(plugin().getLevel(2)).toBe(1);
    expect(plugin().getParent(2)).toBe(0);

    // Outdenting API: UI (after it) becomes its child.
    plugin().outdent(5);
    expect(plugin().getLevel(5)).toBe(0);
    expect(plugin().getChildren(5)).toEqual([6]);
    expect(tasks()).toEqual(['Design', 'Sketches', 'Review', 'Notes', 'Build', 'API', 'UI', 'Ship']);
  });

  it('sorts the children of each parent and keeps them under it', () => {
    handsontable(settings({ columnSorting: true }));

    getPlugin('columnSorting').sort({ column: 1, sortOrder: 'desc' });

    expect(tasks()).toEqual(['Build', 'API', 'UI', 'Design', 'Review', 'Notes', 'Sketches', 'Ship']);
  });

  it('numbers sorted rows in their new order', () => {
    handsontable(settings({ columnSorting: true, nestedRows: { numbering: 'outline' } }));

    getPlugin('columnSorting').sort({ column: 1, sortOrder: 'desc' });

    expect(plugin().getRowNumber(0)).toBe('1');
    expect(plugin().getRowNumber(3)).toBe('2');
    expect(plugin().getRowNumber(6)).toBe('2.2');
  });

  it('filters: shows the matching rows and their parents, dimmed, even inside collapsed parents', () => {
    handsontable(settings({ filters: true }));

    plugin().collapseAll();
    getPlugin('filters').addCondition(0, 'eq', ['notes']);
    getPlugin('filters').filter();

    expect(tasks()).toEqual(['Design', 'Review', 'Notes']);
    expect(getCell(0, 0).classList.contains('fs-nested-context')).toBe(true);
    expect(getCell(2, 0).classList.contains('fs-nested-context')).toBe(false);

    getPlugin('filters').clearConditions();
    getPlugin('filters').filter();

    expect(tasks()).toEqual(['Design', 'Build', 'Ship']);
  });

  it('expands and collapses the selected row with Alt+Shift+Arrow keys', () => {
    handsontable(settings());

    selectCell(0, 0);
    keyDownUp('arrow_left', { altKey: true, shiftKey: true });
    expect(countRows()).toBe(5);

    keyDownUp('arrow_right', { altKey: true, shiftKey: true });
    expect(countRows()).toBe(8);
  });

  it('saves the tree and the collapsed parents with the document', () => {
    const hot = handsontable(settings());

    plugin().collapse(4);
    const saved = hot.getDocument();

    expect(saved.sheets[0].data.length).toBe(3);
    expect(saved.sheets[0].data[1].__children.length).toBe(2);
    expect(saved.sheets[0].collapsedRows).toEqual([4]);

    plugin().expandAll();
    hot.loadDocument(saved);

    expect(tasks()).toEqual(['Design', 'Sketches', 'Review', 'Notes', 'Build', 'Ship']);
  });

  it('gives the grid back the tree when turned off', () => {
    handsontable(settings());

    updateSettings({ nestedRows: false });

    expect(countRows()).toBe(3);
    expect(getDataAtCol(0)).toEqual(['Design', 'Build', 'Ship']);
  });

  it('keeps formulas on their rows when a child is added', () => {
    handsontable({ data: [{ a: 1, __children: [{ a: 2 }] }, { a: '=A1+A2' }], columns: [{ data: 'a' }],
      nestedRows: true });

    plugin().addChild(0, { a: 5 });

    expect(getSourceDataAtCell(3, 0)).toBe('=A1+A2');
  });
});
