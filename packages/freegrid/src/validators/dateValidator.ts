import { getNormalizedDate } from '../helpers/date';
import { formatDate, parseDate } from '../helpers/dateFormat';
import { getEditorInstance } from '../editors';
import type { ValidatorContext } from '../cellTypes/types';

/**
 * Valid: a date in `dateFormat` (default: the date editor's, `DD/MM/YYYY`), or an empty value with `allowEmpty`. A date
 * in another format is invalid, unless `correctFormat` rewrites it in `dateFormat`.
 */
export default function dateValidator(this: ValidatorContext, value: unknown, callback: (valid: boolean) => void): void {
  const dateEditor = getEditorInstance('date', this.instance) as unknown as { defaultDateFormat: string };
  const valueToValidate = value ?? '';
  const dateFormat = this.dateFormat || dateEditor.defaultDateFormat;

  if (this.allowEmpty && valueToValidate === '') {
    callback(true);

    return;
  }
  if (parseDate(valueToValidate, dateFormat, true) !== null) {
    callback(true);

    return;
  }
  // A date, but not in the format.
  const isDate = !Number.isNaN(new Date(valueToValidate as string).getTime());

  if (isDate && this.correctFormat === true) {
    const row = this.instance.runHooks('unmodifyRow', this.row) as number;
    const column = this.instance.runHooks('unmodifyCol', this.col) as number;

    this.instance.setDataAtCell(row, column, correctFormat(valueToValidate as string, this.dateFormat), 'dateValidator');
    callback(true);

    return;
  }
  callback(false);
}

/**
 * The date in `value` written in `dateFormat` (an ISO date without a format): read in `dateFormat` when possible,
 * else as the browser reads dates. `Invalid date` when it is not a date.
 */
export const correctFormat = (value: string, dateFormat?: string): string => {
  const dateFromDate = getNormalizedDate(value);
  const dateFromFormat = parseDate(value, dateFormat);
  const isAlphanumeric = value.search(/[A-z]/g) > -1;
  const date = !dateFromFormat || isAlphanumeric ? dateFromDate : dateFromFormat;

  return Number.isNaN(date.getTime()) ? 'Invalid date' : formatDate(date, dateFormat || 'YYYY-MM-DDTHH:mm:ssZ');
};
