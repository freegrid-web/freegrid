describe('Core sheets', () => {
  const id = 'testContainer';

  beforeEach(function() {
    this.$container = $(`<div id="${id}" style="width: 400px; height: 200px; overflow: hidden"></div>`).appendTo('body');
  });

  afterEach(function() {
    if (this.$container) {
      destroy();
      this.$container.remove();
    }
    $('.fs-sheet-tabs, .fs-sheet-menu').remove();
  });

  const tabs = () => Array.from(document.querySelectorAll('.fs-sheet-tabs .fs-sheet-tab'));
  const tabNames = () => tabs().map(tab => tab.textContent);

  it('is one sheet, Sheet1, without tabs until a sheet is added', () => {
    const hot = handsontable({ data: [[1]] });

    expect(hot.getSheets()).toEqual([{ id: 'sheet1', name: 'Sheet1' }]);
    expect(hot.getSheetId()).toBe('sheet1');
    expect(hot.getSheetName()).toBe('Sheet1');
    expect(hot.getActiveSheet()).toBe(hot);
    expect(document.querySelector('.fs-sheet-tabs')).toBeNull();
  });

  it('adds sheets with their own data, names and default ids', () => {
    const hot = handsontable({ data: [[1]], colHeaders: true });
    const costs = hot.addSheet('costs', { name: 'Costs', data: [['Rent', 1200]] });
    const third = hot.addSheet();

    expect(hot.getSheets()).toEqual([
      { id: 'sheet1', name: 'Sheet1' }, { id: 'costs', name: 'Costs' }, { id: 'sheet2', name: 'Sheet2' }]);
    expect(costs.getDataAtCell(0, 1)).toBe(1200);
    expect(hot.getSheet('costs')).toBe(costs);
    expect(hot.getSheet('nope')).toBeNull();
    expect(costs.getSettings().colHeaders).toBe(true); // taken from the first sheet
    expect(third.getSheetName()).toBe('Sheet2');
    expect(costs.getSheets()).toEqual(hot.getSheets()); // the same document from every sheet
    expect(tabNames()).toEqual(['Sheet1', 'Costs', 'Sheet2']);
    expect(hot.getActiveSheet()).toBe(hot); // adding does not activate
    expect(costs.rootElement.style.display).toBe('none');
  });

  it('keeps cell methods on their own sheet', () => {
    const hot = handsontable({ data: [['first']] });
    const second = hot.addSheet('second', { data: [['second']] });

    hot.activateSheet('second');

    expect(hot.getDataAtCell(0, 0)).toBe('first');
    expect(second.getDataAtCell(0, 0)).toBe('second');
    expect(hot.getActiveSheet()).toBe(second);
  });

  it('activates a sheet: shows its grid, hides the others, marks its tab', () => {
    const hot = handsontable({ data: [[1]] });
    const second = hot.addSheet('second', { data: [[2]] });

    hot.activateSheet('second');

    expect(hot.rootElement.style.display).toBe('none');
    expect(second.rootElement.style.display).toBe('');
    expect(second.getCell(0, 0).textContent).toBe('2');
    expect(document.querySelector('.fs-sheet-tab--active').textContent).toBe('second');
    expect(second.isListening()).toBe(true);
  });

  it('activates a sheet by clicking its tab', () => {
    const hot = handsontable({ data: [[1]] });

    hot.addSheet('second');
    tabs()[1].click();

    expect(hot.getActiveSheet().getSheetId()).toBe('second');
  });

  it('adds and activates a sheet with the + button', () => {
    const hot = handsontable({ data: [[1]], sheetTabs: true });

    expect(tabNames()).toEqual(['Sheet1']);
    document.querySelector('.fs-sheet-tabs__add').click();

    expect(tabNames()).toEqual(['Sheet1', 'Sheet2']);
    expect(hot.getActiveSheet().getSheetName()).toBe('Sheet2');
  });

  it('lists every sheet in the ☰ menu, and activates the one clicked', () => {
    const hot = handsontable({ data: [[1]] });

    hot.addSheet('b', { name: 'B' });
    hot.addSheet('c', { name: 'C' });
    document.querySelector('.fs-sheet-tabs__menu').click();

    const items = Array.from(document.querySelectorAll('.fs-sheet-menu .fs-sheet-menu__item'));

    expect(items.map(item => item.textContent)).toEqual(['Sheet1', 'B', 'C']);
    expect(items[0].classList.contains('fs-sheet-menu__item--active')).toBe(true);

    items[2].click();

    expect(hot.getActiveSheet().getSheetId()).toBe('c');
    expect(document.querySelector('.fs-sheet-menu')).toBeNull();
  });

  it('scrolls many tabs sideways, fading the edge where tabs are hidden', () => {
    const hot = handsontable({ data: [[1]] });

    for (let i = 0; i < 30; i += 1) {
      hot.addSheet();
    }
    const list = document.querySelector('.fs-sheet-tabs__list');

    expect(list.scrollWidth).toBeGreaterThan(list.clientWidth);
    expect(list.classList.contains('fs-sheet-tabs__list--fade-end')).toBe(true);
    expect(list.classList.contains('fs-sheet-tabs__list--fade-start')).toBe(false);

    // The wheel scrolls back (a line-based wheel, as in Firefox, too), and so do ‹ ›.
    const before = list.scrollLeft;

    list.dispatchEvent(new WheelEvent('wheel', { deltaY: 3, deltaMode: 1, bubbles: true, cancelable: true }));
    expect(list.scrollLeft).toBe(before + 120);
    list.dispatchEvent(new WheelEvent('wheel', { deltaY: -3, deltaMode: 1, bubbles: true, cancelable: true }));
    expect(list.scrollLeft).toBe(before);

    const [left, right] = document.querySelectorAll('.fs-sheet-tabs__scroll');

    expect(left.disabled).toBe(true);
    right.click();
    expect(list.scrollLeft).toBeGreaterThan(before);
    expect(left.disabled).toBe(false);

    hot.activateSheet('sheet31');

    expect(list.isConnected ? list.scrollLeft : document.querySelector('.fs-sheet-tabs__list').scrollLeft)
      .toBeGreaterThan(0);
  });

  it('renames a sheet, and rejects invalid or duplicate names', () => {
    const hot = handsontable({ data: [[1]] });

    hot.addSheet('costs', { name: 'Costs' });
    hot.renameSheet('costs', 'Expenses');

    expect(hot.getSheet('costs').getSheetName()).toBe('Expenses');
    expect(tabNames()).toEqual(['Sheet1', 'Expenses']);
    expect(() => hot.renameSheet('costs', 'sheet1')).toThrowError(/already exists/);
    expect(() => hot.renameSheet('costs', 'a/b')).toThrowError(/not a valid sheet name/);
    expect(() => hot.renameSheet('costs', '')).toThrowError(/not a valid sheet name/);
  });

  it('renames a sheet by double-clicking its tab', () => {
    const hot = handsontable({ data: [[1]] });

    hot.addSheet('costs', { name: 'Costs' });
    $(tabs()[1]).simulate('dblclick');

    const input = document.querySelector('.fs-sheet-tab__input');

    input.value = 'Budget';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(hot.getSheet('costs').getSheetName()).toBe('Budget');
  });

  it('removes a sheet and activates a neighbour; the first sheet cannot be removed', () => {
    const hot = handsontable({ data: [[1]] });
    const second = hot.addSheet('second');

    hot.activateSheet('second');
    hot.removeSheet('second');

    expect(hot.getSheets()).toEqual([{ id: 'sheet1', name: 'Sheet1' }]);
    expect(hot.getActiveSheet()).toBe(hot);
    expect(second.isDestroyed).toBe(true);
    expect(hot.rootElement.style.display).toBe('');
    expect(document.querySelector('.fs-sheet-tabs')).toBeNull();
    expect(() => hot.removeSheet('sheet1')).toThrowError(/cannot be removed/);
  });

  it('moves a sheet in the tab order', () => {
    const hot = handsontable({ data: [[1]] });

    hot.addSheet('b');
    hot.addSheet('c');
    hot.moveSheet('c', 0);

    expect(hot.getSheets().map(sheet => sheet.id)).toEqual(['c', 'sheet1', 'b']);
    expect(tabNames()).toEqual(['c', 'Sheet1', 'b']);
  });

  it('keeps the tabs below the sheets after a tab is moved, or above them with sheetTabsPosition: top', () => {
    const hot = handsontable({ data: [[1]] });

    hot.addSheet('b');
    hot.addSheet('c');
    hot.moveSheet('c', 1);

    const tabsBar = document.querySelector('.fs-sheet-tabs');
    const roots = hot.getSheets().map(({ id }) => hot.getSheet(id).rootElement);

    roots.forEach(root => expect(root.compareDocumentPosition(tabsBar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy());

    hot.updateSettings({ sheetTabsPosition: 'top' });
    roots.forEach(root => expect(root.compareDocumentPosition(tabsBar) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy());
  });

  it('moves a dropped tab before or after the tab under the pointer', () => {
    const hot = handsontable({ data: [[1]] });

    hot.addSheet('b');
    hot.addSheet('c');

    const drop = (draggedIndex, targetIndex, side) => {
      const [dragged, target] = [tabs()[draggedIndex], tabs()[targetIndex]];
      const rect = target.getBoundingClientRect();
      const clientX = side === 'after' ? rect.right - 2 : rect.left + 2;
      const dataTransfer = new DataTransfer();

      dragged.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientX, dataTransfer }));
      expect(target.classList.contains(`fs-sheet-tab--drop-${side}`)).toBe(true);
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientX, dataTransfer }));
    };

    drop(2, 0, 'after'); // c after Sheet1
    expect(hot.getSheets().map(sheet => sheet.id)).toEqual(['sheet1', 'c', 'b']);

    drop(0, 2, 'after'); // Sheet1 to the end
    expect(hot.getSheets().map(sheet => sheet.id)).toEqual(['c', 'b', 'sheet1']);

    drop(2, 0, 'before'); // Sheet1 to the front
    expect(hot.getSheets().map(sheet => sheet.id)).toEqual(['sheet1', 'c', 'b']);
    expect(document.querySelector('.fs-sheet-tab--drop-before, .fs-sheet-tab--drop-after')).toBeNull();
  });

  it('runs the sheet events on the first sheet, and lets them cancel', () => {
    const events = [];
    const hot = handsontable({
      data: [[1]],
      afterSheetAdd: (sheetId, name) => events.push(['add', sheetId, name]),
      afterSheetActivate: (sheetId, previousId) => events.push(['activate', sheetId, previousId]),
      afterSheetRename: (sheetId, oldName, newName) => events.push(['rename', sheetId, oldName, newName]),
      afterSheetMove: (sheetId, index, previousIndex) => events.push(['move', sheetId, index, previousIndex]),
      afterSheetRemove: sheetId => events.push(['remove', sheetId]),
      beforeSheetRemove: sheetId => sheetId !== 'keep',
    });

    hot.addSheet('x', { name: 'X' });
    hot.activateSheet('x');
    hot.renameSheet('x', 'Y');
    hot.moveSheet('x', 0);
    hot.addSheet('keep');
    hot.removeSheet('keep');
    hot.removeSheet('x');

    expect(events).toEqual([
      ['add', 'x', 'X'], ['activate', 'x', 'sheet1'], ['rename', 'x', 'X', 'Y'], ['move', 'x', 0, 1],
      ['add', 'keep', 'keep'], ['activate', 'sheet1', 'x'], ['remove', 'x'],
    ]);
    expect(hot.getSheet('keep')).not.toBeNull();
  });

  it('creates the sheets of the `sheets` setting with the grid', () => {
    const hot = handsontable({ data: [[1]], sheetName: 'Sales', sheets: [{ id: 'costs', name: 'Costs', data: [[2]] }] });

    expect(hot.getSheets()).toEqual([{ id: 'sheet1', name: 'Sales' }, { id: 'costs', name: 'Costs' }]);
    expect(hot.getSheet('costs').getDataAtCell(0, 0)).toBe(2);
    expect(tabNames()).toEqual(['Sales', 'Costs']);
  });

  it('destroys every sheet and the tabs with the first sheet', function() {
    const hot = handsontable({ data: [[1]] });
    const second = hot.addSheet('second');

    destroy();
    this.$container.remove();
    this.$container = null;

    expect(second.isDestroyed).toBe(true);
    expect(document.querySelector('.fs-sheet-tabs')).toBeNull();
    expect(hot.isDestroyed).toBe(true);
  });
});
