// FreeGrid: fg- class names, with the legacy Handsontable names kept during 0.x.
describe('FreeGrid class names', () => {
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

  it('gives the root and the core table both names', () => {
    handsontable({ data: [[1, 2]] });

    expect(spec().$container.hasClass('freegrid')).toBe(true);
    expect(spec().$container.hasClass('handsontable')).toBe(true);
    expect(spec().$container.find('.fg-master table.fg-core').length).toBe(1);
    expect(spec().$container.find('.ht_master table.htCore').length).toBe(1);
  });

  it('styles alignment given with either the FreeGrid or the legacy class name', () => {
    handsontable({
      data: [['a', 'b']],
      colWidths: 100,
      cell: [
        { row: 0, col: 0, className: 'fg-center' },
        { row: 0, col: 1, className: 'htCenter' },
      ],
    });

    expect(getComputedStyle(getCell(0, 0)).textAlign).toBe('center');
    expect(getComputedStyle(getCell(0, 1)).textAlign).toBe('center');
  });

  it('marks read-only cells with both names and dims them', () => {
    handsontable({ data: [['a']], readOnly: true });

    expect(getCell(0, 0).classList.contains('fg-dimmed')).toBe(true);
    expect(getCell(0, 0).classList.contains('htDimmed')).toBe(true);
  });

  it('writes FreeGrid names when aligning from the context menu', () => {
    handsontable({ data: [['a']], contextMenu: true });
    selectCell(0, 0);
    getPlugin('contextMenu').executeCommand('alignment:right');

    expect(getCellMeta(0, 0).className).toContain('fg-right');
    expect(getComputedStyle(getCell(0, 0)).textAlign).toBe('right');
  });
});
