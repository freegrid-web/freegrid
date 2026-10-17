describe('Core loading state', () => {
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

  const overlay = () => spec().$container[0].querySelector('.fs-loading');

  it('shows a layer with a spinner and a text over the grid, and hides it', () => {
    const hot = handsontable({ data: [[1, 2], [3, 4]] });

    hot.setLoading(true);

    expect(hot.isLoading()).toBe(true);
    expect(overlay().getAttribute('role')).toBe('status');
    expect(overlay().textContent).toBe('Loading…');
    expect(hot.rootElement.getAttribute('aria-busy')).toBe('true');

    hot.setLoading('Reading the file');
    expect(overlay().textContent).toBe('Reading the file');
    expect(spec().$container[0].querySelectorAll('.fs-loading').length).toBe(1);

    hot.setLoading(false);
    expect(hot.isLoading()).toBe(false);
    expect(overlay()).toBeNull();
    expect(hot.rootElement.hasAttribute('aria-busy')).toBe(false);
  });

  it('takes the clicks and ignores the keyboard while loading', () => {
    const hot = handsontable({ data: [[1, 2], [3, 4]] });

    selectCell(0, 0);
    hot.setLoading(true);
    keyDownUp('arrow_down');
    $(overlay()).simulate('mousedown');

    expect(getSelectedLast()).toEqual([0, 0, 0, 0]);

    hot.setLoading(false);
    keyDownUp('arrow_down');
    expect(getSelectedLast()).toEqual([1, 0, 1, 0]);
  });

  it('shows the loading state while importFile reads a file', async() => {
    let loadingWhileReading = null;
    const hot = handsontable({ data: [[null]] });

    hot.addHook('afterLoadData', () => {
      loadingWhileReading = hot.isLoading();
    });

    await hot.importFile('1,2');

    expect(loadingWhileReading).toBe(true);
    expect(hot.isLoading()).toBe(false);
  });
});
