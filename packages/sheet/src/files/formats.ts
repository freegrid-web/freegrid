/**
 * Number and date formats between FreeSheet (number patterns as `numericFormat.pattern`: `0,0.00`, `0.0%`,
 * `$0,0.00`; date and time formats with moment's tokens: `YYYY-MM-DD`, `HH:mm`) and Excel's format codes, and Excel's
 * date serial numbers.
 */

/** Excel's built-in number formats, by id. */
export const BUILT_IN_FORMATS: Record<number, string> = {
  0: 'General', 1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 9: '0%', 10: '0.00%', 11: '0.00E+00',
  12: '# ?/?', 13: '# ??/??', 14: 'mm-dd-yy', 15: 'd-mmm-yy', 16: 'd-mmm', 17: 'mmm-yy', 18: 'h:mm AM/PM',
  19: 'h:mm:ss AM/PM', 20: 'h:mm', 21: 'h:mm:ss', 22: 'm/d/yy h:mm', 37: '#,##0 ;(#,##0)',
  38: '#,##0 ;[Red](#,##0)', 39: '#,##0.00;(#,##0.00)', 40: '#,##0.00;[Red](#,##0.00)', 45: 'mm:ss',
  46: '[h]:mm:ss', 47: 'mmss.0', 48: '##0.0E+0', 49: '@',
};

/** Excel's code for a FreeSheet number pattern. */
export const numberPatternToExcel = (pattern: string): string => {
  let code = String(pattern).trim();
  const currency = code.indexOf('$') !== -1;

  code = code.replace(/\$\s?/g, '').trim();
  code = code.replace(/\[\.\](0+)/, (_, zeros: string) => `.${'#'.repeat(zeros.length)}`);
  code = code.replace(/^0,0/, '#,##0');

  return currency ? (pattern.trim().charAt(0) === '$' ? `"$"${code}` : `${code} "$"`) : code || 'General';
};

/** A FreeSheet number pattern for an Excel number code (the first section), or `null` when it is not a number. */
export const excelToNumberPattern = (code: string): string | null => {
  const section = String(code).split(';')[0]
    .replace(/\[(Red|Green|Blue|Black|White|Color\s*\d+)\]/gi, '')
    .replace(/_\(|_\)|\*\s|\\/g, '')
    .trim();

  if (!section || /^general$/i.test(section) || section === '@' || /[ymdhs]/i.test(section.replace(/"[^"]*"/g, ''))) {
    return null;
  }
  const currency = /"[^"]*[$€£¥][^"]*"|\[\$[^\]]*\]|[$€£¥]/.test(section);
  const body = section.replace(/"[^"]*"|\[\$[^\]]*\]|[$€£¥]/g, '').trim();
  const match = /([#0,]*0)(\.0+|\.#+)?(%)?/.exec(body);

  if (!match) {
    return null;
  }
  const grouped = match[1].indexOf(',') !== -1;
  const decimals = match[2] ? (match[2].indexOf('#') !== -1 ? `[.]${'0'.repeat(match[2].length - 1)}` :
    match[2]) : '';
  const pattern = `${grouped ? '0,0' : '0'}${decimals}${match[3] || ''}`;

  if (!currency) {
    return pattern;
  }

  return section.search(/"[^"]*[$€£¥]|\[\$|[$€£¥]/) < section.search(/[#0]/) ? `$${pattern}` : `${pattern} $`;
};

const DATE_TOKENS: [RegExp, string][] = [
  [/YYYY/g, 'yyyy'], [/YY/g, 'yy'], [/MMMM/g, 'mmmm'], [/MMM/g, 'mmm'], [/MM/g, 'mm'], [/M/g, 'm'],
  [/dddd/g, 'dddd'], [/ddd/g, 'ddd'], [/DD/g, 'dd'], [/D/g, 'd'],
];

/** Excel's code for a FreeSheet date or time format (moment's tokens). */
export const dateFormatToExcel = (format: string): string => {
  const twelveHours = /[aA]/.test(format);
  // Hours, minutes and seconds first (Excel's `mm` is minutes only next to hours or seconds).
  let code = String(format).replace(/\[([^\]]*)\]/g, '"$1"')
    .replace(/HH|hh/g, '\u0001').replace(/H|h/g, '\u0002')
    .replace(/mm/g, '\u0003').replace(/ss/g, '\u0004')
    .replace(/\bA\b|\ba\b/g, '\u0005');

  DATE_TOKENS.forEach(([token, replacement]) => {
    code = code.replace(token, replacement);
  });

  // The placeholders back (split and join: the placeholders are control characters).
  return [['\u0001', 'hh'], ['\u0002', 'h'], ['\u0003', 'mm'], ['\u0004', 'ss'], ['\u0005', twelveHours ? 'AM/PM' : '']]
    .reduce((text, [placeholder, token]) => text.split(placeholder).join(token), code);
};

/** Whether an Excel code is a date or a time (it has y, d, h or s outside quotes, or m with them). */
export const isDateCode = (code: string): boolean => {
  const plain = String(code).split(';')[0].replace(/"[^"]*"|\[[^\]]*\]|\\./g, '');

  return /[ydhs]/i.test(plain) || /^m+$|m+[/\-. ]|[/\-. ]m+/i.test(plain);
};

/** A FreeSheet date format (moment's tokens) for an Excel date code; time codes give a time format. */
export const excelToDateFormat = (code: string): { kind: 'date' | 'time' | 'datetime'; format: string } => {
  const section = String(code).split(';')[0].replace(/\[[^\]]*\]/g, '').replace(/\\(.)/g, '$1');
  const twelveHours = /AM\/PM|A\/P/i.test(section);
  let format = '';
  const tokens = section.match(/"[^"]*"|y+|m+|d+|h+|s+|AM\/PM|A\/P|./gi) || [];

  tokens.forEach((token, index) => {
    const lower = token.toLowerCase();

    if (token.charAt(0) === '"') {
      format += `[${token.slice(1, -1)}]`;
    } else if (lower.charAt(0) === 'y') {
      format += lower.length <= 2 ? 'YY' : 'YYYY';
    } else if (lower.charAt(0) === 'd') {
      format += ['D', 'DD', 'ddd', 'dddd'][Math.min(lower.length, 4) - 1];
    } else if (lower.charAt(0) === 'h') {
      format += twelveHours ? (lower.length > 1 ? 'hh' : 'h') : (lower.length > 1 ? 'HH' : 'H');
    } else if (lower.charAt(0) === 's') {
      format += 'ss';
    } else if (lower.charAt(0) === 'm' && lower !== 'am/pm') {
      // Minutes right after hours or before seconds.
      const before = tokens.slice(0, index).reverse().find(item => /^[a-z]/i.test(item))?.toLowerCase() || '';
      const after = tokens.slice(index + 1).find(item => /^[a-z]/i.test(item))?.toLowerCase() || '';
      const minutes = before.charAt(0) === 'h' || after.charAt(0) === 's';

      format += minutes ? 'mm' : ['M', 'MM', 'MMM', 'MMMM'][Math.min(lower.length, 4) - 1];
    } else if (/am\/pm|a\/p/i.test(token)) {
      format += 'A';
    } else {
      format += token;
    }
  });
  const hasDate = /[YMD]/.test(format.replace(/\[[^\]]*\]/g, ''));
  const hasTime = /[Hhms]/.test(format.replace(/\[[^\]]*\]/g, ''));

  return { kind: hasDate && hasTime ? 'datetime' : hasDate ? 'date' : 'time', format: format.trim() };
};

const EPOCH = Date.UTC(1899, 11, 30);
const DAY = 24 * 60 * 60 * 1000;

/** A date's Excel serial number (its local date and time). */
export const dateToSerial = (date: Date): number => (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(),
  date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds()) - EPOCH) / DAY;

/** The local date and time of an Excel serial number. */
export const serialToDate = (serial: number): Date => {
  const utc = new Date(EPOCH + Math.round(serial * DAY));

  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate(), utc.getUTCHours(), utc.getUTCMinutes(),
    utc.getUTCSeconds());
};
