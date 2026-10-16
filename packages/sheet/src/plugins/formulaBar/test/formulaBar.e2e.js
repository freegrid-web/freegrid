describe('FormulaBar', () => {
  const id = 'testContainer';

  beforeEach(function() {
    this.$container = $(`<div id="${id}"></div>`).appendTo('body');
  });

  afterEach(function() {
    if (this.$container) {
      destroy();
      this.$container.remove();
    }
    $('.fs-formula-bar').remove();
  });

  const bar = () => document.querySelector('.fs-formula-bar');
  const nameBox = () => bar().querySelector('.fs-formula-bar__name');
  const input = () => bar().querySelector('.fs-formula-bar__input');
  const press = (element, key) => element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

  it('is shown above the grid only when turned on', () => {
    handsontable({ data: [[1]] });
    expect(bar()).toBeNull();

    updateSettings({ formulaBar: true });
    expect(bar()).not.toBeNull();
    expect(bar().nextElementSibling).toBe(spec().$container[0]);

    updateSettings({ formulaBar: false });
    expect(bar()).toBeNull();
  });

  it('shows the selected cell\'s address and source value', () => {
    handsontable({ data: [[1, 'two'], [3, '=A1+A2']], formulaBar: true });

    selectCell(1, 1);
    expect(nameBox().value).toBe('B2');
    expect(input().value).toBe('=A1+A2');

    selectCell(0, 0, 1, 1);
    expect(nameBox().value).toBe('A1:B2');
    expect(input().value).toBe('1');

    deselectCell();
    expect(nameBox().value).toBe('');
    expect(input().value).toBe('');
  });

  it('writes the cell on Enter, and the change can be undone', () => {
    const hot = handsontable({ data: [[1, 2]], formulaBar: true });

    selectCell(0, 1);
    input().focus();
    input().value = 'new';
    input().dispatchEvent(new Event('input'));
    press(input(), 'Enter');

    expect(getDataAtCell(0, 1)).toBe('new');
    expect(getSelectedLast()).toEqual([0, 1, 0, 1]);
    expect(hot.isListening()).toBe(true);
    // The same Enter must not reach the grid and open the cell's editor.
    expect(getActiveEditor().isOpened()).toBe(false);
    expect(document.activeElement).not.toBe(input());

    hot.undo();
    expect(getDataAtCell(0, 1)).toBe(2);
  });

  it('cancels on Escape', () => {
    handsontable({ data: [[1, 2]], formulaBar: true });

    selectCell(0, 1);
    input().value = 'changed';
    press(input(), 'Escape');

    expect(getDataAtCell(0, 1)).toBe(2);
    expect(input().value).toBe('2');
    expect(getActiveEditor().isOpened()).toBe(false);
  });

  it('selects the cell typed in the address box', () => {
    handsontable({ data: Handsontable.helper.createSpreadsheetData(10, 10), formulaBar: true });

    nameBox().value = 'f6';
    press(nameBox(), 'Enter');

    expect(getSelectedLast()).toEqual([5, 5, 5, 5]);
    expect(nameBox().value).toBe('F6');
  });

  it('marks an address outside the sheet as invalid and keeps it for correction', () => {
    handsontable({ data: Handsontable.helper.createSpreadsheetData(6, 4), formulaBar: true });

    selectCell(2, 3);
    nameBox().focus();
    nameBox().value = 'F5';
    press(nameBox(), 'Enter');

    expect(getSelectedLast()).toEqual([2, 3, 2, 3]);
    expect(nameBox().value).toBe('F5');
    expect(nameBox().classList.contains('fs-formula-bar__name--invalid')).toBe(true);
    expect(nameBox().title).toBe('No cell F5 in this sheet (A1:D6)');
    expect(document.activeElement).toBe(nameBox());

    nameBox().value = 'B2';
    nameBox().dispatchEvent(new Event('input'));
    expect(nameBox().classList.contains('fs-formula-bar__name--invalid')).toBe(false);
    press(nameBox(), 'Enter');

    expect(getSelectedLast()).toEqual([1, 1, 1, 1]);
  });

  it('marks text that is not an address as invalid', () => {
    handsontable({ data: [[1]], formulaBar: true });

    selectCell(0, 0);
    nameBox().value = 'hello';
    press(nameBox(), 'Enter');

    expect(nameBox().title).toBe('Not a cell address: hello');

    press(nameBox(), 'Escape');
    expect(nameBox().value).toBe('A1');
    expect(nameBox().classList.contains('fs-formula-bar__name--invalid')).toBe(false);
  });

  it('keeps the selection when the bar is clicked', () => {
    handsontable({ data: [[1, 2]], formulaBar: true, outsideClickDeselects: true });

    selectCell(0, 1);
    $(input()).simulate('mousedown');

    expect(getSelectedLast()).toEqual([0, 1, 0, 1]);
  });

  it('is as wide as the drawn grid, not as its container', () => {
    spec().$container.css('width', '800px');
    handsontable({ data: [[1, 2], [3, 4]], formulaBar: true });

    const table = spec().$container.find('.fs-master table')[0];

    expect(bar().getBoundingClientRect().width).toBe(table.getBoundingClientRect().width);
  });

  it('follows changes made in the grid', () => {
    handsontable({ data: [[1, 2]], formulaBar: true });

    selectCell(0, 0);
    setDataAtCell(0, 0, 42);

    expect(input().value).toBe('42');
  });
});
