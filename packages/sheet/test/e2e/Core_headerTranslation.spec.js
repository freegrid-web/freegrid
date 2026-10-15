describe('Column header translation behavior', () => {
  let container;
  let grid;

  beforeEach(() => {
    grid = null;
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (grid) grid.destroy();
    container.remove();
  });

  const create = (settings = {}) => {
    grid = new FreeSheet(container, {
      data: [[0, 1, 2]], width: 400, height: 200, colHeaders: true,
      autoRowSize: false, autoColumnSize: false, ...settings,
    });
  };

  it('keeps column-title precedence, translation order and hook counts for all headers', () => {
    create({ columns: [{ title: 'Zero' }, { title: 'One' }, { title: 'Two' }] });
    const calls = [];

    grid.addHook('modifyColHeader', (index) => { calls.push(['header', index]); return index; });
    grid.addHook('modifyCol', (index) => { calls.push(['column', index]); return 2 - index; });
    expect(grid.getColHeader()).toEqual(['Two', 'One', 'Zero']);
    expect(calls).toEqual([
      ['header', undefined], ['header', 0], ['column', 0],
      ['header', 1], ['column', 1], ['header', 2], ['column', 2],
    ]);
  });

  it('keeps source-column scanning and repeated functional title calls in their original order', () => {
    create();
    const calls = [];

    grid.getSettings().columns = (index) => {
      calls.push(index);
      return { data: index, title: `${calls.length}:${index}` };
    };
    expect(grid.getColHeader(1)).toBe('6:1');
    expect(calls).toEqual([0, 1, 2, 1, 1, 1]);
  });

  it('still evaluates functional columns when headers are disabled', () => {
    create({ colHeaders: false });
    const calls = [];

    grid.getSettings().columns = (index) => { calls.push(index); return { data: index }; };
    expect(grid.getColHeader(1)).toBe(null);
    expect(calls).toEqual([0, 1, 2]);
  });

  it('uses a columns callback installed by the modifyCol hook during the same lookup', () => {
    create();
    const calls = [];

    grid.addHook('modifyCol', (index) => {
      grid.getSettings().columns = (source) => { calls.push(source); return { title: `Title ${source}` }; };
      return index;
    });
    expect(grid.getColHeader(1)).toBe('Title 1');
    expect(calls).toEqual([0, 1, 2, 1, 1, 1]);
  });

  it('observes a callback replacing itself during source-column scanning', () => {
    create();
    const calls = [];

    grid.getSettings().columns = (index) => {
      calls.push(index);
      grid.getSettings().columns = [{ title: 'New zero' }, { title: 'New one' }, { title: 'New two' }];
      return { title: 'Old' };
    };
    expect(grid.getColHeader(1)).toBe('New one');
    expect(calls).toEqual([0]);
  });

  it('observes a header callback changing columns for the next header', () => {
    const calls = [];

    create();
    grid.getSettings().colHeaders = (index) => {
      grid.getSettings().columns = (source) => { calls.push(source); return { title: `Title ${source}` }; };
      return `Header ${index}`;
    };
    grid.getSettings().columns = null;
    calls.length = 0;
    expect(grid.getColHeader()).toEqual(['Header 0', 'Title 1', 'Title 2']);
    expect(calls).toEqual([0, 1, 2, 1, 1, 1, 0, 1, 2, 2, 2, 2]);
  });

  it('keeps sparse header fallbacks and out-of-range labels', () => {
    const headers = ['First', 'Second', 'Third'];

    delete headers[1];
    create({ colHeaders: headers });
    expect(grid.getColHeader()).toEqual(['First', 'B', 'Third']);
    expect(grid.getColHeader(30)).toBe('AE');
    grid.updateSettings({ colHeaders: false });
    expect(grid.getColHeader()).toEqual([null, null, null]);
  });

  it('sees object source replacement, direct setting changes and updateSettings without stale headers', () => {
    create({ data: [{ a: 1, b: 2, c: 3 }] });
    expect(grid.getColHeader()).toEqual(['A', 'B', 'C']);
    grid.loadData([{ x: 1, y: 2 }]);
    expect(grid.countSourceCols()).toBe(2);
    expect(grid.getColHeader()).toEqual(['A', 'B', 'C']);
    grid.updateSettings({ columns: [{ data: 'x', title: 'X' }, { data: 'y', title: 'Y' }] });
    expect(grid.getColHeader()).toEqual(['X', 'Y']);
    grid.getSettings().columns[1].title = 'Updated';
    expect(grid.getColHeader(1)).toBe('Updated');
  });
});
