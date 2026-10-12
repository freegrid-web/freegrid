import {
  isNumeric,
  rangeEach,
  rangeEachReverse,
  valueAccordingPercent,
} from 'handsontable/helpers/number';

describe('Number helper', () => {
  //
  // Handsontable.helper.rangeEach
  //
  describe('rangeEach', () => {
    it('should iterate increasingly, when `from` and `to` arguments are passed and `from` number is lower then `to`', () => {
      const spy = jasmine.createSpy();

      rangeEach(-1, 2, spy);

      expect(spy.calls.count()).toBe(4);
      expect(spy.calls.argsFor(0)).toEqual([-1]);
      expect(spy.calls.argsFor(1)).toEqual([0]);
      expect(spy.calls.argsFor(2)).toEqual([1]);
      expect(spy.calls.argsFor(3)).toEqual([2]);
    });

    it('should iterate only once, when `from` and `to` arguments are equal', () => {
      const spy = jasmine.createSpy();

      rangeEach(10, 10, spy);

      expect(spy.calls.count()).toBe(1);
      expect(spy.calls.argsFor(0)).toEqual([10]);
    });

    it('should iterate only once, when `from` and `to` arguments are equal and from value is zero', () => {
      const spy = jasmine.createSpy();

      rangeEach(0, spy);

      expect(spy.calls.count()).toBe(1);
      expect(spy.calls.argsFor(0)).toEqual([0]);
    });

    it('should iterate increasingly from 0, when only `from` argument is passed', () => {
      const spy = jasmine.createSpy();

      rangeEach(4, spy);

      expect(spy.calls.count()).toBe(5);
      expect(spy.calls.argsFor(0)).toEqual([0]);
      expect(spy.calls.argsFor(4)).toEqual([4]);
    });

    it('should not iterate decreasingly, when `from` and `to` arguments are passed and `from` number is higher then `to`', () => {
      const spy = jasmine.createSpy();

      rangeEach(1, -3, spy);

      expect(spy.calls.count()).toBe(0);
    });
  });

  //
  // Handsontable.helper.rangeEachReverse
  //
  describe('rangeEachReverse', () => {
    it('should iterate decreasingly, when `from` and `to` arguments are passed and `from` number is higher then `to`', () => {
      const spy = jasmine.createSpy();

      rangeEachReverse(2, -1, spy);

      expect(spy.calls.count()).toBe(4);
      expect(spy.calls.argsFor(0)).toEqual([2]);
      expect(spy.calls.argsFor(1)).toEqual([1]);
      expect(spy.calls.argsFor(2)).toEqual([0]);
      expect(spy.calls.argsFor(3)).toEqual([-1]);
    });

    it('should iterate only once, when `from` and `to` arguments are equal', () => {
      const spy = jasmine.createSpy();

      rangeEachReverse(10, 10, spy);

      expect(spy.calls.count()).toBe(1);
      expect(spy.calls.argsFor(0)).toEqual([10]);
    });

    it('should iterate only once, when `from` and `to` arguments are equal and from value is zero', () => {
      const spy = jasmine.createSpy();

      rangeEachReverse(0, spy);

      expect(spy.calls.count()).toBe(1);
      expect(spy.calls.argsFor(0)).toEqual([0]);
    });

    it('should iterate decreasingly to 0, when only `from` argument is passed', () => {
      const spy = jasmine.createSpy();

      rangeEachReverse(4, spy);

      expect(spy.calls.count()).toBe(5);
      expect(spy.calls.argsFor(0)).toEqual([4]);
      expect(spy.calls.argsFor(4)).toEqual([0]);
    });

    it('should not iterate increasingly, when `from` and `to` arguments are passed and `from` number is higher then `to`', () => {
      const spy = jasmine.createSpy();

      rangeEachReverse(1, 5, spy);

      expect(spy.calls.count()).toBe(0);
    });
  });

  // JS callers are not bound by types: these pin how the loops coerce a non-number start index.
  describe('rangeEach and rangeEachReverse with a non-number start', () => {
    const visit = (iterate) => {
      const visited = [];

      iterate(index => visited.push(index));

      return visited;
    };

    it('rangeEach coerces the start index arithmetically', () => {
      expect(visit(fn => rangeEach(null, 3, fn))).toEqual([0, 1, 2, 3]);
      expect(visit(fn => rangeEach('2', 5, fn))).toEqual([2, 3, 4, 5]);
    });

    it('rangeEachReverse coerces the start index with `+ 1` (so a string start is concatenated)', () => {
      expect(visit(fn => rangeEachReverse(null, fn))).toEqual([0]);
      expect(visit(fn => rangeEachReverse('2', 18, fn))).toEqual([20, 19, 18]);
    });
  });

  describe('isNumeric', () => {
    it('accepts finite numbers only', () => {
      expect(isNumeric(0)).toBe(true);
      expect(isNumeric(-1.5)).toBe(true);
      expect(isNumeric(1e3)).toBe(true);
      expect(isNumeric(NaN)).toBe(false);
      expect(isNumeric(Infinity)).toBe(false);
      expect(isNumeric(-Infinity)).toBe(false);
    });

    it('accepts decimal, exponent and hex strings, with surrounding whitespace', () => {
      ['7', '12', ' 12 ', '-1.5', '+3', '+ 3', '1e3', '1E-3', '0x1F', '0XFF'].forEach((value) => {
        expect(isNumeric(value), JSON.stringify(value)).toBe(true);
      });
    });

    it('rejects other strings', () => {
      ['', ' ', 'a', '1.', '.5', '12px', '1,5', '0x', '--1', 'Infinity', 'NaN'].forEach((value) => {
        expect(isNumeric(value), JSON.stringify(value)).toBe(false);
      });
    });

    it('accepts Number objects (even NaN ones) but not dates or other objects', () => {
      expect(isNumeric(new Number(5))).toBe(true); // eslint-disable-line no-new-wrappers
      expect(isNumeric(new Number(NaN))).toBe(true); // eslint-disable-line no-new-wrappers
      expect(isNumeric(new Date())).toBe(false);
      expect(isNumeric({})).toBe(false);
      expect(isNumeric([])).toBe(false);
      expect(isNumeric([1])).toBe(false);
      expect(isNumeric(null)).toBe(false);
    });

    it('rejects other types', () => {
      expect(isNumeric(undefined)).toBe(false);
      expect(isNumeric(true)).toBe(false);
      expect(isNumeric(10n)).toBe(false);
      expect(isNumeric(() => 1)).toBe(false);
    });
  });

  describe('valueAccordingPercent', () => {
    it('takes a percent given as a number or a "N%" string', () => {
      expect(valueAccordingPercent(200, 50)).toBe(100);
      expect(valueAccordingPercent(200, '50%')).toBe(100);
      expect(valueAccordingPercent(200, '50')).toBe(100);
    });

    it('truncates the percent and the result to integers', () => {
      expect(valueAccordingPercent(10, '33%')).toBe(3);
      expect(valueAccordingPercent(10, '33.9%')).toBe(3);
      expect(valueAccordingPercent(3, '50%')).toBe(1);
      expect(valueAccordingPercent(-10, '50%')).toBe(-5);
      expect(valueAccordingPercent(-3, '50%')).toBe(-1);
    });
  });
});
