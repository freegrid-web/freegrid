describe('Row geometry with one height for every row', () => {
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

  const firstRenderedRowText = () => spec().$container.find('.fs-master tbody tr:first td:first').text();

  it('shows the right rows after scrolling deep into a large grid', () => {
    const hot = handsontable({ data: Handsontable.helper.createSpreadsheetData(100000, 3), width: 300, height: 300 });

    hot.scrollViewportTo(90000, 0);
    hot.render();

    expect(hot.view.wt.wtTable.getFirstVisibleRow()).toBe(90000);
    expect(hot.getCell(90000, 0).textContent).toBe('A90001');
  });

  it('still asks `rowHeights` as a function for the rows above the viewport', () => {
    const rowHeights = jasmine.createSpy('rowHeights').and.returnValue(23);
    const hot = handsontable({ data: Handsontable.helper.createSpreadsheetData(1000, 3), width: 300, height: 300,
      rowHeights });

    rowHeights.calls.reset();
    hot.scrollViewportTo(800, 0);
    hot.render();

    expect(rowHeights).toHaveBeenCalledWith(10);
    expect(hot.view.wt.wtTable.getFirstVisibleRow()).toBe(800);
  });

  it('still runs `modifyRowHeight` for the rows above the viewport', () => {
    const modifyRowHeight = jasmine.createSpy('modifyRowHeight').and.callFake(height => height);
    const hot = handsontable({ data: Handsontable.helper.createSpreadsheetData(1000, 3), width: 300, height: 300,
      modifyRowHeight });

    modifyRowHeight.calls.reset();
    hot.scrollViewportTo(800, 0);
    hot.render();

    expect(modifyRowHeight.calls.allArgs().some(([, row]) => row === 10)).toBe(true);
  });

  it('places the rows below a taller (oversized) row correctly', () => {
    const data = Handsontable.helper.createSpreadsheetData(1000, 3);

    data[0][0] = 'line\nline\nline\nline';
    const hot = handsontable({ data, width: 300, height: 300 });

    hot.render(); // the first render measures the taller row
    hot.scrollViewportTo(800, 0);
    hot.render();

    expect(hot.view.wt.wtTable.getFirstVisibleRow()).toBe(800);
    expect(firstRenderedRowText()).not.toBe('');
    expect(hot.getCell(800, 0).textContent).toBe('A801');
  });

  it('places rows correctly after scrolling past many taller rows', () => {
    const data = Handsontable.helper.createSpreadsheetData(2000, 3);

    for (let row = 0; row < 2000; row += 50) {
      data[row][0] = 'line\nline\nline';
    }
    const hot = handsontable({ data, width: 300, height: 300 });

    [500, 1000, 1500].forEach((row) => {
      hot.scrollViewportTo(row, 0);
      hot.render();
    });

    expect(hot.view.wt.wtTable.getFirstVisibleRow()).toBe(1500);
    expect(hot.getCell(1501, 0).textContent).toBe('A1502');
    expect(hot.view.wt.wtViewport.getRowGeometry()).not.toBeNull();
  });
});

