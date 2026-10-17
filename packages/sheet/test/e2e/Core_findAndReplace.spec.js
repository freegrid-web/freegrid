describe('Core find and replace', () => {
  const id = 'testContainer';

  beforeEach(function() {
    this.$container = $(`<div id="${id}"></div>`).appendTo('body');
  });

  afterEach(function() {
    if (this.$container) {
      destroy();
      this.$container.remove();
    }
    $('.fs-find').remove();
  });

  const box = () => $('.fs-find');
  const status = () => box().find('.fs-find__status').text();
  const type = (selector, text) => {
    const input = box().find(selector).val(text).get(0);

    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const press = (selector, key, shiftKey = false) => {
    box().find(selector).get(0).dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true }));
  };

  it('opens with Ctrl+F, highlights the matches and goes through them', async() => {
    const hot = handsontable({
      data: [['apple', 'Pear'], ['pineapple', 'apple pie'], ['plum', 'APPLE']],
      findAndReplace: true,
    });

    selectCell(0, 0);
    keyDownUp(70, { ctrlKey: true });

    expect(box().length).toBe(1);
    expect(box().hasClass('fs-find--replace')).toBe(false);
    expect(document.activeElement).toBe(box().find('.fs-find__query').get(0));

    type('.fs-find__query', 'apple');
    // Case-insensitive "contains", in reading order.
    expect(hot.getPlugin('findAndReplace').matches).toEqual([
      { row: 0, col: 0 }, { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 2, col: 1 }]);
    expect(status()).toBe('1 of 4');
    // Going to a match leaves the focus in the box, so typing goes on there (also after the editor's deferred focus).
    expect(document.activeElement).toBe(box().find('.fs-find__query').get(0));
    await sleep(50);
    expect(document.activeElement).toBe(box().find('.fs-find__query').get(0));
    expect(getCell(1, 0).classList.contains('fs-find-result')).toBe(true);
    expect(getCell(0, 0).classList.contains('fs-find-result--current')).toBe(true);

    press('.fs-find__query', 'Enter');
    expect(status()).toBe('2 of 4');
    expect(getSelected()).toEqual([[1, 0, 1, 0]]);
    press('.fs-find__query', 'Enter', true);
    press('.fs-find__query', 'Enter', true);
    expect(status()).toBe('4 of 4');

    box().find('[name="matchCase"]').prop('checked', true).get(0).dispatchEvent(new Event('change'));
    expect(hot.getPlugin('findAndReplace').matches.length).toBe(3);
    box().find('[name="entireCell"]').prop('checked', true).get(0).dispatchEvent(new Event('change'));
    expect(hot.getPlugin('findAndReplace').matches).toEqual([{ row: 0, col: 0 }]);

    press('.fs-find__query', 'Escape');
    expect(box().length).toBe(0);
    expect(getCell(0, 0).classList.contains('fs-find-result')).toBe(false);
  });

  it('replaces the current match, then all of them in one undo step, leaving read-only cells', () => {
    const hot = handsontable({
      data: [['red car', 'red'], ['blue', 'Red sky'], [12, 'red']],
      cell: [{ row: 2, col: 1, readOnly: true }],
      findAndReplace: true,
    });

    selectCell(0, 0);
    keyDownUp(72, { ctrlKey: true });
    expect(box().hasClass('fs-find--replace')).toBe(true);

    type('.fs-find__query', 'red');
    type('.fs-find__replacement', 'green');
    box().find('.fs-find__replace').simulate('click');
    expect(hot.getDataAtCell(0, 0)).toBe('green car');
    expect(status()).toBe('1 of 3');

    box().find('.fs-find__replace-all').simulate('click');
    expect(hot.getData()).toEqual([['green car', 'green'], ['blue', 'green sky'], [12, 'red']]);
    expect(status()).toBe('Replaced 2');

    hot.undo();
    expect(hot.getData()).toEqual([['green car', 'red'], ['blue', 'Red sky'], [12, 'red']]);

    // A number stays a number.
    expect(hot.getPlugin('findAndReplace').replace('12', '15')).toBe(1);
    expect(hot.getDataAtCell(2, 0)).toBe(15);
  });

  it('finds formula results, or the formulas themselves', async() => {
    const engine = await import(/* @vite-ignore */ '/node_modules/@ironcalc/wasm/wasm.js');

    await engine.default({ module_or_path: '/node_modules/@ironcalc/wasm/wasm_bg.wasm' });
    const hot = handsontable({ data: [[2, '=A1*21']], formulas: { engine: engine.Model }, findAndReplace: true });
    const plugin = hot.getPlugin('findAndReplace');

    expect(plugin.find('42')).toEqual([{ row: 0, col: 1 }]);
    expect(plugin.find('A1')).toEqual([]);
    expect(plugin.find('A1', { inFormulas: true })).toEqual([{ row: 0, col: 1 }]);

    plugin.replace('21', '50', { inFormulas: true });
    expect(hot.getSourceDataAtCell(0, 1)).toBe('=A1*50');
    expect(hot.getDataAtCell(0, 1)).toBe(100);
  });

  it('moves out of the way of the current match', () => {
    handsontable({ data: createSpreadsheetData(10, 6), findAndReplace: true, width: 500, height: 300 });

    selectCell(0, 0);
    keyDownUp(70, { ctrlKey: true });
    type('.fs-find__query', 'F1');

    const box = $('.fs-find').get(0).getBoundingClientRect();
    const cell = getCell(0, 5).getBoundingClientRect();

    expect(box.top >= cell.bottom || box.bottom <= cell.top || box.right <= cell.left || box.left >= cell.right)
      .toBe(true);
  });

  it('does nothing without the setting', () => {
    handsontable({ data: [['a']] });

    selectCell(0, 0);
    keyDownUp(70, { ctrlKey: true });
    expect(box().length).toBe(0);
  });
});
