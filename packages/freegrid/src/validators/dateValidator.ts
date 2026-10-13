import { getNormalizedDate } from '../helpers/date';
import { formatDate, parseDate } from '../helpers/dateFormat';
import { getEditorInstance } from '../editors';

/**
 * Date cell validator
 *
 * @private
 * @validator DateValidator
 * @param {*} value - Value of edited cell
 * @param {Function} callback - Callback called with validation result
 */
export default function dateValidator(value, callback) {
  const dateEditor = getEditorInstance('date', this.instance);
  let valueToValidate = value;
  let valid = true;

  if (valueToValidate === null || valueToValidate === void 0) {
    valueToValidate = '';
  }
  const dateFormat = this.dateFormat || dateEditor.defaultDateFormat;
  // is it in the specified format
  let isValidFormat = parseDate(valueToValidate, dateFormat, true) !== null;
  let isValidDate = !Number.isNaN(new Date(valueToValidate).getTime()) || isValidFormat;

  if (this.allowEmpty && valueToValidate === '') {
    isValidDate = true;
    isValidFormat = true;
  }
  if (!isValidDate) {
    valid = false;
  }
  if (!isValidDate && isValidFormat) {
    valid = true;
  }

  if (isValidDate && !isValidFormat) {
    if (this.correctFormat === true) { // if format correction is enabled
      const correctedValue = correctFormat(valueToValidate, this.dateFormat);
      const row = this.instance.runHooks('unmodifyRow', this.row);
      const column = this.instance.runHooks('unmodifyCol', this.col);

      this.instance.setDataAtCell(row, column, correctedValue, 'dateValidator');
      valid = true;
    } else {
      valid = false;
    }
  }

  callback(valid);
}

/**
 * Writes the date in the given string in `dateFormat`.
 *
 * @param {String} value
 * @param {String} dateFormat
 * @returns {String}
 */
export function correctFormat(value, dateFormat) {
  const dateFromDate = getNormalizedDate(value);
  const dateFromFormat = parseDate(value, dateFormat);
  const isAlphanumeric = value.search(/[A-z]/g) > -1;
  const date = !dateFromFormat || isAlphanumeric ? dateFromDate : dateFromFormat;

  return Number.isNaN(date.getTime()) ? 'Invalid date' : formatDate(date, dateFormat || 'YYYY-MM-DDTHH:mm:ssZ');
}
