describe('Core_clear', () => {
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

  it('should empty every cell except read-only ones', async() => {
    handsontable({
      data: Handsontable.helper.createSpreadsheetData(2, 2),
      cells: (row, col) => (row === 0 && col === 0 ? { readOnly: true } : {}),
    });

    getInstance().clear();
    await sleep(20);

    expect(getData()).toEqual([['A1', ''], ['', '']]);
  });

  it('should keep the selection (or no selection) it had', async() => {
    handsontable({ data: Handsontable.helper.createSpreadsheetData(3, 3) });

    getInstance().clear();
    await sleep(20);

    expect(getSelected()).toBeUndefined();

    selectCell(1, 1);
    getInstance().clear();
    await sleep(20);

    expect(getSelected()).toEqual([[1, 1, 1, 1]]);
  });
});
