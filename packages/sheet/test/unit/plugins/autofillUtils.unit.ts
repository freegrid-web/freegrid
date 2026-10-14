import { getDeltas, getDragDirectionAndRange, getMappedFillHandleSetting } from '../../../src/plugins/autofill/utils';
import { CellCoords } from '../../../src/3rdparty/walkontable/src';

const coords = (cell: { row: number; col: number } | undefined) => (cell ? [cell.row, cell.col] : cell);

describe('autofill utils', () => {
  it('getDeltas gives the step of each column (down, up) or row (right, left) of numbers', () => {
    const data = [['1', '10'], ['3', '20'], ['5', 'x']];

    expect(getDeltas(new CellCoords(0, 0), new CellCoords(2, 1), data, 'down')).toEqual([[2, 0]]);
    expect(getDeltas(new CellCoords(0, 0), new CellCoords(2, 1), data, 'up')).toEqual([[-2, 0]]);
    expect(getDeltas(new CellCoords(0, 0), new CellCoords(1, 1), [['1', '4'], ['2', 'a']], 'right'))
      .toEqual([[3], [0]]);
    expect(getDeltas(new CellCoords(0, 0), new CellCoords(0, 2), [['1', '4', '7']], 'left')).toEqual([[-3]]);
    expect(getDeltas(new CellCoords(0, 0), new CellCoords(0, 0), [['1']], 'down')).toEqual([[0]]);
  });

  it('getDragDirectionAndRange gives the direction and the cells the selection was dragged over', () => {
    const direction = (start: number[], end: number[]) => {
      const { directionOfDrag, startOfDragCoords, endOfDragCoords } = getDragDirectionAndRange(start, end);

      return [directionOfDrag, coords(startOfDragCoords), coords(endOfDragCoords)];
    };

    expect(direction([1, 1, 2, 2], [1, 0, 2, 2])).toEqual(['left', [1, 0], [2, 0]]);
    expect(direction([1, 1, 2, 2], [1, 1, 2, 4])).toEqual(['right', [1, 3], [2, 4]]);
    expect(direction([1, 1, 2, 2], [0, 1, 2, 2])).toEqual(['up', [0, 1], [0, 2]]);
    expect(direction([1, 1, 2, 2], [1, 1, 5, 2])).toEqual(['down', [3, 1], [5, 2]]);
    expect(direction([1, 1, 2, 2], [1, 1, 2, 2])).toEqual([undefined, undefined, undefined]);
  });

  it('getMappedFillHandleSetting reads the fillHandle setting', () => {
    expect(getMappedFillHandleSetting(true)).toEqual({ directions: ['horizontal', 'vertical'], autoInsertRow: true });
    expect(getMappedFillHandleSetting(false)).toEqual({ directions: [], autoInsertRow: false });
    expect(getMappedFillHandleSetting(undefined)).toEqual({ directions: [], autoInsertRow: false });
    expect(getMappedFillHandleSetting('vertical')).toEqual({ directions: ['vertical'], autoInsertRow: true });
    expect(getMappedFillHandleSetting({})).toEqual({ directions: ['horizontal', 'vertical'], autoInsertRow: false });
    expect(getMappedFillHandleSetting({ direction: 'vertical', autoInsertRow: true }))
      .toEqual({ directions: ['vertical'], autoInsertRow: true });
    expect(getMappedFillHandleSetting({ direction: 'horizontal', autoInsertRow: true }))
      .toEqual({ directions: ['horizontal'], autoInsertRow: false });
  });
});
