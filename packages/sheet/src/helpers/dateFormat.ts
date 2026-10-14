/**
 * Reads and writes dates with moment.js format tokens (`DD/MM/YYYY`, `h:mm:ss a`, …), the way FreeSheet did with
 * moment: the same lenient and strict parsing rules, in English.
 *
 * Tokens: `YYYY YY Y Q M MM MMM MMMM D DD Do d dd ddd dddd H HH h hh k kk m mm s ss S SS SSS a A Z ZZ X x`, text in
 * `[brackets]`, and the long formats `LT LTS L LL LLL LLLL l ll lll llll`. Other letters are plain text.
 */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
  'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const short = (name: string): string => name.slice(0, 3);
const min = (name: string): string => name.slice(0, 2);
const LONG_FORMATS: Record<string, string> = {
  LT: 'h:mm A',
  LTS: 'h:mm:ss A',
  L: 'MM/DD/YYYY',
  LL: 'MMMM D, YYYY',
  LLL: 'MMMM D, YYYY h:mm A',
  LLLL: 'dddd, MMMM D, YYYY h:mm A',
  l: 'M/D/YYYY',
  ll: 'MMM D, YYYY',
  lll: 'MMM D, YYYY h:mm A',
  llll: 'ddd, MMM D, YYYY h:mm A',
};
const TOKENS = /\[[^[]*\]|YYYY|YY|Y|Q|MMMM|MMM|MM|M|Do|DD|D|dddd|ddd|dd|d|HH|H|hh|h|kk|k|mm|m|ss|s|SSS|SS|S|a|A|ZZ|Z|X|x|./g;

const expand = (format: string): string => format
  .replace(/\[[^[]*\]|LTS|LT|LL?L?L?|l{1,4}/g, token => LONG_FORMATS[token] ?? token);
const tokenize = (format: string): string[] => expand(format).match(TOKENS) ?? [];
const pad = (value: number, length: number): string => `${value < 0 ? '-' : ''}${String(Math.abs(value)).padStart(length, '0')}`;
const ordinal = (value: number): string => {
  const last = value % 10;
  const suffix = Math.trunc((value % 100) / 10) === 1 ? 'th' : ['th', 'st', 'nd', 'rd'][last] ?? 'th';

  return `${value}${suffix}`;
};
const offset = (date: Date, separator: string): string => {
  const minutes = -date.getTimezoneOffset();
  const absolute = Math.abs(minutes);

  return `${minutes < 0 ? '-' : '+'}${pad(Math.trunc(absolute / 60), 2)}${separator}${pad(absolute % 60, 2)}`;
};

const FORMATTERS: Record<string, (date: Date) => string> = {
  Y: (date) => {
    const year = date.getFullYear();

    return year <= 9999 ? pad(year, 4) : `+${year}`;
  },
  YY: date => pad(date.getFullYear() % 100, 2),
  YYYY: date => pad(date.getFullYear(), 4),
  Q: date => String(Math.ceil((date.getMonth() + 1) / 3)),
  M: date => String(date.getMonth() + 1),
  MM: date => pad(date.getMonth() + 1, 2),
  MMM: date => short(MONTHS[date.getMonth()]),
  MMMM: date => MONTHS[date.getMonth()],
  D: date => String(date.getDate()),
  DD: date => pad(date.getDate(), 2),
  Do: date => ordinal(date.getDate()),
  d: date => String(date.getDay()),
  dd: date => min(WEEKDAYS[date.getDay()]),
  ddd: date => short(WEEKDAYS[date.getDay()]),
  dddd: date => WEEKDAYS[date.getDay()],
  H: date => String(date.getHours()),
  HH: date => pad(date.getHours(), 2),
  h: date => String(date.getHours() % 12 || 12),
  hh: date => pad(date.getHours() % 12 || 12, 2),
  k: date => String(date.getHours() || 24),
  kk: date => pad(date.getHours() || 24, 2),
  m: date => String(date.getMinutes()),
  mm: date => pad(date.getMinutes(), 2),
  s: date => String(date.getSeconds()),
  ss: date => pad(date.getSeconds(), 2),
  S: date => String(Math.trunc(date.getMilliseconds() / 100)),
  SS: date => pad(Math.trunc(date.getMilliseconds() / 10), 2),
  SSS: date => pad(date.getMilliseconds(), 3),
  a: date => (date.getHours() > 11 ? 'pm' : 'am'),
  A: date => (date.getHours() > 11 ? 'PM' : 'AM'),
  Z: date => offset(date, ':'),
  ZZ: date => offset(date, ''),
  X: date => String(Math.floor(date.getTime() / 1000)),
  x: date => String(date.getTime()),
};
const literal = (token: string): string => (token.startsWith('[') && token.endsWith(']') ? token.slice(1, -1) : token);

/**
 * Writes `date` in `format`.
 */
export const formatDate = (date: Date, format: string): string => tokenize(format)
  .map(token => FORMATTERS[token]?.(date) ?? literal(token))
  .join('');

// Parsing follows moment's algorithm: each token's pattern is searched for in the rest of the text (skipping what
// does not match), strict mode uses stricter patterns and allows no skipped text and no unmatched token.

const YEAR = 0;
const MONTH = 1;
const DATE = 2;
const HOUR = 3;
const MINUTE = 4;
const SECOND = 5;
const MILLISECOND = 6;

interface ParseState {
  parts: (number | undefined)[];
  date?: Date;
  meridiem?: string;
  bigHour?: boolean;
  offset?: number;
  weekday?: number;
  invalid: boolean;
  empty: boolean;
  unusedTokens: number;
}

interface TokenParser {
  lenient: RegExp;
  strict?: RegExp;
  set: (state: ParseState, input: string, strict: boolean, token: string) => void;
}

const toInt = (value: string): number => {
  const number = Number(value);

  return number !== 0 && Number.isFinite(number) ? Math.trunc(number) : 0;
};
const twoDigitYear = (input: string): number => toInt(input) + (toInt(input) > 68 ? 1900 : 2000);
const findName = (names: string[], input: string, strictName: ((name: string) => string) | null): number => {
  const text = input.toLowerCase();

  return names.findIndex((name) => {
    const full = name.toLowerCase();

    return strictName ? strictName(full) === text : text.startsWith(full) || text.startsWith(short(full))
      || (names === WEEKDAYS && text.startsWith(min(full)));
  });
};
const setPart = (index: number) => (state: ParseState, input: string) => {
  state.parts[index] = toInt(input);
};
const setMonthName = (state: ParseState, input: string, strict: boolean, token: string) => {
  const month = findName(MONTHS, input, strict ? (token === 'MMM' ? short : name => name) : null);

  if (month < 0) {
    state.invalid = true;
  } else {
    state.parts[MONTH] = month;
  }
};
const setWeekdayName = (state: ParseState, input: string, strict: boolean, token: string) => {
  const strictName = { dd: min, ddd: short, dddd: (name: string) => name }[token] ?? null;
  const weekday = findName(WEEKDAYS, input, strict ? strictName : null);

  if (weekday < 0) {
    state.invalid = true;
  } else {
    state.weekday = weekday;
  }
};
const setTwelveHour = (state: ParseState, input: string) => {
  state.parts[HOUR] = toInt(input);
  state.bigHour = true;
};
// k is 1–24; 24 is midnight.
const setKHour = (state: ParseState, input: string) => {
  const hour = toInt(input);

  state.parts[HOUR] = hour === 24 ? 0 : hour;
};
const setMilliseconds = (state: ParseState, input: string) => {
  state.parts[MILLISECOND] = toInt(String(Number(`0.${input}`) * 1000));
};
const setOffset = (state: ParseState, input: string) => {
  const [sign, hours = '0', minutes = '0'] = input.match(/[+-]|\d\d/g) ?? ['-'];
  const total = (Number(hours) * 60) + toInt(minutes);

  state.offset = total === 0 ? 0 : (sign === '+' ? total : -total);
};

const digits1to2 = /\d\d?/;
const digits2 = /\d\d/;
const noLeadingZero = /^[1-9]\d?/;
const hasZero = /^([1-9]\d|\d)/;
const word = /[0-9]{0,256}['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFF07\uFF10-\uFFEF]{1,256}|[\u0600-\u06FF/]{1,256}(\s*?[\u0600-\u06FF]{1,256}){1,2}/i;
const signed = /[+-]?\d+/;
const zone = /Z|[+-]\d\d(?::?\d\d)?/i;

const PARSERS: Record<string, TokenParser> = {
  Y: { lenient: signed, set: (state, input) => { state.parts[YEAR] = parseInt(input, 10); } },
  YY: { lenient: digits1to2, strict: digits2, set: (state, input) => { state.parts[YEAR] = twoDigitYear(input); } },
  YYYY: {
    lenient: /\d{1,4}/,
    strict: /\d{4}/,
    set: (state, input) => { state.parts[YEAR] = input.length === 2 ? twoDigitYear(input) : toInt(input); },
  },
  Q: { lenient: /\d/, set: (state, input) => { state.parts[MONTH] = (toInt(input) - 1) * 3; } },
  M: { lenient: digits1to2, strict: noLeadingZero, set: (state, input) => { state.parts[MONTH] = toInt(input) - 1; } },
  MM: { lenient: digits1to2, strict: digits2, set: (state, input) => { state.parts[MONTH] = toInt(input) - 1; } },
  MMM: { lenient: word, set: setMonthName },
  MMMM: { lenient: word, set: setMonthName },
  D: { lenient: digits1to2, strict: noLeadingZero, set: setPart(DATE) },
  DD: { lenient: digits1to2, strict: digits2, set: setPart(DATE) },
  Do: {
    lenient: /\d{1,2}(th|st|nd|rd)|\d{1,2}/,
    strict: /\d{1,2}(th|st|nd|rd)/,
    set: (state, input) => { state.parts[DATE] = toInt(input.match(digits1to2)![0]); },
  },
  d: { lenient: digits1to2, set: (state, input) => { state.weekday = toInt(input); } },
  dd: { lenient: word, set: setWeekdayName },
  ddd: { lenient: word, set: setWeekdayName },
  dddd: { lenient: word, set: setWeekdayName },
  H: { lenient: digits1to2, strict: hasZero, set: setPart(HOUR) },
  HH: { lenient: digits1to2, strict: digits2, set: setPart(HOUR) },
  h: { lenient: digits1to2, strict: noLeadingZero, set: setTwelveHour },
  hh: { lenient: digits1to2, strict: digits2, set: setTwelveHour },
  k: { lenient: digits1to2, strict: noLeadingZero, set: setKHour },
  kk: { lenient: digits1to2, strict: digits2, set: setKHour },
  m: { lenient: digits1to2, strict: hasZero, set: setPart(MINUTE) },
  mm: { lenient: digits1to2, strict: digits2, set: setPart(MINUTE) },
  s: { lenient: digits1to2, strict: hasZero, set: setPart(SECOND) },
  ss: { lenient: digits1to2, strict: digits2, set: setPart(SECOND) },
  S: { lenient: /\d{1,3}/, strict: /\d/, set: setMilliseconds },
  SS: { lenient: /\d{1,3}/, strict: digits2, set: setMilliseconds },
  SSS: { lenient: /\d{1,3}/, strict: /\d{3}/, set: setMilliseconds },
  a: { lenient: /[ap]\.?m?\.?/i, set: (state, input) => { state.meridiem = input; } },
  A: { lenient: /[ap]\.?m?\.?/i, set: (state, input) => { state.meridiem = input; } },
  Z: { lenient: zone, set: setOffset },
  ZZ: { lenient: zone, set: setOffset },
  X: { lenient: /[+-]?\d+(\.\d{1,3})?/, set: (state, input) => { state.date = new Date(parseFloat(input) * 1000); } },
  x: { lenient: signed, set: (state, input) => { state.date = new Date(toInt(input)); } },
};

const isLeapYear = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
const daysInMonth = (year: number, month: number): number => {
  const monthOfYear = ((month % 12) + 12) % 12;
  const fullYear = year + ((month - monthOfYear) / 12);

  return monthOfYear === 1 ? (isLeapYear(fullYear) ? 29 : 28) : 31 - ((monthOfYear % 7) % 2);
};
// new Date() and Date.UTC() read the years 0–99 as 1900–1999.
const createDate = (utc: boolean, [year, ...rest]: number[]): Date => {
  const make = (y: number) => (utc ? new Date(Date.UTC(y, ...(rest as [number]))) : new Date(y, ...(rest as [number])));

  if (year < 100 && year >= 0) {
    const date = make(year + 400);

    if (utc) {
      date.setUTCFullYear(year);
    } else {
      date.setFullYear(year);
    }

    return date;
  }

  return make(year);
};
const overflows = ([year, month, date, hour, minute, second, ms]: (number | undefined)[]): boolean => {
  const lt = (value: number | undefined, limit: number) => value !== undefined && value < limit;
  const gt = (value: number | undefined, limit: number) => value !== undefined && value > limit;

  return lt(month, 0) || gt(month, 11)
    || lt(date, 1) || (date !== undefined && date > daysInMonth(year as number, month as number))
    || lt(hour, 0) || gt(hour, 24) || (hour === 24 && (minute !== 0 || second !== 0 || ms !== 0))
    || lt(minute, 0) || gt(minute, 59) || lt(second, 0) || gt(second, 59) || lt(ms, 0) || gt(ms, 999);
};

interface ParseResult {
  date: Date;
  valid: boolean;
  score: number;
}

const parseWithFormat = (text: string, format: string, strict: boolean): ParseResult => {
  const state: ParseState = { parts: [], invalid: false, empty: true, unusedTokens: 0 };
  let rest = text;
  let parsedLength = 0;

  tokenize(format).forEach((token) => {
    const parser = PARSERS[token];
    const pattern = parser
      ? (strict && parser.strict) || parser.lenient
      : new RegExp(literal(token).replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'));
    const input = rest.match(pattern)?.[0];

    if (input) {
      rest = rest.slice(rest.indexOf(input) + input.length);
      parsedLength += input.length;
    }
    if (parser) {
      if (input) {
        state.empty = false;
        parser.set(state, input, strict, token);
      } else {
        state.unusedTokens += 1;
      }
    } else if (strict && !input) {
      state.unusedTokens += 1;
    }
  });

  const { parts } = state;
  const hour = parts[HOUR] as number;

  if (hour <= 12 && hour > 0) {
    state.bigHour = undefined;
  }
  const hasParts = parts.some(part => part !== undefined);

  if (state.meridiem !== undefined) {
    const isPm = state.meridiem.toLowerCase().startsWith('p');

    if (isPm && hour < 12) {
      parts[HOUR] = hour + 12;
    }
    if (!isPm && hour === 12) {
      parts[HOUR] = 0;
    }
  }

  let weekdayMismatch = false;
  let date = state.date;

  if (!date) {
    const utc = state.offset !== undefined;
    const now = new Date();
    const today = utc
      ? [now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()]
      : [now.getFullYear(), now.getMonth(), now.getDate()];

    // Only a weekday: that day of the current week (weeks start on Sunday).
    if (state.weekday !== undefined && parts[DATE] === undefined && parts[MONTH] === undefined) {
      const day = createDate(true, [today[YEAR], today[MONTH], today[DATE] - new Date(Date.UTC(today[YEAR],
        today[MONTH], today[DATE])).getUTCDay() + state.weekday]);

      parts[YEAR] = day.getUTCFullYear();
      parts[MONTH] = day.getUTCMonth();
      parts[DATE] = day.getUTCDate();
      state.invalid ||= state.weekday < 0 || state.weekday > 6;
    }
    const dateIsDefaulted = parts.slice(0, 3).some(part => part === undefined) || parts.length < 3;
    let index = 0;

    for (; index < 3 && parts[index] === undefined; index += 1) {
      parts[index] = today[index];
    }
    for (; index < 7; index += 1) {
      parts[index] ??= index === DATE ? 1 : 0;
    }
    const nextDay = parts[HOUR] === 24 && parts[MINUTE] === 0 && parts[SECOND] === 0 && parts[MILLISECOND] === 0;
    const values = parts.slice(0, 7) as number[];

    if (nextDay) {
      values[HOUR] = 0;
    }
    date = createDate(utc, values);
    const weekday = utc ? date.getUTCDay() : date.getDay();

    if (state.offset !== undefined) {
      date.setUTCMinutes(date.getUTCMinutes() - state.offset);
    }
    if (nextDay) {
      if (utc) {
        date.setUTCDate(date.getUTCDate() + 1);
      } else {
        date.setDate(date.getDate() + 1);
      }
    }
    weekdayMismatch = state.weekday !== undefined && !dateIsDefaulted && state.weekday !== weekday;
  }

  const leftOver = text.length - parsedLength;
  let valid = !Number.isNaN(date.getTime()) && !overflows(parts) && !state.empty && !state.invalid
    && !weekdayMismatch && (state.meridiem === undefined || hasParts);

  if (strict) {
    valid &&= leftOver === 0 && state.unusedTokens === 0 && state.bigHour === undefined;
  }

  return { date, valid, score: leftOver + (state.unusedTokens * 10) };
};

const ISO = /^\s*\d{4}(-\d\d(-\d\d)?)?([T ]\d\d(:\d\d(:\d\d([.,]\d{1,3})?)?)?)?(Z|[+-]\d\d(:?\d\d)?)?\s*$/;

// Without a format, like moment: an ISO 8601 date (local time unless it has an offset), else the browser's parser.
const parseWithoutFormat = (text: string): Date | null => {
  const iso = text.match(ISO);

  if (iso) {
    const [, month, day, time, minutes, seconds, fraction, zone] = iso;
    const format = ['YYYY', month && '-MM', day && '-DD', time && `${time[0]}HH`, minutes && ':mm', seconds && ':ss',
      fraction && `${fraction[0]}${'S'.repeat(fraction.length - 1)}`, zone && 'Z'].filter(Boolean).join('');
    const result = parseWithFormat(text.trim(), format, true);

    return result.valid ? result.date : null;
  }
  const date = new Date(text);

  return text === '' || Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Reads `input` written in `format` (or the best matching of several formats). Lenient by default, like moment:
 * extra text is skipped and missing parts are filled in (today's date, midnight). `strict` requires the input to
 * match the format exactly. Without a format, an ISO 8601 date or what the browser can read. A `Date` is returned as it is (`null` if invalid). Returns `null` for anything that is not
 * a real date or time.
 */
export const parseDate = (
  input: unknown,
  format: string | readonly string[] | undefined,
  strict = false,
): Date | null => {
  if (input === null) {
    return null;
  }
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }
  const text = String(input);
  let best: ParseResult | undefined;

  if (!format) {
    return parseWithoutFormat(text);
  }
  if (typeof format === 'string') {
    best = parseWithFormat(text, format, strict);
  } else {
    let bestIsValid = false;

    format.forEach((oneFormat) => {
      const result = parseWithFormat(text, oneFormat, strict);

      if (bestIsValid ? result.score < best!.score : (!best || result.score < best.score || result.valid)) {
        best = result;
        bestIsValid ||= result.valid;
      }
    });
  }

  return best?.valid ? best.date : null;
};
