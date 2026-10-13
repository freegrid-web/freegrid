import { formatDate, parseDate } from '../helpers/dateFormat';

// Formats which are correctly parsed to time
const STRICT_FORMATS = [
  'YYYY-MM-DDTHH:mm:ss.SSSZ',
  'X', // Unix timestamp
  'x' // Unix ms timestamp
];

/**
 * Time cell validator
 *
 * @private
 * @validator TimeValidator
 * @param {*} value - Value of edited cell
 * @param {Function} callback - Callback called with validation result
 */
export default function timeValidator(value, callback) {
  const timeFormat = this.timeFormat || 'h:mm:ss a';
  let valid = true;
  let valueToValidate = value;

  if (valueToValidate === null) {
    valueToValidate = '';
  }

  valueToValidate = /^\d{3,}$/.test(valueToValidate) ? parseInt(valueToValidate, 10) : valueToValidate;

  const twoDigitValue = /^\d{1,2}$/.test(valueToValidate);

  if (twoDigitValue) {
    valueToValidate += ':00';
  }

  // A timestamp or an ISO date is read as a date; anything else as a time in timeFormat.
  const date = parseDate(valueToValidate, STRICT_FORMATS, true)
    ? parseDate(new Date(valueToValidate), timeFormat)
    : parseDate(valueToValidate, timeFormat);
  let isValidTime = date !== null;

  // is it in the specified format
  let isValidFormat = parseDate(valueToValidate, timeFormat, true) !== null && !twoDigitValue;

  if (this.allowEmpty && valueToValidate === '') {
    isValidTime = true;
    isValidFormat = true;
  }
  if (!isValidTime) {
    valid = false;
  }
  if (!isValidTime && isValidFormat) {
    valid = true;
  }
  if (isValidTime && !isValidFormat) {
    if (this.correctFormat === true) { // if format correction is enabled
      const correctedValue = formatDate(date, timeFormat);
      const row = this.instance.runHooks('unmodifyRow', this.row);
      const column = this.instance.runHooks('unmodifyCol', this.col);

      this.instance.setDataAtCell(row, column, correctedValue, 'timeValidator');
      valid = true;
    } else {
      valid = false;
    }
  }

  callback(valid);
}
