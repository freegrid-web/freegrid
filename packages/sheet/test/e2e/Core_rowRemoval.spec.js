describe('Core row removal membership', () => {
  let container;
  let grid;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (grid) grid.destroy();
    grid = null;
    container.remove();
  });

  for (const amount of [1, 128]) {
    it(`keeps source identity, survivor references and hook order when removing ${amount} rows`, () => {
      const data = Array.from({ length: 256 }, (_, id) => [id]);
      const expected = [...data.slice(0, 32), ...data.slice(32 + amount)];
      grid = new FreeSheet(container, {
        data, height: 200, colWidths: 80, autoColumnSize: false, autoRowSize: false,
      });
      const calls = [];
      grid.addHook('beforeRemoveRow', () => { calls.push('beforeRemoveRow'); });
      grid.addHook('beforeDataFilter', (index, count, physicalRows) => {
        calls.push('beforeDataFilter');
        expect(index).toBe(32);
        expect(count).toBe(amount);
        expect(physicalRows).toEqual(Array.from({ length: amount }, (_, offset) => 32 + offset));
      });
      grid.addHook('afterRemoveRow', () => { calls.push('afterRemoveRow'); });

      grid.alter('remove_row', 32, amount);

      expect(calls).toEqual(['beforeRemoveRow', 'beforeDataFilter', 'afterRemoveRow']);
      expect(grid.getSourceData()).toBe(data);
      expect(data).toEqual(expected);
      data.forEach((row, index) => expect(row).toBe(expected[index]));
    });

    it(`uses beforeDataFilter mutations for a request to remove ${amount} rows`, () => {
      const data = Array.from({ length: 256 }, (_, id) => ({ id }));
      const expected = [data[1], ...data.slice(3)];
      grid = new FreeSheet(container, {
        data, columns: [{ data: 'id' }], height: 200, colWidths: 80,
        autoColumnSize: false, autoRowSize: false,
      });
      let filterCalls = 0;
      grid.addHook('beforeDataFilter', (index, count, physicalRows) => {
        filterCalls += 1;
        physicalRows.length = 128;
        physicalRows.fill(NaN);
        physicalRows[0] = 0;
        physicalRows[1] = 2;
        physicalRows[2] = 2;
      });

      grid.alter('remove_row', 32, amount);

      expect(filterCalls).toBe(1);
      expect(grid.getSourceData()).toBe(data);
      expect(data).toEqual(expected);
      data.forEach((row, index) => expect(row).toBe(expected[index]));
    });

    it(`keeps data when beforeDataFilter cancels a request to remove ${amount} rows`, () => {
      const data = Array.from({ length: 256 }, (_, id) => [id]);
      const expected = [...data];
      grid = new FreeSheet(container, {
        data, height: 200, colWidths: 80, autoColumnSize: false, autoRowSize: false,
      });
      const calls = [];
      grid.addHook('beforeRemoveRow', () => { calls.push('beforeRemoveRow'); });
      grid.addHook('beforeDataFilter', () => {
        calls.push('beforeDataFilter');
        return false;
      });
      grid.addHook('afterRemoveRow', () => { calls.push('afterRemoveRow'); });

      grid.alter('remove_row', 32, amount);

      expect(calls).toEqual(['beforeRemoveRow', 'beforeDataFilter', 'afterRemoveRow']);
      expect(data).toEqual(expected);
      expect(grid.countSourceRows()).toBe(256);
    });
  }
});
