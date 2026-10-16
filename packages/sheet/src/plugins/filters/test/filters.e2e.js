describe('Filters', () => {
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

  const data = () => [
    ['North', 120, 'Ada'],
    ['South', 90, 'Linus'],
    ['East', 130, ''],
    ['West', 80, 'Grace'],
    ['north east', 100, null],
  ];
  const regions = () => getDataAtCol(0);

  it('hides the rows that do not meet a condition', () => {
    const hot = handsontable({ data: data(), filters: true, rowHeaders: true });
    const filters = hot.getPlugin('filters');

    filters.addCondition(1, 'gt', [95]);
    filters.filter();

    expect(regions()).toEqual(['North', 'East', 'north east']);
    expect(countRows()).toBe(3);
    expect(getRowHeader(2)).toBe(5);
    expect(hot.rootElement.classList.contains('fs-has-filters')).toBe(true);
  });

  it('compares text without case: eq, contains, begins_with, ends_with, not_contains', () => {
    const hot = handsontable({ data: data(), filters: true });
    const filters = hot.getPlugin('filters');
    const run = (name, args) => {
      filters.clearConditions();
      filters.addCondition(0, name, args);
      filters.filter();

      return regions();
    };

    expect(run('eq', ['north'])).toEqual(['North']);
    expect(run('neq', ['north'])).toEqual(['South', 'East', 'West', 'north east']);
    expect(run('contains', ['EAST'])).toEqual(['East', 'north east']);
    expect(run('not_contains', ['east'])).toEqual(['North', 'South', 'West']);
    expect(run('begins_with', ['no'])).toEqual(['North', 'north east']);
    expect(run('ends_with', ['th'])).toEqual(['North', 'South']);
  });

  it('compares numbers: between (in any order), not_between, lte', () => {
    const hot = handsontable({ data: data(), filters: true });
    const filters = hot.getPlugin('filters');

    filters.addCondition(1, 'between', ['130', 100]);
    filters.filter();
    expect(regions()).toEqual(['North', 'East', 'north east']);

    filters.clearConditions();
    filters.addCondition(1, 'not_between', [85, 125]);
    filters.filter();
    expect(regions()).toEqual(['East', 'West']);

    filters.clearConditions();
    filters.addCondition(1, 'lte', [90]);
    filters.filter();
    expect(regions()).toEqual(['South', 'West']);
  });

  it('finds empty and filled cells', () => {
    const hot = handsontable({ data: data(), filters: true });
    const filters = hot.getPlugin('filters');

    filters.addCondition(2, 'empty');
    filters.filter();
    expect(regions()).toEqual(['East', 'north east']);

    filters.clearConditions();
    filters.addCondition(2, 'not_empty');
    filters.filter();
    expect(regions()).toEqual(['North', 'South', 'West']);
  });

  it('joins a column\'s conditions with AND or OR, and the columns with AND', () => {
    const hot = handsontable({ data: data(), filters: true });
    const filters = hot.getPlugin('filters');

    filters.addCondition(1, 'lt', [90], 'disjunction');
    filters.addCondition(1, 'gt', [125], 'disjunction');
    filters.filter();
    expect(regions()).toEqual(['East', 'West']);

    filters.addCondition(2, 'not_empty');
    filters.filter();
    expect(regions()).toEqual(['West']);
  });

  it('keeps the rows whose value is in a value list, on top of the conditions', () => {
    const hot = handsontable({ data: data(), filters: true });
    const filters = hot.getPlugin('filters');

    filters.addCondition(2, 'by_value', [['Ada', '']]);
    filters.filter();
    expect(regions()).toEqual(['North', 'East', 'north east']);

    filters.addCondition(2, 'eq', ['ada'], 'disjunction');
    filters.filter();
    expect(regions()).toEqual(['North']);
  });

  it('filters dates by day in a date column', () => {
    const hot = handsontable({
      data: [['01/15/2026'], ['02/20/2026'], ['03/10/2026']],
      columns: [{ type: 'date', dateFormat: 'MM/DD/YYYY' }],
      filters: true,
    });
    const filters = hot.getPlugin('filters');

    filters.addCondition(0, 'date_after', ['01/31/2026']);
    filters.filter();
    expect(getDataAtCol(0)).toEqual(['02/20/2026', '03/10/2026']);

    filters.clearConditions();
    filters.addCondition(0, 'date_before', ['2026-02-20']);
    filters.filter();
    expect(getDataAtCol(0)).toEqual(['01/15/2026']);
  });

  it('lists a column\'s values as text, once each, from the rows the other columns keep', () => {
    const hot = handsontable({ data: data(), filters: true });
    const filters = hot.getPlugin('filters');

    expect(filters.getColumnValues(1)).toEqual(['80', '90', '100', '120', '130']);

    filters.addCondition(0, 'contains', ['north']);
    filters.addCondition(2, 'not_empty');
    filters.filter();

    expect(filters.getColumnValues(2)).toEqual(['', 'Ada']);
  });

  it('runs beforeFilter (false cancels) and afterFilter with the conditions', () => {
    const afterFilter = jasmine.createSpy('afterFilter');
    let cancel = true;
    const hot = handsontable({ data: data(), filters: true, beforeFilter: () => !cancel, afterFilter });
    const filters = hot.getPlugin('filters');

    filters.addCondition(1, 'gt', [100]);
    filters.filter();
    expect(countRows()).toBe(5);
    expect(afterFilter).not.toHaveBeenCalled();

    cancel = false;
    filters.filter();
    expect(countRows()).toBe(2);
    expect(afterFilter.calls.argsFor(0)[0]).toEqual([{ column: 1, operation: 'conjunction',
      conditions: [{ name: 'gt', args: [100] }] }]);
  });

  it('shows every row again when the conditions are cleared', () => {
    const hot = handsontable({ data: data(), filters: true });
    const filters = hot.getPlugin('filters');

    filters.addCondition(1, 'gt', [100]);
    filters.filter();
    filters.clearConditions();
    filters.filter();

    expect(countRows()).toBe(5);
    expect(hot.rootElement.classList.contains('fs-has-filters')).toBe(false);
  });

  it('applies the conditions of the setting, and keeps the user\'s conditions when other settings change', () => {
    const hot = handsontable({ data: data(), filters: { conditions: [{ column: 1, operation: 'conjunction',
      conditions: [{ name: 'gt', args: [100] }] }] } });

    expect(regions()).toEqual(['North', 'East']);

    hot.getPlugin('filters').addCondition(0, 'eq', ['east']);
    hot.getPlugin('filters').filter();
    updateSettings({ colWidths: 90 });

    expect(regions()).toEqual(['East']);

    updateSettings({ filters: false });

    expect(countRows()).toBe(5);
  });

  it('keeps an edited row visible until the next filter, unless reapplyOnChange is set', () => {
    const hot = handsontable({ data: data(), filters: true });
    const filters = hot.getPlugin('filters');

    filters.addCondition(1, 'gt', [100]);
    filters.filter();
    setDataAtCell(0, 1, 50);
    expect(regions()).toEqual(['North', 'East']);

    filters.filter();
    expect(regions()).toEqual(['East']);

    updateSettings({ filters: { reapplyOnChange: true } });
    filters.addCondition(1, 'gt', [100]);
    filters.filter();
    setDataAtCell(0, 1, 50);
    expect(regions()).toEqual([]);
  });

  it('sorts all rows and keeps the filter', () => {
    const hot = handsontable({ data: data(), filters: true, columnSorting: true });
    const filters = hot.getPlugin('filters');

    filters.addCondition(1, 'gt', [95]);
    filters.filter();
    hot.getPlugin('columnSorting').sort({ column: 1, sortOrder: 'asc' });

    expect(regions()).toEqual(['north east', 'North', 'East']);
  });

  it('works together with hidden rows', () => {
    const hot = handsontable({ data: data(), filters: true, hiddenRows: { rows: [0] } });
    const filters = hot.getPlugin('filters');

    filters.addCondition(1, 'gt', [95]);
    filters.filter();
    expect(regions()).toEqual(['East', 'north east']);

    filters.clearConditions();
    filters.filter();
    expect(regions()).toEqual(['South', 'East', 'West', 'north east']);
  });

  it('keeps the conditions on their column when columns are inserted or removed before it', () => {
    const hot = handsontable({ data: data(), filters: true });
    const filters = hot.getPlugin('filters');

    filters.addCondition(1, 'gt', [100]);
    alter('insert_col', 0);
    expect(filters.exportConditions()[0].column).toBe(2);

    alter('remove_col', 0);
    expect(filters.exportConditions()[0].column).toBe(1);

    alter('remove_col', 1);
    expect(filters.exportConditions()).toEqual([]);
  });

  it('filters formulas by their result', () => {
    const hot = handsontable({ data: [[1, 2, '=A1+B1'], [5, 6, '=A2+B2']], filters: true,
      modifyData: (row, column, holder, mode) => {
        if (mode === 'get' && typeof holder.value === 'string' && holder.value.startsWith('=')) {
          holder.value = row === 0 ? 3 : 11;
        }
      } });
    const filters = hot.getPlugin('filters');

    filters.addCondition(2, 'gt', [5]);
    filters.filter();

    expect(getDataAtCol(0)).toEqual([5]);
  });

  it('saves and loads the conditions with the document', () => {
    const hot = handsontable({ data: data(), filters: true });

    hot.getPlugin('filters').addCondition(1, 'gt', [100]);
    hot.getPlugin('filters').filter();

    const saved = hot.getDocument();

    expect(saved.sheets[0].filters).toEqual([{ column: 1, operation: 'conjunction',
      conditions: [{ name: 'gt', args: [100] }] }]);

    hot.getPlugin('filters').clearConditions();
    hot.getPlugin('filters').filter();
    hot.loadDocument(saved);

    expect(regions()).toEqual(['North', 'East']);
  });

  it('uses conditions added with FreeSheet.filters.registerCondition, in the API and in the column menu', () => {
    Handsontable.filters.registerCondition('spec_multiple_of', {
      title: 'Is a multiple of',
      arity: 1,
      types: ['numeric'],
      test: (value, [divisor]) => typeof value === 'number' && value % Number(divisor) === 0,
    });
    const hot = handsontable({ data: data(), colHeaders: true, filters: true, dropdownMenu: true,
      columns: [{}, { type: 'numeric' }, {}] });
    const filters = hot.getPlugin('filters');

    filters.addCondition(1, 'spec_multiple_of', [40]);
    filters.filter();
    expect(regions()).toEqual(['North', 'West']);

    $(hot.view.wt.wtTable.getColumnHeader(1).querySelector('.fs-dropdown-button')).simulate('mousedown');
    const select = document.querySelector('.fs-dropdown-menu select.fs-filter-condition');

    expect(select.value).toBe('spec_multiple_of');
    expect(select.selectedOptions[0].textContent).toBe('Is a multiple of');
    expect(document.querySelector('.fs-dropdown-menu .fs-filter-input').value).toBe('40');
    document.querySelector('.fs-dropdown-menu .fs-filter-cancel').click();

    $(hot.view.wt.wtTable.getColumnHeader(0).querySelector('.fs-dropdown-button')).simulate('mousedown');
    const textOptions = Array.from(document.querySelector('.fs-dropdown-menu select.fs-filter-condition').options)
      .map(option => option.value);

    expect(textOptions).not.toContain('spec_multiple_of');
    document.querySelector('.fs-dropdown-menu .fs-filter-cancel').click();
  });

  it('throws for an unknown condition', () => {
    const hot = handsontable({ data: data(), filters: true });

    expect(() => hot.getPlugin('filters').addCondition(0, 'no_such_condition')).toThrowError(/Unknown filter condition/);
  });
});
