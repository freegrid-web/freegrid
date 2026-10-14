describe('Core viewport rendering offset', () => {
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

  it('should render extra columns on the right only with `viewportColumnRenderingOffset: \'auto\'`', () => {
    handsontable({
      data: Handsontable.helper.createSpreadsheetData(5, 100),
      width: 300,
      height: 150,
      viewportColumnRenderingOffset: 'auto',
    });

    getInstance().scrollViewportTo(0, 60);
    render();

    const wtTable = getInstance().view.wt.wtTable;

    expect(wtTable.getLastRenderedColumn()).toBeGreaterThan(wtTable.getLastVisibleColumn() + 1);
    expect(wtTable.getFirstRenderedColumn()).toBeGreaterThanOrEqual(wtTable.getFirstVisibleColumn() - 1);
  });

  it('should render extra rows above with `viewportRowRenderingOffset: \'auto\'`', () => {
    handsontable({
      data: Handsontable.helper.createSpreadsheetData(200, 5),
      height: 150,
      viewportRowRenderingOffset: 'auto',
    });

    getInstance().scrollViewportTo(120, 0);
    render();

    const wtTable = getInstance().view.wt.wtTable;

    expect(wtTable.getFirstRenderedRow()).toBeLessThan(wtTable.getFirstVisibleRow() - 1);
  });
});
