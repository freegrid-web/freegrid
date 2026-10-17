import { formatDate, parseDate } from './../../helpers/dateFormat';

/**
 * The series of the fill handle, as in a spreadsheet: the values of one dragged column (or row) go on as a series
 * when they are one. `null` when they are not: the fill then repeats them.
 *
 * - Numbers (two or more): the same step (1, 3 → 5, 7). One number repeats.
 * - Dates (ISO, or the cell's `dateFormat`): one date goes on day by day; two or more by their step in days, or in
 *   months when they share the day of the month (Jan 31 → Feb 28: the end of the month).
 * - Month and weekday names (`Jan`, `January`, `Mon`, `Monday`, in their case): the next names, or by their step.
 * - Text that ends with a number (`Item 1`, `Q1`, `Room 007`): the number goes on (by 1, or by the step).
 */

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october',
  'november', 'december'];
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const NAME_LISTS = [MONTHS, MONTHS.map(name => name.slice(0, 3)), DAYS, DAYS.map(name => name.slice(0, 3))];

const NUMBER = /^-?\d+(\.\d+)?$/;
const TEXT_AND_NUMBER = /^(.*?)(\d+)(\D*)$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The common step of the values, or `null` when the steps differ. */
const stepOf = (values: number[]): number | null => {
  const step = values.length > 1 ? values[1] - values[0] : 1;

  return values.every((value, i) => i === 0 || Math.abs(value - values[i - 1] - step) < 1e-9) ? step : null;
};

/** `count` positions after the last value (or before the first one, nearest last, when `backwards`). */
const positions = (length: number, count: number, backwards: boolean): number[] => Array.from({ length: count },
  (_, i) => (backwards ? i - count : length + i));

/** Rounds away the error of adding decimal steps (0.1 + 0.2). */
const round = (value: number): number => Math.round(value * 1e10) / 1e10;

const numbers = (values: unknown[], count: number, backwards: boolean): unknown[] | null => {
  const isNumber = values.every(value => typeof value === 'number' && Number.isFinite(value));
  const isNumeric = !isNumber && values.every(value => typeof value === 'string' && NUMBER.test(value));

  if ((!isNumber && !isNumeric) || values.length < 2) {
    return null;
  }
  const parsed = values.map(Number);
  const step = (parsed[parsed.length - 1] - parsed[0]) / (parsed.length - 1);

  return positions(values.length, count, backwards).map((at) => {
    const value = round(parsed[0] + step * at);

    return isNumber ? value : String(value);
  });
};

const names = (values: unknown[], count: number, backwards: boolean): unknown[] | null => {
  if (!values.every(value => typeof value === 'string')) {
    return null;
  }
  const texts = values as string[];
  const list = NAME_LISTS.find(candidate => texts.every(text => candidate.includes(text.toLowerCase())));
  const indexes = list && texts.map(text => list.indexOf(text.toLowerCase()));
  // Around the year (or the week): December → January is +1.
  const unwrapped = indexes && indexes.map((index, i) => index + list!.length *
    indexes.slice(0, i + 1).filter((value, j) => j > 0 && value < indexes[j - 1]).length);
  const step = unwrapped && stepOf(unwrapped);

  if (!list || step === null || step === void 0) {
    return null;
  }
  const last = texts[texts.length - 1];
  const caseOf = (name: string) => {
    if (last === last.toUpperCase()) {
      return name.toUpperCase();
    }

    return last[0] === last[0].toUpperCase() ? name[0].toUpperCase() + name.slice(1) : name;
  };

  return positions(values.length, count, backwards).map(at => caseOf(
    list[(((unwrapped![0] + step * at) % list.length) + list.length) % list.length]));
};

const textAndNumber = (values: unknown[], count: number, backwards: boolean): unknown[] | null => {
  // A number written as text is a number: one repeats.
  const parts = values.map(value => (typeof value === 'string' && !NUMBER.test(value) ? TEXT_AND_NUMBER.exec(value) :
    null));

  if (parts.some(part => !part) || parts.some(part => part![1] !== parts[0]![1] || part![3] !== parts[0]![3])) {
    return null;
  }
  const step = stepOf(parts.map(part => Number(part![2])));
  const width = parts[0]![2].startsWith('0') ? parts[0]![2].length : 0;

  if (step === null) {
    return null;
  }

  return positions(values.length, count, backwards).map((at) => {
    const value = Number(parts[0]![2]) + step * at;

    return `${parts[0]![1]}${value < 0 ? value : String(value).padStart(width, '0')}${parts[0]![3]}`;
  });
};

/** A date `months` months later, at the end of the month when the day does not exist there. */
const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();

  result.setDate(Math.min(date.getDate(), lastDay));

  return result;
};

const dates = (values: unknown[], count: number, backwards: boolean, dateFormat?: string): unknown[] | null => {
  const format = dateFormat || 'YYYY-MM-DD';

  if (!values.every(value => typeof value === 'string' && (dateFormat || ISO_DATE.test(value)))) {
    return null;
  }
  const parsed = values.map(value => parseDate(value, format, true));

  if (parsed.some(date => !date)) {
    return null;
  }
  const days = parsed.map(date => Math.round(Date.UTC(date!.getFullYear(), date!.getMonth(), date!.getDate()) /
    86400000));
  const months = parsed.map(date => date!.getFullYear() * 12 + date!.getMonth());
  const sameDay = parsed.every(date => date!.getDate() === parsed[0]!.getDate());
  const monthStep = values.length > 1 && sameDay ? stepOf(months) : null;
  const dayStep = stepOf(days);

  if (monthStep) {
    return positions(values.length, count, backwards).map(at => formatDate(addMonths(parsed[0]!, monthStep * at),
      format));
  }
  if (dayStep === null) {
    return null;
  }

  return positions(values.length, count, backwards).map((at) => {
    const date = new Date(parsed[0]!);

    date.setDate(date.getDate() + dayStep * at);

    return formatDate(date, format);
  });
};

/**
 * The next `count` values of a series (or the `count` values before it, in order, when `backwards`), or `null` when
 * the values are no series.
 *
 * @param values The values of one dragged column or row, in order.
 * @param count How many values to make.
 * @param backwards Dragged up or left.
 * @param dateFormat The cells' date format (date cells).
 */
export const extendSeries = (values: unknown[], count: number, backwards = false,
  dateFormat?: string): unknown[] | null => {
  if (!values.length || values.some(value => value === null || value === void 0 || value === '')) {
    return null;
  }

  return dates(values, count, backwards, dateFormat) ?? numbers(values, count, backwards) ??
    names(values, count, backwards) ?? textAndNumber(values, count, backwards);
};
