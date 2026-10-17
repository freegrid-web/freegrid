describe('Core data validation', () => {
  const id = 'testContainer';

  beforeEach(function() {
    this.$container = $(`<div id="${id}" style="width: 900px; height: 400px"></div>`).appendTo('body');
  });

  afterEach(function() {
    if (this.$container) {
      destroy();
      this.$container.remove();
    }
    $('.fs-context-menu, .fs-validation-card, .fs-sheet-tabs').remove();
  });

  it('makes a list a dropdown, and refuses other values', async() => {
    const hot = handsontable({
      data: [['Open', 1], ['Done', 2]],
      columns: [{ validation: { type: 'list', source: ['Open', 'Done'] } }, {}],
    });

    expect(hot.getCellMeta(0, 0).editor).toBe(Handsontable.editors.getEditor('dropdown'));
    expect(getCell(0, 0).querySelector('.fs-autocomplete-arrow, .htAutocompleteArrow')).not.toBeNull();

    hot.setDataAtCell(0, 0, 'Maybe');
    await sleep(100);
    expect(hot.getDataAtCell(0, 0)).toBe('Open');
    expect($('.fs-validation-card--error').text()).toBe('This value is not allowed in this cell.');

    hot.setDataAtCell(0, 0, 'Done');
    await sleep(100);
    expect(hot.getDataAtCell(0, 0)).toBe('Done');
  });

  it('compares numbers, keeps and marks a value that is not valid without strict, and shows the messages', async() => {
    const hot = handsontable({
      data: [[5, null]],
      cell: [{ row: 0, col: 0, validation: { type: 'integer', operator: 'between', value: 1, value2: 10,
        strict: false, message: 'From 1 to 10', inputMessage: 'A whole number from 1 to 10' } }],
    });

    selectCell(0, 0);
    expect($('.fs-validation-card').text()).toBe('A whole number from 1 to 10');

    hot.setDataAtCell(0, 0, 12);
    await sleep(100);
    expect(hot.getDataAtCell(0, 0)).toBe(12);
    expect(getCell(0, 0).classList.contains('fs-invalid')).toBe(true);
    expect($('.fs-validation-card--error').text()).toBe('From 1 to 10');

    selectCell(0, 1);
    expect($('.fs-validation-card').length).toBe(0);
  });

  it('sets a rule on the selected cells from the panel, in one undo step', async() => {
    const hot = handsontable({ data: [['a', 'b'], ['c', 'd']], contextMenu: ['data_validation'], sidePanel: true });

    selectCell(0, 0, 1, 0);
    contextMenu();
    hot.getPlugin('contextMenu').executeCommand('data_validation');
    expect(hot.getOpenPanel()).toBe('dataValidation');

    const panel = $('.fs-validation-panel');

    panel.find('select').first().val('list').get(0).dispatchEvent(new Event('change'));
    panel.find('textarea').val('a\nc');
    $('.fs-validation-panel__apply').simulate('click');

    expect(hot.getCellMeta(1, 0).validation).toEqual({ type: 'list', source: ['a', 'c'] });
    expect(hot.getOpenPanel()).toBe(null);

    hot.undo();
    expect(hot.getCellMeta(1, 0).validation).toBeUndefined();
    expect(hot.getCellMeta(1, 0).editor).not.toBe(Handsontable.editors.getEditor('dropdown'));
  });

  it('is kept by getDocument and by Excel files', async() => {
    const hot = handsontable({ data: [['Open', 3]] });

    hot.getPlugin('dataValidation').setValidation({ type: 'list', source: ['Open', 'Done'] }, [[0, 0]]);
    hot.getPlugin('dataValidation').setValidation({ type: 'number', operator: 'greater', value: 0 }, [[0, 1]]);
    expect(hot.getDocument().sheets[0].cell).toEqual(jasmine.arrayContaining([jasmine.objectContaining(
      { row: 0, col: 0, validation: { type: 'list', source: ['Open', 'Done'] } })]));

    const blob = await hot.exportFile('xlsx');

    destroy();
    const next = handsontable({ data: [[null]] });

    await next.importFile(blob);
    expect(next.getActiveSheet().getCellMeta(0, 1).validation)
      .toEqual({ type: 'number', operator: 'greater', value: 0 });
    expect(next.getActiveSheet().getCellMeta(0, 0).validation.source).toEqual(['Open', 'Done']);
  });
});
