describe('DropdownMenu', () => {
  const id = 'testContainer';

  beforeEach(function() {
    this.$container = $(`<div id="${id}"></div>`).appendTo('body');
  });

  afterEach(function() {
    if (this.$container) {
      destroy();
      this.$container.remove();
    }
    $('.fs-dropdown-menu').remove();
  });

  const data = () => [['North', 120], ['South', 90], ['East', 130], ['West', 80], ['', 100]];
  const menu = () => document.querySelector('.fs-dropdown-menu');
  const header = column => spec().$container.data('handsontable').view.wt.wtTable.getColumnHeader(column);
  const openMenu = (column) => {
    $(header(column).querySelector('.fs-dropdown-button')).simulate('mousedown');
  };
  const itemTexts = () => Array.from(menu().querySelectorAll('.fs-dropdown-menu__item')).map(item => item.textContent);
  const clickItem = text => Array.from(menu().querySelectorAll('.fs-dropdown-menu__item'))
    .find(item => item.textContent === text).click();
  const settings = extra => ({ data: data(), colHeaders: true, columnSorting: true, filters: true, dropdownMenu: true,
    ...extra });

  it('puts a button in every column header', () => {
    handsontable(settings());

    expect(header(0).querySelector('.fs-dropdown-button')).not.toBeNull();
    expect(header(1).querySelector('.fs-dropdown-button').getAttribute('aria-label')).toBe('Column menu');
  });

  it('opens the menu below the header without selecting or sorting the column, and closes it on Escape', () => {
    const afterShow = jasmine.createSpy('afterDropdownMenuShow');
    const hot = handsontable(settings({ afterDropdownMenuShow: afterShow }));

    openMenu(1);

    expect(menu()).not.toBeNull();
    expect(getSelected()).toBeUndefined();
    expect(hot.getPlugin('columnSorting').isSorted()).toBe(false);
    expect(afterShow.calls.argsFor(0)[0]).toBe(1);
    expect(Math.round(menu().getBoundingClientRect().top)).toBe(Math.round(header(1).getBoundingClientRect().bottom));

    menu().querySelector('.fs-filter-search').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape',
      bubbles: true }));

    expect(menu()).toBeNull();
  });

  it('lists the items of the plugins that are on', () => {
    handsontable(settings());
    openMenu(0);

    expect(itemTexts()).toEqual(['Sort A → Z', 'Sort Z → A', 'Clear sorting', 'Clear filter']);

    $(document.body).simulate('mousedown');
    expect(menu()).toBeNull();

    updateSettings({ columnSorting: false, filters: false, hiddenColumns: true });
    openMenu(0);

    expect(itemTexts()).toEqual(['Hide column']);
    expect(menu().querySelector('.fs-filter-by-value')).toBeNull();
  });

  it('sorts the column', () => {
    handsontable(settings());

    openMenu(1);
    clickItem('Sort Z → A');

    expect(getDataAtCol(1)).toEqual([130, 120, 100, 90, 80]);
    expect(menu()).toBeNull();
    expect(header(1).querySelector('.fs-dropdown-button--active')).not.toBeNull();
  });

  it('filters by values: unchecked values are hidden, and the search narrows the list', () => {
    handsontable(settings());

    openMenu(0);
    const values = () => Array.from(menu().querySelectorAll('.fs-filter-value')).map(label => label.textContent.trim());

    expect(values()).toEqual(['(Blank cells)', 'East', 'North', 'South', 'West']);

    const search = menu().querySelector('.fs-filter-search');

    search.value = 'th';
    search.dispatchEvent(new Event('input'));
    expect(values()).toEqual(['North', 'South']);

    menu().querySelector('.fs-filter-clear').click();
    search.value = '';
    search.dispatchEvent(new Event('input'));
    menu().querySelector('.fs-filter-ok').click();

    expect(getDataAtCol(0)).toEqual(['East', 'West', '']);
    expect(header(0).classList.contains('fs-filtered')).toBe(true);
  });

  it('filters by condition, with the inputs the condition needs', () => {
    handsontable(settings());

    openMenu(1);
    const [first, second] = menu().querySelectorAll('select.fs-filter-condition');
    const inputs = index => Array.from(menu().querySelectorAll(`.fs-filter-input[data-index="${index}"]`));

    expect(second.hidden).toBe(true);

    first.value = 'between';
    first.dispatchEvent(new Event('change', { bubbles: true }));

    expect(inputs(0).map(input => input.hidden)).toEqual([false, false]);
    expect(second.hidden).toBe(false);

    inputs(0)[0].value = '85';
    inputs(0)[1].value = '125';
    menu().querySelector('.fs-filter-ok').click();

    expect(getDataAtCol(0)).toEqual(['North', 'South', '']);

    openMenu(1);
    expect(menu().querySelector('select.fs-filter-condition').value).toBe('between');
    clickItem('Clear filter');

    expect(countRows()).toBe(5);
  });

  it('joins two conditions with OR', () => {
    handsontable(settings());

    openMenu(1);
    const [first, second] = menu().querySelectorAll('select.fs-filter-condition');

    first.value = 'lt';
    first.dispatchEvent(new Event('change', { bubbles: true }));
    menu().querySelector('.fs-filter-input[data-index="0"]').value = '90';
    menu().querySelector('input[value="disjunction"]').checked = true;
    second.value = 'gt';
    second.dispatchEvent(new Event('change', { bubbles: true }));
    menu().querySelector('.fs-filter-input[data-index="1"]').value = '125';
    menu().querySelector('.fs-filter-input[data-index="1"]').dispatchEvent(new KeyboardEvent('keydown',
      { key: 'Enter', bubbles: true }));

    expect(getDataAtCol(0)).toEqual(['East', 'West']);
    expect(menu()).toBeNull();
  });

  it('takes a list of items, with custom ones', () => {
    const callback = jasmine.createSpy('callback');

    handsontable(settings({ dropdownMenu: ['sort_asc', '---------', { name: 'Show details', callback }] }));
    openMenu(1);

    expect(itemTexts()).toEqual(['Sort A → Z', 'Show details']);
    expect(menu().querySelectorAll('.fs-dropdown-menu__separator').length).toBe(1);

    clickItem('Show details');

    expect(callback).toHaveBeenCalledWith(1);
  });

  it('removes the buttons when turned off', () => {
    handsontable(settings());

    updateSettings({ dropdownMenu: false });

    expect(header(0).querySelector('.fs-dropdown-button')).toBeNull();
  });
});
