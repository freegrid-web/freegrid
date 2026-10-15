describe('Mapper operations after repeated index translations', () => {
  let container;
  let grid;
  let globalSaveHook;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (globalSaveHook) {
      FreeSheet.hooks.remove('persistentStateSave', globalSaveHook);
      globalSaveHook = null;
    }
    if (grid) grid.destroy();
    container.remove();
  });

  const checkTranslations = (mapper, sorted = false) => {
    for (let repeat = 0; repeat < 220; repeat++) {
      for (const physicalRow of [0, 1, 250, 500, 999]) {
        const index = mapper._arrayMap.indexOf(physicalRow);

        expect(grid.toVisualRow(physicalRow)).toBe(index === -1 ? (sorted ? null : physicalRow) : index);
      }
    }
  };

  it('keeps row translations current across bulk removal, insertion, moves and loadData', () => {
    grid = new FreeSheet(container, {
      data: Array.from({ length: 1000 }, (_, index) => [index]),
      width: 400, height: 200, manualRowMove: true, autoRowSize: false, autoColumnSize: false,
    });
    const plugin = grid.getPlugin('manualRowMove');

    plugin.moveRow(999, 0);
    checkTranslations(plugin.rowsMapper);
    grid.alter('remove_row', 200, 100);
    checkTranslations(plugin.rowsMapper);
    grid.alter('insert_row', 50, 80);
    checkTranslations(plugin.rowsMapper);
    plugin.moveRows([0, 250, 500], 700);
    checkTranslations(plugin.rowsMapper);
    expect(grid.getDataAtCell(697, 0)).toBe(999);
    grid.loadData(Array.from({ length: 1000 }, (_, index) => [index]));
    checkTranslations(plugin.rowsMapper);
  });

  it('keeps sorted reverse translations current across sorts and row changes', () => {
    grid = new FreeSheet(container, {
      data: Array.from({ length: 1000 }, (_, index) => [999 - index]),
      width: 400, height: 200, columnSorting: true, autoRowSize: false, autoColumnSize: false,
    });
    const plugin = grid.getPlugin('columnSorting');

    plugin.sort({ column: 0, sortOrder: 'asc' });
    checkTranslations(plugin.rowsMapper, true);
    expect(grid.getDataAtCell(0, 0)).toBe(0);
    plugin.sort({ column: 0, sortOrder: 'desc' });
    checkTranslations(plugin.rowsMapper, true);
    expect(grid.getDataAtCell(0, 0)).toBe(999);
    grid.alter('remove_row', 200, 100);
    checkTranslations(plugin.rowsMapper, true);
    grid.alter('insert_row', 50, 80);
    checkTranslations(plugin.rowsMapper, true);
  });

  for (const axis of ['row', 'column', 'global row']) {
    it(`keeps the live ${axis} map passed to persistentStateSave observable`, () => {
      const row = axis !== 'column';
      const pluginName = row ? 'manualRowMove' : 'manualColumnMove';
      const translate = row ? 'toVisualRow' : 'toVisualColumn';
      let saved;

      grid = new FreeSheet(container, {
        data: row ? Array.from({ length: 1000 }, (_, index) => [index]) : [Array.from({ length: 1000 }, (_, index) => index)],
        width: 400, height: 200, [pluginName]: true, autoRowSize: false, autoColumnSize: false,
      });
      for (let repeat = 0; repeat < 1100; repeat++) grid[translate](999);
      const saveHook = (key, value) => {
        if (key !== pluginName) return;
        saved = value;
        saved[0] = 999;
        saved[999] = 0;
        expect(grid[translate](999)).toBe(0);
      };

      if (axis === 'global row') {
        globalSaveHook = saveHook;
        FreeSheet.hooks.add('persistentStateSave', saveHook);
      } else {
        grid.addHook('persistentStateSave', saveHook);
      }
      grid.getPlugin(pluginName).persistentStateSave();
      for (let repeat = 0; repeat < 1100; repeat++) expect(grid[translate](999)).toBe(0);
      saved[0] = 0;
      saved[999] = 999;
      expect(grid[translate](999)).toBe(999);
    });
  }

  it('keeps a live map supplied by persistentStateLoad observable', () => {
    grid = new FreeSheet(container, {
      data: [Array.from({ length: 1000 }, (_, index) => index)],
      width: 400, height: 200, manualColumnMove: true, autoRowSize: false, autoColumnSize: false,
    });
    const supplied = Array.from({ length: 1000 }, (_, index) => index);

    grid.addHook('persistentStateLoad', (key, state) => {
      if (key === 'manualColumnMove') state.value = supplied;
    });
    grid.getPlugin('manualColumnMove').persistentStateLoad();
    for (let repeat = 0; repeat < 1100; repeat++) expect(grid.toVisualColumn(999)).toBe(999);
    supplied[0] = 999;
    supplied[999] = 0;
    expect(grid.toVisualColumn(999)).toBe(0);
  });
});
