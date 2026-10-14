/**
 * Writes numbers for `numericFormat`. A `pattern` uses numbro's syntax (`0,0.00`, `$0,0.00`, `0.0%`, `0.0a`, …) and
 * gives the same text numbro did; the culture's separators and currency come from the browser (`Intl`), so every
 * culture works without language files. Without a pattern, the other options go to `Intl.NumberFormat`.
 */

export interface NumericFormat extends Intl.NumberFormatOptions {
  /** numbro pattern, such as `0,0.00` or `$0,0.00`. */
  pattern?: string;
  /** Locale, such as `en-US` (default) or `de-DE`. */
  culture?: string;
}

interface Pattern {
  prefix: string;
  postfix: string;
  output?: 'currency' | 'percent' | 'byte' | 'time' | 'ordinal';
  base?: 'general' | 'binary' | 'decimal';
  totalLength: number;
  characteristic: number;
  optionalCharacteristic?: boolean;
  average: boolean;
  forceAverage?: 'thousand' | 'million' | 'billion' | 'trillion';
  mantissa?: number;
  optionalMantissa?: boolean;
  thousandSeparated: boolean;
  spaceSeparated: boolean;
  negative: 'sign' | 'parenthesis';
  forceSign: boolean;
}

interface Culture {
  thousands: string;
  decimal: string;
  currencySymbol: string;
  currencyPosition: 'prefix' | 'postfix';
  ordinal: (value: number) => string;
}

// numbro's pattern syntax, read the way numbro reads it.
const parsePattern = (format: string): Pattern => {
  let string = format;
  const prefix = string.match(/^{([^}]*)}/);
  const postfix = (prefix ? string.slice(prefix[0].length) : string).match(/{([^}]*)}$/);

  string = string.slice(prefix ? prefix[0].length : 0, postfix ? -postfix[0].length : undefined);

  const outputs: [string, Pattern['output'], Pattern['base']?][] = [['$', 'currency'], ['%', 'percent'],
    ['bd', 'byte', 'general'], ['b', 'byte', 'binary'], ['d', 'byte', 'decimal'], [':', 'time'], ['o', 'ordinal']];
  const [, output, base] = outputs.find(([marker]) => string.includes(marker)) ?? [];
  const [characteristic, mantissa] = string.split('.');
  const forceAverage = ([['K', 'thousand'], ['M', 'million'], ['B', 'billion'], ['T', 'trillion']] as const)
    .find(([letter]) => string.includes(letter))?.[1];
  const hasDot = string.includes('.');

  return {
    prefix: prefix?.[1] ?? '',
    postfix: postfix?.[1] ?? '',
    output,
    base,
    totalLength: Number(string.match(/[1-9]+[0-9]*/)?.[0] ?? 0),
    characteristic: characteristic.match(/0+/)?.[0].length ?? 0,
    optionalCharacteristic: hasDot ? !characteristic.includes('0') : undefined,
    average: string.includes('a'),
    forceAverage,
    mantissa: mantissa?.match(/0+/)?.[0].length,
    optionalMantissa: /\[\.]/.test(string) ? true : (hasDot ? false : undefined),
    thousandSeparated: string.includes(','),
    spaceSeparated: string.includes(' '),
    negative: /^\+?-/.test(string) || !/^\+?\([^)]*\)$/.test(string) ? 'sign' : 'parenthesis',
    forceSign: string.startsWith('+'),
  };
};

// Region → currency, for the currency symbol of a culture (Intl does not say which currency a country uses).
const EURO = 'AT BE CY DE EE ES FI FR GR HR IE IT LI LT LU LV MC MT NL PT SI SK SM VA'.split(' ');
const CURRENCIES: Record<string, string> = {
  US: 'USD', GB: 'GBP', CH: 'CHF', JP: 'JPY', CN: 'CNY', IN: 'INR', PL: 'PLN', CZ: 'CZK', DK: 'DKK', SE: 'SEK',
  NO: 'NOK', IS: 'ISK', HU: 'HUF', RO: 'RON', BG: 'BGN', RU: 'RUB', UA: 'UAH', BY: 'BYN', TR: 'TRY', BR: 'BRL',
  MX: 'MXN', AR: 'ARS', CL: 'CLP', CO: 'COP', PE: 'PEN', CR: 'CRC', NI: 'NIO', CA: 'CAD', AU: 'AUD', NZ: 'NZD',
  ZA: 'ZAR', KR: 'KRW', IL: 'ILS', IR: 'IRR', PH: 'PHP', ID: 'IDR', TH: 'THB', VN: 'VND', SG: 'SGD', HK: 'HKD',
  TW: 'TWD', MY: 'MYR', SA: 'SAR', AE: 'AED', EG: 'EGP', RS: 'RSD', BA: 'BAM', MK: 'MKD', GE: 'GEL', KZ: 'KZT',
};
const DEFAULT_CULTURE = 'en-US';
const cultures = new Map<string, Culture>();

const resolveCulture = (culture: string | undefined): string => {
  try {
    return culture && Intl.NumberFormat.supportedLocalesOf(culture).length ? culture : DEFAULT_CULTURE;
  } catch {
    return DEFAULT_CULTURE;
  }
};

const englishOrdinal = (value: number): string => {
  const last = value % 10;

  return Math.trunc((value % 100) / 10) === 1 ? 'th' : ['th', 'st', 'nd', 'rd'][last] ?? 'th';
};

const getCulture = (tag: string): Culture => {
  let culture = cultures.get(tag);

  if (!culture) {
    const locale = new Intl.Locale(tag).maximize();
    const region = locale.region ?? 'US';
    const currency = EURO.includes(region) ? 'EUR' : CURRENCIES[region] ?? 'USD';
    const parts = new Intl.NumberFormat(tag).formatToParts(12345.6);
    const currencyParts = new Intl.NumberFormat(tag, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
      .formatToParts(1);
    const part = (type: string, parts_: Intl.NumberFormatPart[] = parts) => parts_.find(item => item.type === type)?.value;
    const types = currencyParts.map(item => item.type);

    culture = {
      thousands: part('group') ?? ',',
      decimal: part('decimal') ?? '.',
      currencySymbol: part('currency', currencyParts) ?? '$',
      currencyPosition: types.indexOf('currency') < types.indexOf('integer') ? 'prefix' : 'postfix',
      ordinal: locale.language === 'en' ? englishOrdinal : () => '.',
    };
    cultures.set(tag, culture);
  }

  return culture;
};

const ABBREVIATIONS = [[1e12, 't', 'trillion'], [1e9, 'b', 'billion'], [1e6, 'm', 'million'], [1e3, 'k', 'thousand']] as const;

// The value in thousands/millions/… and its letter.
const average = (value: number, pattern: Pattern) => {
  const absolute = Math.abs(value);
  const [scale, letter] = ABBREVIATIONS.find(([size, , name]) => (pattern.forceAverage ? pattern.forceAverage === name
    : absolute >= size)) ?? [1, ''];
  const scaled = value / scale;
  const mantissaPrecision = pattern.totalLength
    ? Math.max(pattern.totalLength - scaled.toString().split('.')[0].length, 0)
    : -1;

  return { value: scaled, abbreviation: letter && `${pattern.spaceSeparated ? ' ' : ''}${letter}`, mantissaPrecision };
};

const zeroes = (count: number): string => '0'.repeat(Math.max(count, 0));

// numbro's rounding: half up on the decimal string, also for numbers written with an exponent.
const toFixed = (value: number, precision: number): string => {
  const text = value.toString();

  if (!text.includes('e')) {
    return (Math.round(Number(`${value}e+${precision}`)) / (10 ** precision)).toFixed(precision);
  }
  const [base, exponent] = text.split('e');
  const [characteristic, mantissa = ''] = base.split('.');
  let result: string;

  if (Number(exponent) > 0) {
    result = characteristic + mantissa + zeroes(Number(exponent) - mantissa.length);
  } else {
    const prefix = Number(characteristic) < 0 ? '-0.' : '0.';
    const suffix = (zeroes(-Number(exponent) - 1) + Math.abs(Number(characteristic)) + mantissa).slice(0, precision);

    result = prefix + suffix + zeroes(precision - suffix.length);
  }

  return Number(exponent) > 0 && precision > 0 ? `${result}.${zeroes(precision)}` : result;
};

const setMantissa = (value: number, optional: boolean, precision: number): string => {
  if (precision === -1) {
    return value.toString();
  }
  const result = toFixed(value, precision);
  const [characteristic, mantissa = ''] = result.split('.');

  return /^0+$/.test(mantissa) && optional ? characteristic : result;
};

const setCharacteristic = (output: string, optional: boolean | undefined, precision: number): string => {
  const [characteristic, mantissa] = output.split('.');

  if (/^-?0$/.test(characteristic) && optional) {
    return mantissa ? `${characteristic.replace('0', '')}.${mantissa}` : characteristic.replace('0', '');
  }

  return zeroes(precision - characteristic.length) + output;
};

const replaceDelimiters = (output: string, value: number, pattern: Pattern, culture: Culture, decimal?: string): string => {
  const [integerPart, mantissa] = output.split('.');
  let characteristic = integerPart;

  if (pattern.thousandSeparated) {
    const sign = value < 0 ? '-' : '';
    const digits = sign ? characteristic.slice(1) : characteristic;

    characteristic = sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, culture.thousands);
  }

  return mantissa ? `${characteristic}${decimal ?? culture.decimal}${mantissa}` : characteristic;
};

const insertSign = (output: string, value: number, negative: Pattern['negative']): string => {
  if (value === 0) {
    return output;
  }
  if (Number(output) === 0) {
    return output.replace('-', '');
  }
  if (value > 0) {
    return `+${output}`;
  }

  return negative === 'sign' ? output : `(${output.replace('-', '')})`;
};

const formatPlain = (input: number, pattern: Pattern, culture: Culture, decimal?: string): string => {
  let value = input;

  if (!Number.isFinite(value)) {
    return value.toString();
  }
  const { totalLength } = pattern;
  const isAverage = !!totalLength || !!pattern.forceAverage || pattern.average;
  let mantissaPrecision = totalLength ? -1 : (isAverage && pattern.mantissa === undefined ? 0 : pattern.mantissa ?? -1);
  const optionalMantissa = totalLength ? false : pattern.optionalMantissa ?? mantissaPrecision === -1;
  let abbreviation = '';

  if (isAverage) {
    const data = average(value, pattern);

    value = data.value;
    abbreviation = data.abbreviation;

    if (totalLength) {
      mantissaPrecision = data.mantissaPrecision;
    }
  }
  let output = setMantissa(value, optionalMantissa, mantissaPrecision);

  output = setCharacteristic(output, pattern.optionalCharacteristic, totalLength ? 0 : pattern.characteristic);
  output = replaceDelimiters(output, value, pattern, culture, decimal) + abbreviation;

  return pattern.forceSign || value < 0 ? insertSign(output, value, pattern.negative) : output;
};

const BYTES = {
  general: [1024, ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']],
  binary: [1024, ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']],
  decimal: [1000, ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']],
} as const;

const formatBytes = (input: number, pattern: Pattern, culture: Culture): string => {
  const [scale, suffixes] = BYTES[pattern.base ?? 'binary'];
  let value = input;
  let suffix: string = suffixes[0];

  if (Math.abs(value) >= scale) {
    let power = 1;

    while (power < suffixes.length - 1 && Math.abs(value) >= scale ** (power + 1)) {
      power += 1;
    }
    suffix = suffixes[power];
    value /= scale ** power;
  }

  return formatPlain(value, pattern, culture) + suffix;
};

const formatWithPattern = (value: number, format: string, culture: Culture): string => {
  const pattern = parsePattern(format);
  const space = pattern.spaceSeparated ? ' ' : '';
  let output: string;

  switch (pattern.output) {
    case 'currency': {
      const plain = formatPlain(value, pattern, culture);

      if (culture.currencyPosition === 'prefix') {
        output = value < 0 && pattern.negative === 'sign'
          ? `-${space}${culture.currencySymbol}${plain.slice(1)}`
          : `${culture.currencySymbol}${space}${plain}`;
      } else {
        const isAverage = !!pattern.totalLength || !!pattern.forceAverage || pattern.average;

        output = `${plain}${isAverage ? '' : space}${culture.currencySymbol}`;
      }
      break;
    }
    case 'percent':
      output = `${formatPlain(value * 100, pattern, culture)}${space}%`;
      break;
    case 'byte':
      output = formatBytes(value, pattern, culture);
      break;
    case 'ordinal':
      output = `${formatPlain(value, pattern, culture)}${space}${culture.ordinal(value)}`;
      break;
    case 'time': {
      const hours = Math.floor(value / 3600);
      const minutes = Math.floor((value - (hours * 3600)) / 60);
      const seconds = Math.round(value - (hours * 3600) - (minutes * 60));

      output = `${hours}:${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
      break;
    }
    default:
      output = formatPlain(value, pattern, culture);
  }

  return pattern.prefix + output + pattern.postfix;
};

/**
 * Writes `value` with `numericFormat`: its numbro `pattern` (default `0`, the number as it is) in its `culture`
 * (default `en-US`), or, without a pattern, with the other options through `Intl.NumberFormat`.
 */
export const formatNumber = (value: number, numericFormat: NumericFormat = {}): string => {
  const { pattern, culture, ...intlOptions } = numericFormat;
  const tag = resolveCulture(culture);

  if (pattern === undefined && Object.keys(intlOptions).length) {
    return new Intl.NumberFormat(tag, intlOptions).format(value);
  }

  return formatWithPattern(value, pattern || '0', getCulture(tag));
};
