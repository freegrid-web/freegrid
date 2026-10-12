describe('Core_reCreate', () => {
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

  // FG-SKIP: Chromium 156 (LayoutNG) lays out the two-line header 1px taller than Chromium 72 used by the 6.2.2 baseline; same fonts (DejaVu/Liberation) — TBD-ISSUE
  xit('should correctly re-render corner header when there is multiline content', () => {
    const settings = {
      rowHeaders: true,
      colHeaders(col) {
        return `Column<br>${col}`;
      }
    };
    handsontable(settings);
    destroy();
    handsontable(settings);

    expect(getTopLeftClone().width()).toBe(54);
    expect(getTopLeftClone().height()).toBe(45);
  });
});
