import moment from 'moment';
import { formatDate, parseDate } from '../../../src/helpers/dateFormat';

// moment is the reference: FreeSheet's date module must read and write dates the way FreeSheet did with moment.
const INPUTS = [
  '', ' ', 'foo', 'test non-time string', 'nd', '1', '12', '19', '57', '123', '2015', '1234567890', '1450000000000',
  '01/02/2015', '1/2/2015', '1/2', '01/02/15', '02/30/2015', '13/01/2015', '31/12/2015', '29/02/2016', '29/02/2015',
  '2015-01-02', '2015/1/2', '02.01.2015', '2.1.15', '2016-03-18T14:38:02.123Z', '2016-03-18T14:38:02.123+02:00',
  'Jan 2 2015', 'January 2, 2015', '2 Feb 2015', 'feb 30 2015', 'Sept 3 2015', '3rd March 2015', 'Mon, Jan 5 2015',
  '1:00', '1:00 pm', '1:00 PM', '1:00:00 am', '12:00:00 PM', '12:00 am', '10:00:00 pm', '13:00', '13:00:00', '16:00',
  '16:32:03', '20:20:01', '30:10:25', '11:61', '24:00', '24:00:01', '5:10:15 am', '5:10:15 a.m.', '0:15 am',
  '1:2:3', '010203', '14:38:02.5', '14:38:02.123', '2015-01-02 3:04 pm', '2015-01-02T03:04:05',
];
const FORMATS = [
  'DD/MM/YYYY', 'MM/DD/YYYY', 'D/M/YYYY', 'DD.MM.YYYY', 'YYYY-MM-DD', 'DD/MM/YY', 'MMM D YYYY', 'MMMM D, YYYY',
  'Do MMMM YYYY', 'ddd, MMM D YYYY', 'h:mm:ss a', 'h:mm a', 'h:mm:ss A', 'hh:mm A', 'HH:mm', 'H:mm:ss', 'HH:mm:ss.SSS',
  'k:mm', 'YYYY-MM-DD h:mm a', 'YYYY-MM-DDTHH:mm:ss', 'YYYY-MM-DDTHH:mm:ss.SSSZ', 'X', 'x', 'L', 'LT', 'LTS', 'll',
  '[Day] D [of] MMMM', 'Q YYYY', 'Y',
];
const time = (date: { valueOf(): number } | null) => (date ? date.valueOf() : null);
const reference = (input: unknown, format: string | string[], strict: boolean) => {
  const parsed = moment(input, format, strict);

  return parsed.isValid() ? parsed.valueOf() : null;
};
const mismatches = (strict: boolean) => {
  const result: string[] = [];

  FORMATS.forEach((format) => {
    INPUTS.forEach((input) => {
      const expected = reference(input, format, strict);
      const actual = time(parseDate(input, format, strict));

      if (actual !== expected) {
        result.push(`${JSON.stringify(input)} with ${format}: expected ${expected}, got ${actual}`);
      }
    });
  });

  return result;
};

describe('dateFormat', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 13, 15, 30, 45, 500));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('parseDate', () => {
    it('reads text leniently like moment', () => {
      expect(mismatches(false)).toEqual([]);
    });

    it('reads text strictly like moment', () => {
      expect(mismatches(true)).toEqual([]);
    });

    it('picks the best of several formats like moment', () => {
      const formats = ['YYYY-MM-DDTHH:mm:ss.SSSZ', 'X', 'x'];
      const result: string[] = [];

      [...INPUTS, 1234567890, 1450000000000, 123].forEach((input) => {
        [true, false].forEach((strict) => {
          const expected = reference(input, formats, strict);
          const actual = time(parseDate(input, formats, strict));

          if (actual !== expected) {
            result.push(`${JSON.stringify(input)} strict=${strict}: expected ${expected}, got ${actual}`);
          }
        });
      });

      expect(result).toEqual([]);
    });

    it('reads text without a format like moment (ISO dates, then the browser)', () => {
      ['2015-01-02', '2016-03-18T14:38:02.123Z', '2015-01-02 10:20', 'Jan 2 2015', 'foo', ''].forEach((input) => {
        expect(time(parseDate(input, undefined)), input).toBe(reference(input, undefined as unknown as string, false));
      });
    });

    it('returns null for null, undefined and an empty format list', () => {
      expect(parseDate(null, 'DD/MM/YYYY')).toBeNull();
      expect(parseDate(undefined, 'DD/MM/YYYY')).toBeNull();
      expect(parseDate('01/02/2015', [])).toBeNull();
    });

    it('reads a 12-hour clock with am/pm in any case', () => {
      expect(parseDate('1:00:00 PM', 'h:mm:ss a', true)?.getHours()).toBe(13);
      expect(parseDate('12:00:00 am', 'h:mm:ss A', true)?.getHours()).toBe(0);
      expect(parseDate('13:00:00 pm', 'h:mm:ss a', true)).toBeNull();
    });

    it('rejects days and times that do not exist', () => {
      expect(parseDate('30/02/2015', 'DD/MM/YYYY')).toBeNull();
      expect(parseDate('29/02/2015', 'DD/MM/YYYY')).toBeNull();
      expect(parseDate('29/02/2016', 'DD/MM/YYYY')?.getDate()).toBe(29);
      expect(parseDate('11:61', 'HH:mm')).toBeNull();
    });

    it('fills a missing date with today and a missing time with midnight', () => {
      expect(parseDate('16:32', 'HH:mm', true)).toEqual(new Date(2026, 9, 13, 16, 32));
      expect(parseDate('05/2015', 'MM/YYYY', true)).toEqual(new Date(2015, 4, 1));
    });

    it('reads a time zone offset', () => {
      expect(parseDate('2016-03-18T14:38:02.123+02:00', 'YYYY-MM-DDTHH:mm:ss.SSSZ', true))
        .toEqual(new Date(Date.UTC(2016, 2, 18, 12, 38, 2, 123)));
    });
  });

  describe('formatDate', () => {
    const DATES = [
      new Date(2015, 0, 2, 3, 4, 5, 6),
      new Date(2016, 1, 29, 12, 0, 0, 0),
      new Date(2026, 9, 13, 0, 30, 45, 500),
      new Date(1999, 11, 31, 23, 59, 59, 999),
      new Date(5, 6, 22, 13, 1, 2, 30),
    ];
    const OUTPUTS = [
      'DD/MM/YYYY', 'M/D/YY', 'YYYY-MM-DDTHH:mm:ss.SSSZ', 'YYYY-MM-DDTHH:mm:ssZZ', 'h:mm:ss a', 'hh:mm A', 'H HH k kk',
      'MMM MMMM Do d dd ddd dddd Q', 'S SS SSS', 'X x', 'Y YY YYYY', 'L LL LLL LLLL l ll lll llll LT LTS',
      '[Today is] dddd [the] Do', 'D [D] M [M]',
    ];

    it('writes dates like moment', () => {
      const result: string[] = [];

      DATES.forEach((date) => {
        OUTPUTS.forEach((format) => {
          const expected = moment(date).format(format);
          const actual = formatDate(date, format);

          if (actual !== expected) {
            result.push(`${date.toISOString()} as ${format}: expected ${expected}, got ${actual}`);
          }
        });
      });

      expect(result).toEqual([]);
    });
  });
});
