describe('MultipleSelectionHandles', () => {
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

  it('should keep the other handle dragged when one of two dragged handles is released', () => {
    handsontable({});
    const plugin = getPlugin('multipleSelectionHandles');

    plugin.dragged = ['topLeft', 'bottomRight'];
    plugin.removeFromDragged('topLeft');

    expect(plugin.dragged).toEqual(['bottomRight']);

    plugin.dragged = ['topLeft', 'bottomRight'];
    plugin.removeFromDragged('bottomRight');

    expect(plugin.dragged).toEqual(['topLeft']);

    plugin.removeFromDragged('topLeft');

    expect(plugin.isDragged()).toBe(false);
  });
});
