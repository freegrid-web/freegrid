import { formatDate, parseDate } from '../helpers/dateFormat';
import type { ValidatorContext } from '../cellTypes/types';

// Values that are read as a date and time rather than as a time.
const STRICT_FORMATS = [
  'YYYY-MM-DDTHH:mm:ss.SSSZ',
  'X', // Unix timestamp
  'x', // Unix ms timestamp
];

/**
 * Valid: a time in `timeFormat` (default `h:mm:ss a`), or an empty value with `allowEmpty`. A time in another form
 * (also a Unix timestamp, an ISO date, or `13` for 13:00) is invalid, unless `correctFormat` rewrites it in
 * `timeFormat`.
 */
export default function timeValidator(this: ValidatorContext, value: unknown, callback: (valid: boolean) => void): void {
  const timeFormat = this.timeFormat || 'h:mm:ss a';
  let valueToValidate: unknown = value === null ? '' : value;

  // 3+ digits: a timestamp. 1–2 digits: an hour.
  if (/^\d{3,}$/.test(valueToValidate as string)) {
    valueToValidate = parseInt(valueToValidate as string, 10);
  }
  const twoDigitValue = /^\d{1,2}$/.test(valueToValidate as string);

  if (twoDigitValue) {
    valueToValidate = `${valueToValidate}:00`;
  }
  if (this.allowEmpty && valueToValidate === '') {
    callback(true);

    return;
  }
  if (parseDate(valueToValidate, timeFormat, true) !== null && !twoDigitValue) {
    callback(true);

    return;
  }
  const date = parseDate(valueToValidate, STRICT_FORMATS, true)
    ? parseDate(new Date(valueToValidate as string | number), timeFormat)
    : parseDate(valueToValidate, timeFormat);

  if (date !== null && this.correctFormat === true) {
    const row = this.instance.runHooks('unmodifyRow', this.row) as number;
    const column = this.instance.runHooks('unmodifyCol', this.col) as number;

    this.instance.setDataAtCell(row, column, formatDate(date, timeFormat), 'timeValidator');
    callback(true);

    return;
  }
  callback(false);
}
