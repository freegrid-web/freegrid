// FreeGrid: the jQuery plugin is available as $.fn.freegrid; $.fn.handsontable remains for compatibility.
describe('FreeGrid jQuery plugin', () => {
  let $container;

  beforeEach(() => {
    $container = $('<div id="testContainer"></div>').appendTo('body');
  });

  afterEach(() => {
    $container.freegrid('destroy');
    $container.remove();
  });

  it('creates an instance with $.fn.freegrid and returns it via getInstance', () => {
    $container.freegrid({ data: [[1, 2]] });
    const instance = $container.freegrid('getInstance');

    expect(instance instanceof FreeGrid.Core).toBe(true);
    expect(instance.getDataAtCell(0, 1)).toBe(2);
  });

  it('shares the instance with the $.fn.handsontable compatibility name', () => {
    $container.freegrid({ data: [[1]] });

    expect($container.handsontable('getInstance')).toBe($container.freegrid('getInstance'));
  });

  it('names FreeGrid in the error for an unknown action', () => {
    $container.freegrid({ data: [[1]] });

    expect(() => $container.freegrid('noSuchAction')).toThrowError('FreeGrid does not provide action: noSuchAction');
  });
});
