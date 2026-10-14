// The jQuery plugin is available as $.fn.freesheet; $.fn.freegrid and $.fn.handsontable remain for compatibility.
describe('FreeSheet jQuery plugin', () => {
  let $container;

  beforeEach(() => {
    $container = $('<div id="testContainer"></div>').appendTo('body');
  });

  afterEach(() => {
    $container.freesheet('destroy');
    $container.remove();
  });

  it('creates an instance with $.fn.freesheet and returns it via getInstance', () => {
    $container.freesheet({ data: [[1, 2]] });
    const instance = $container.freesheet('getInstance');

    expect(instance instanceof FreeSheet.Core).toBe(true);
    expect(instance.getDataAtCell(0, 1)).toBe(2);
  });

  it('shares the instance with the $.fn.freegrid and $.fn.handsontable compatibility names', () => {
    $container.freesheet({ data: [[1]] });

    expect($container.freegrid('getInstance')).toBe($container.freesheet('getInstance'));
    expect($container.handsontable('getInstance')).toBe($container.freesheet('getInstance'));
  });

  it('names FreeSheet in the error for an unknown action', () => {
    $container.freesheet({ data: [[1]] });

    expect(() => $container.freesheet('noSuchAction')).toThrowError('FreeSheet does not provide action: noSuchAction');
  });
});
