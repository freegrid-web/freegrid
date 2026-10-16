import { ViewportRowsCalculator } from 'walkontable';
import RowGeometry from 'walkontable/calculator/rowGeometry';

// The generic path asks every row for its height; with a row geometry the result must be the same.
const calculate = (viewportHeight, scrollOffset, totalRows, height, oversized, onlyFullyVisible, scrollbar, useGeometry) => {
  let calls = 0;
  const heightOf = row => Math.max(height, oversized[row] ?? 0);
  const geometry = useGeometry ? new RowGeometry(height, totalRows, oversized) : null;
  const calc = new ViewportRowsCalculator(viewportHeight, scrollOffset, totalRows, (row) => {
    calls += 1;

    return heightOf(row);
  }, null, onlyFullyVisible, scrollbar, geometry);

  return { calls, result: { startRow: calc.startRow, endRow: calc.endRow, count: calc.count,
    startPosition: calc.startPosition } };
};

const sparse = (entries) => {
  const array = [];

  entries.forEach(([row, value]) => { array[row] = value; });

  return array;
};

describe('ViewportRowsCalculator with a row geometry', () => {
  it('gives the same rows and positions as the generic path', () => {
    const oversizedSets = [[], sparse([[0, 60]]), sparse([[3, 50], [4, 24], [30, 100], [900, 47]]),
      sparse([[1, 10], [2, 80]])];
    let checked = 0;

    [0, 1, 2, 5, 40, 1000].forEach((totalRows) => {
      [23, 25, 7.5].forEach((height) => {
        oversizedSets.forEach((oversized) => {
          [0, 1, 22, 23, 24, 100, 230, 22999, 23000, 1e6].forEach((scrollOffset) => {
            [0, 10, 23, 100, 600].forEach((viewportHeight) => {
              [false, true].forEach((onlyFullyVisible) => {
                [0, 17].forEach((scrollbar) => {
                  const args = [viewportHeight, scrollOffset, totalRows, height, oversized, onlyFullyVisible, scrollbar];

                  expect(calculate(...args, true).result, JSON.stringify(args)).toEqual(calculate(...args, false).result);
                  checked += 1;
                });
              });
            });
          });
        });
      });
    });

    expect(checked).toBe(14400);
  });

  it('does not ask every row above the viewport for its height', () => {
    expect(calculate(600, 23 * 900000, 1000000, 23, [], false, 0, true).calls).toBeLessThan(100);
    expect(calculate(600, 23 * 900000, 1000000, 23, sparse([[5, 80], [500000, 46]]), false, 0, true).calls)
      .toBeLessThan(100);
  });
});

describe('RowGeometry', () => {
  it('adds the extra height of the taller rows above a row', () => {
    const geometry = new RowGeometry(20, 100, sparse([[2, 50], [5, 25], [7, 10]]));

    expect(geometry.positionOf(0)).toBe(0);
    expect(geometry.positionOf(3)).toBe(3 * 20 + 30);
    expect(geometry.positionOf(6)).toBe(6 * 20 + 35);
    expect(geometry.heightOf(2)).toBe(50);
    expect(geometry.heightOf(7)).toBe(20); // not taller than the base height
    expect(geometry.rowAt(89)).toBe(2);
    expect(geometry.rowAt(90)).toBe(3);
  });
});
