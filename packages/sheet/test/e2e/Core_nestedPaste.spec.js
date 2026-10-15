describe('Core_nestedPaste', () => {
  let container;
  let grid;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    grid?.destroy();
    container.remove();
  });

  const createGrid = settings => new FreeSheet(container, {
    width: 400, height: 200, autoRowSize: false, autoColumnSize: false, ...settings,
  });

  it('keeps change order, source and untouched nested fields across repeated population', () => {
    const data = [{ group: { value: 'a', other: 'b' } }, { group: { value: 'c', other: 'd' } }];
    const seen = [];

    grid = createGrid({ data, columns: [{ data: 'group.value' }, { data: 'group.other' }] });
    grid.addHook('afterChange', (changes, source) => seen.push([changes, source]));
    grid.populateFromArray(0, 0, [['A', 'B'], ['C', 'D']]);
    grid.populateFromArray(0, 0, [['last']]);
    expect(data).toEqual([{ group: { value: 'last', other: 'B' } }, { group: { value: 'C', other: 'D' } }]);
    expect(seen).toEqual([
      [[[0, 'group.value', 'a', 'A'], [0, 'group.other', 'b', 'B'],
        [1, 'group.value', 'c', 'C'], [1, 'group.other', 'd', 'D']], 'populateFromArray'],
      [[[0, 'group.value', 'A', 'last']], 'populateFromArray'],
    ]);
    grid.undo();
    expect(data[0].group.value).toBe('A');
    grid.redo();
    expect(data[0].group.value).toBe('last');
  });

  it('resolves the current nested object after beforeChange replaces it', () => {
    const data = [{ group: { value: 'old' } }];
    let oldGroup;

    grid = createGrid({ data, columns: [{ data: 'group.value' }] });
    grid.addHook('beforeChange', () => {
      oldGroup = data[0].group;
      data[0].group = { value: 'replacement', other: 'retained' };
    });
    grid.populateFromArray(0, 0, [['new']]);
    expect(data[0].group).toEqual({ value: 'new', other: 'retained' });
    expect(oldGroup).toEqual({ value: 'old' });
  });

  it('resolves nested objects at application time after asynchronous validation', async () => {
    const data = [{ group: { value: 'old' } }];

    grid = createGrid({ data, columns: [{ data: 'group.value', validator(value, callback) {
      data[0].group = { value: 'replacement' };
      callback(value === 'new');
    } }] });
    const changed = new Promise(done => grid.addHookOnce('afterChange', done));

    grid.populateFromArray(0, 0, [['new']]);
    expect(data[0].group.value).toBe('old');
    await changed;
    expect(data[0].group.value).toBe('new');
  });

  it('keeps literal dotted-key reads and writes distinct from source old-value traversal', () => {
    const data = [{ 'group.value': 'literal', group: { value: 'nested' } }];
    let changes;

    grid = createGrid({ data, columns: [{ data: 'group.value' }] });
    grid.addHook('afterChange', value => { changes = value; });
    grid.populateFromArray(0, 0, [['new']]);
    expect(data).toEqual([{ 'group.value': 'new', group: { value: 'nested' } }]);
    expect(changes).toEqual([[0, 'group.value', 'nested', 'new']]);
  });

  it('keeps clipboard repetition and read-only cells with nested object columns', () => {
    const data = [{ group: { value: 'a', other: 'b' } }, { group: { value: 'c', other: 'd' } }];

    grid = createGrid({ data, columns: [{ data: 'group.value' }, { data: 'group.other', readOnly: true }] });
    grid.selectCell(0, 0, 1, 1);
    grid.listen();
    grid.getPlugin('copyPaste').paste('new', '');
    expect(data).toEqual([{ group: { value: 'new', other: 'b' } }, { group: { value: 'new', other: 'd' } }]);
  });

  it('uses updated column paths and data after settings replacement', () => {
    grid = createGrid({ data: [{ first: { value: 'a' } }], columns: [{ data: 'first.value' }] });
    grid.populateFromArray(0, 0, [['first']]);
    const data = [{ second: { value: 'b' } }];

    grid.updateSettings({ data, columns: [{ data: 'second.value' }] });
    grid.populateFromArray(0, 0, [['second']]);
    expect(data).toEqual([{ second: { value: 'second' } }]);
  });

  for (const shape of ['array', 'nested']) {
    it(`keeps preparation hook counts with ${shape} columns`, () => {
      const data = shape === 'array' ? [['a', 'b'], ['c', 'd']] :
        [{ group: { value: 'a', other: 'b' } }, { group: { value: 'c', other: 'd' } }];
      const definitions = shape === 'array' ? [{ data: 0 }, { data: 1 }] :
        [{ data: 'group.value' }, { data: 'group.other' }];
      let recording = false;
      let columns = 0;
      const counts = {};
      let snapshot;

      grid = createGrid({ data, colHeaders: false, allowInsertColumn: false,
        columns: shape === 'array' ? (index) => {
          if (recording) columns++;
          return definitions[index];
        } : definitions,
      });
      const original = grid.runHooks;

      grid.runHooks = function(name, ...args) {
        if (recording) counts[name] = (counts[name] || 0) + 1;
        return original.call(this, name, ...args);
      };
      grid.addHook('beforeChange', () => {
        snapshot = { modifyRow: counts.modifyRow, modifyCol: counts.modifyCol, modifyRowData: counts.modifyRowData,
          beforeGetCellMeta: counts.beforeGetCellMeta, afterGetCellMeta: counts.afterGetCellMeta,
          afterSetDataAtCell: counts.afterSetDataAtCell, columns };
        recording = false;
      });
      recording = true;
      grid.populateFromArray(0, 0, [['A', 'B'], ['C', 'D']]);
      expect(snapshot).toEqual({ modifyRow: 18, modifyCol: 32, modifyRowData: 8,
        beforeGetCellMeta: 10, afterGetCellMeta: 10, afterSetDataAtCell: 1, columns: shape === 'array' ? 8 : 0 });
    });
  }
});
