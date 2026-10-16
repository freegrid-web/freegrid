import { ViewportRowsCalculator } from 'walkontable';

// The generic path asks every row for its height; with a uniform height the result must be the same.
const calculate = (viewportHeight, scrollOffset, totalRows, height, onlyFullyVisible, scrollbar, uniform) => {
  let calls = 0;
  const calc = new ViewportRowsCalculator(viewportHeight, scrollOffset, totalRows, () => {
    calls += 1;

    return height;
  }, null, onlyFullyVisible, scrollbar, uniform ? height : null);

  return { calls, result: { startRow: calc.startRow, endRow: calc.endRow, count: calc.count,
    startPosition: calc.startPosition } };
};

describe('ViewportRowsCalculator with a uniform row height', () => {
  it('gives the same rows and positions as the generic path', () => {
    const cases = [];

    [0, 1, 2, 5, 40, 1000].forEach((totalRows) => {
      [23, 25, 7.5].forEach((height) => {
        [0, 1, 22, 23, 24, 100, 230, 22999, 23000, 1e6].forEach((scrollOffset) => {
          [0, 10, 23, 100, 600].forEach((viewportHeight) => {
            [false, true].forEach((onlyFullyVisible) => {
              [0, 17].forEach((scrollbar) => {
                cases.push([viewportHeight, scrollOffset, totalRows, height, onlyFullyVisible, scrollbar]);
              });
            });
          });
        });
      });
    });

    cases.forEach((args) => {
      expect(calculate(...args, true).result, JSON.stringify(args)).toEqual(calculate(...args, false).result);
    });
  });

  it('does not ask every row above the viewport for its height', () => {
    const { calls } = calculate(600, 23 * 900000, 1000000, 23, false, 0, true);

    expect(calls).toBeLessThan(100);
  });
});
