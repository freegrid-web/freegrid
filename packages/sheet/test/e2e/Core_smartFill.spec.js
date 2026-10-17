describe('Core fill series', () => {
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

  /** Drags the fill handle of the selection to a cell. */
  const dragTo = (row, col) => {
    spec().$container.find('.wtBorder.current.corner').simulate('mousedown');
    spec().$container.find(`tbody tr:eq(${row}) td:eq(${col})`).simulate('mouseover').simulate('mouseup');
  };

  it('goes on with series down: numbers, text with a number, names and dates; one number repeats', () => {
    const hot = handsontable({
      data: [
        [1, 'Item 1', 'Jan', 'Monday', '2026-01-30', 5],
        [3, null, null, null, null, null],
        [null, null, null, null, null, null],
        [null, null, null, null, null, null],
      ],
    });

    selectCell(0, 0, 1, 0);
    dragTo(3, 0);
    expect(hot.getDataAtCol(0)).toEqual([1, 3, 5, 7]);

    selectCell(0, 1, 0, 5);
    dragTo(2, 5);
    expect(hot.getData(1, 1, 2, 5)).toEqual([
      ['Item 2', 'Feb', 'Tuesday', '2026-01-31', 5],
      ['Item 3', 'Mar', 'Wednesday', '2026-02-01', 5],
    ]);
  });

  it('goes on with series to the right and backwards (up, left)', () => {
    const hot = handsontable({
      data: [
        [null, null, 'Q3', 'Q4', null],
        [null, null, null, 'Fri', null],
        [null, null, null, 10, null],
        [null, null, null, 20, null],
      ],
    });

    selectCell(0, 2, 0, 3);
    dragTo(0, 4);
    expect(hot.getDataAtCell(0, 4)).toBe('Q5');

    selectCell(0, 2, 0, 3);
    dragTo(0, 0);
    expect(hot.getData(0, 0, 0, 1)).toEqual([['Q1', 'Q2']]);

    selectCell(2, 3, 3, 3);
    dragTo(0, 3);
    expect(hot.getData(0, 3, 1, 3)).toEqual([[-10], [0]]);
  });

  it('goes on with the dates of a date column in its format', async() => {
    const hot = handsontable({
      data: [['15/03/2026'], [null], [null]],
      columns: [{ type: 'date', dateFormat: 'DD/MM/YYYY' }],
    });

    selectCell(0, 0);
    dragTo(2, 0);
    // Date cells are validated before they change.
    await sleep(100);
    expect(hot.getDataAtCol(0)).toEqual(['15/03/2026', '16/03/2026', '17/03/2026']);
  });

  it('repeats text that is no series, and is one undo step', () => {
    const hot = handsontable({ data: [['a', 'Item 1'], ['b', null], [null, null], [null, null]] });

    selectCell(0, 0, 1, 1);
    dragTo(3, 1);
    // With an empty cell among them, the values repeat.
    expect(hot.getData()).toEqual([['a', 'Item 1'], ['b', null], ['a', 'Item 1'], ['b', null]]);

    hot.undo();
    expect(hot.getData()).toEqual([['a', 'Item 1'], ['b', null], [null, null], [null, null]]);
  });
});
