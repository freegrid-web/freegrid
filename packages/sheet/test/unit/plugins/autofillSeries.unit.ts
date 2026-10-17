import { extendSeries } from '../../../src/plugins/autofill/series';

describe('autofill series', () => {
  it('goes on with numbers by their step; one number repeats', () => {
    expect(extendSeries([1, 3], 3)).toEqual([5, 7, 9]);
    expect(extendSeries([10, 8, 6], 2)).toEqual([4, 2]);
    expect(extendSeries([0.1, 0.2], 2)).toEqual([0.3, 0.4]);
    expect(extendSeries(['1', '2'], 2)).toEqual(['3', '4']);
    expect(extendSeries([5], 3)).toBeNull();
    expect(extendSeries(['5'], 3)).toBeNull();
    // Backwards: the values before the first one, in order.
    expect(extendSeries([5, 6], 3, true)).toEqual([2, 3, 4]);
  });

  it('goes on with text that ends with a number', () => {
    expect(extendSeries(['Item 1'], 3)).toEqual(['Item 2', 'Item 3', 'Item 4']);
    expect(extendSeries(['Q1', 'Q3'], 2)).toEqual(['Q5', 'Q7']);
    expect(extendSeries(['Room 007'], 2)).toEqual(['Room 008', 'Room 009']);
    expect(extendSeries(['Week 2 (draft)'], 1)).toEqual(['Week 3 (draft)']);
    expect(extendSeries(['Item 1', 'Thing 2'], 2)).toBeNull();
    expect(extendSeries(['Item 2'], 2, true)).toEqual(['Item 0', 'Item 1']);
  });

  it('goes on with month and weekday names, in their case, around the year', () => {
    expect(extendSeries(['Jan'], 3)).toEqual(['Feb', 'Mar', 'Apr']);
    expect(extendSeries(['November'], 3)).toEqual(['December', 'January', 'February']);
    expect(extendSeries(['MON', 'WED'], 3)).toEqual(['FRI', 'SUN', 'TUE']);
    expect(extendSeries(['friday'], 2)).toEqual(['saturday', 'sunday']);
    expect(extendSeries(['Dec', 'Jan'], 2)).toEqual(['Feb', 'Mar']);
    expect(extendSeries(['Monday'], 1, true)).toEqual(['Sunday']);
  });

  it('goes on with dates by days, or by months when they share the day', () => {
    expect(extendSeries(['2026-01-30'], 3)).toEqual(['2026-01-31', '2026-02-01', '2026-02-02']);
    expect(extendSeries(['2026-01-01', '2026-01-08'], 2)).toEqual(['2026-01-15', '2026-01-22']);
    expect(extendSeries(['2026-01-31', '2026-02-28'], 2)).toEqual(['2026-03-28', '2026-04-25']);
    expect(extendSeries(['2026-01-15', '2026-02-15'], 2)).toEqual(['2026-03-15', '2026-04-15']);
    expect(extendSeries(['2025-12-31', '2026-01-31'], 2)).toEqual(['2026-02-28', '2026-03-31']);
    expect(extendSeries(['15/03/2026'], 2, false, 'DD/MM/YYYY')).toEqual(['16/03/2026', '17/03/2026']);
    expect(extendSeries(['2026-01-01'], 1, true)).toEqual(['2025-12-31']);
  });

  it('is no series for other values or empty cells', () => {
    expect(extendSeries(['apple', 'pear'], 2)).toBeNull();
    expect(extendSeries([1, null], 2)).toBeNull();
    expect(extendSeries([true, false], 2)).toBeNull();
  });
});
