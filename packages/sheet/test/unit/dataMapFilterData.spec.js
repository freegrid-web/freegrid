import DataMap from '../../src/dataMap';

describe('DataMap.filterData', () => {
  // Extra NaN entries exercise long deletion lists without removing additional numeric row indexes.
  for (const padding of [0, 1024]) {
    describe(`with ${padding ? 'a large' : 'a small'} deletion list`, () => {
      let dataSource;
      let physicalRows;
      let context;

      beforeEach(() => {
        dataSource = Array.from({ length: 2048 }, (_, id) => ({ id }));
        physicalRows = [1, 3, ...new Array(padding).fill(NaN)];
        context = {
          dataSource,
          visualRowsToPhysical: vi.fn(() => physicalRows),
          instance: { runHooks: vi.fn() },
        };
      });

      const filter = context => DataMap.prototype.filterData.call(context, 7, 2);

      it('keeps survivor order and row identities without changing the source or deletion list', () => {
        const sourceBefore = [...dataSource];
        const indexesBefore = [...physicalRows];
        const expected = [dataSource[0], dataSource[2], ...dataSource.slice(4)];
        const result = filter(context);

        expect(result).toEqual(expected);
        result.forEach((row, index) => expect(row).toBe(expected[index]));
        expect(result).not.toBe(dataSource);
        expect(dataSource).toEqual(sourceBefore);
        expect(physicalRows).toEqual(indexesBefore);
        expect(context.visualRowsToPhysical).toHaveBeenCalledExactlyOnceWith(7, 2);
        expect(context.instance.runHooks).toHaveBeenCalledExactlyOnceWith('beforeDataFilter', 7, 2, physicalRows);
      });

      it('uses mutations made by beforeDataFilter and calls the hook after translating rows', () => {
        const calls = [];
        context.visualRowsToPhysical.mockImplementation(() => {
          calls.push('translate');
          return physicalRows;
        });
        context.instance.runHooks.mockImplementation((name, index, amount, indexes) => {
          calls.push(name);
          expect(index).toBe(7);
          expect(amount).toBe(2);
          expect(indexes).toBe(physicalRows);
          indexes[0] = 0;
          indexes.push(2047);
        });
        const result = filter(context);

        expect(calls).toEqual(['translate', 'beforeDataFilter']);
        expect(context.instance.runHooks).toHaveBeenCalledTimes(1);
        expect(result).toEqual([dataSource[1], dataSource[2], ...dataSource.slice(4, 2047)]);
      });

      it('allows the hook to clear the deletion list', () => {
        context.instance.runHooks.mockImplementation(() => { physicalRows.length = 0; });

        expect(filter(context)).toEqual(dataSource);
      });

      it('cancels on false without reading the source or deletion entries', () => {
        Object.defineProperty(context, 'dataSource', { get() { throw new Error('Source was read'); } });
        Object.defineProperty(physicalRows, 0, { get() { throw new Error('Deletion entry was read'); } });
        context.instance.runHooks.mockReturnValue(false);

        expect(filter(context)).toBeUndefined();
        expect(context.instance.runHooks).toHaveBeenCalledTimes(1);
      });

      for (const value of [undefined, null, 0, '']) {
        it(`continues when the hook returns ${String(value)}`, () => {
          context.instance.runHooks.mockReturnValue(value);

          expect(filter(context)).toEqual([dataSource[0], dataSource[2], ...dataSource.slice(4)]);
        });
      }

      it('ignores duplicate, missing, NaN, string and out-of-range deletion indexes', () => {
        physicalRows.splice(0, physicalRows.length, 1, 1, NaN, undefined, '3', -1, 2048,
          ...new Array(padding).fill(NaN));
        delete physicalRows[2];

        expect(filter(context)).toEqual([dataSource[0], ...dataSource.slice(2)]);
      });

      it('skips source holes but keeps explicit undefined values and object references', () => {
        const source = new Array(2048);
        source[0] = { id: 0 };
        source[7] = undefined;
        source[100] = { id: 100 };
        context.dataSource = source;
        physicalRows[0] = 100;
        const result = filter(context);

        expect(result).toEqual([source[0], undefined]);
        expect(result[0]).toBe(source[0]);
        expect(Object.hasOwn(result, 1)).toBe(true);
        expect(Object.hasOwn(source, 1)).toBe(false);
        expect(source.length).toBe(2048);
      });
    });
  }

  for (const amount of [31, 32, 33]) {
    it(`keeps boundary rows when removing ${amount} consecutive indexes`, () => {
      const dataSource = Array.from({ length: 256 }, (_, id) => ({ id }));
      const physicalRows = Array.from({ length: amount }, (_, offset) => 32 + offset);
      const context = {
        dataSource,
        visualRowsToPhysical: () => physicalRows,
        instance: { runHooks() {} },
      };

      expect(DataMap.prototype.filterData.call(context, 32, amount)).toEqual([
        ...dataSource.slice(0, 32), ...dataSource.slice(32 + amount),
      ]);
    });
  }

  it('translates visual row indexes once per row before running the filter hook', () => {
    const dataSource = Array.from({ length: 8 }, (_, id) => ({ id }));
    const permutation = [4, 6, 1, 0, 2, 3, 7, 5];
    const calls = [];
    const context = {
      dataSource,
      visualRowsToPhysical: DataMap.prototype.visualRowsToPhysical,
      instance: {
        countSourceRows: () => dataSource.length,
        runHooks(name, index, amount, physicalRows) {
          calls.push([name, index]);
          if (name === 'modifyRow') return permutation[index];
          expect(amount).toBe(3);
          expect(physicalRows).toEqual([6, 1, 0]);
        },
      },
    };

    expect(DataMap.prototype.filterData.call(context, 1, 3)).toEqual([
      dataSource[2], dataSource[3], dataSource[4], dataSource[5], dataSource[7],
    ]);
    expect(calls).toEqual([['modifyRow', 1], ['modifyRow', 2], ['modifyRow', 3], ['beforeDataFilter', 1]]);
  });
});
