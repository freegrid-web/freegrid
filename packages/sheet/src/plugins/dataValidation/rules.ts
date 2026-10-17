import { parseDate } from './../../helpers/dateFormat';

/** How a value compares (the `value` and, for between, `value2` of a rule). */
export type ValidationOperator = 'between' | 'notBetween' | 'equal' | 'notEqual' | 'greater' | 'less' |
  'greaterOrEqual' | 'lessOrEqual';

/**
 * A cell's data validation, as a spreadsheet's: a list of allowed items, or a number, whole number, date or text
 * length that compares with `value` (and `value2`).
 */
export type Validation = {
  type: 'list' | 'number' | 'integer' | 'date' | 'textLength';
  /** The items of a list: an array, or a range of this sheet (`'A1:A5'`). */
  source?: unknown[] | string;
  operator?: ValidationOperator;
  value?: number | string;
  value2?: number | string;
  /** Whether an empty cell is valid (default: yes). */
  allowBlank?: boolean;
  /** Whether a value that is not valid is refused (default) or kept and marked. */
  strict?: boolean;
  /** Shown when a value is refused or marked. */
  message?: string;
  /** Shown under the cell while it is selected. */
  inputMessage?: string;
};

export const OPERATORS: ValidationOperator[] = ['between', 'notBetween', 'equal', 'notEqual', 'greater', 'less',
  'greaterOrEqual', 'lessOrEqual'];

/** Whether a number meets the operator. */
export const compare = (number: number, operator: ValidationOperator, a: number, b: number): boolean => {
  switch (operator) {
    case 'between': return number >= Math.min(a, b) && number <= Math.max(a, b);
    case 'notBetween': return number < Math.min(a, b) || number > Math.max(a, b);
    case 'equal': return number === a;
    case 'notEqual': return number !== a;
    case 'greater': return number > a;
    case 'less': return number < a;
    case 'greaterOrEqual': return number >= a;
    case 'lessOrEqual': return number <= a;
    default: return true;
  }
};

/** A date's day as a number (for comparing dates), or NaN. */
const dayOf = (value: unknown, format?: string): number => {
  const date = parseDate(value, format ? [format, 'YYYY-MM-DD'] : 'YYYY-MM-DD');

  return date ? Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) : NaN;
};

/**
 * Whether a value meets a rule. `items` are the list's items (a range already read), `dateFormat` the cell's format of
 * dates.
 */
export const isValid = (rule: Validation, value: unknown, items: unknown[] = [], dateFormat?: string): boolean => {
  if (value === null || value === void 0 || value === '') {
    return rule.allowBlank !== false;
  }
  const operator = rule.operator || 'between';

  switch (rule.type) {
    case 'list': {
      const text = String(value).trim();

      return items.some(item => item !== null && item !== void 0 && String(item).trim() === text);
    }
    case 'number':
    case 'integer': {
      const number = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));

      if (!Number.isFinite(number) || (rule.type === 'integer' && !Number.isInteger(number))) {
        return false;
      }

      return compare(number, operator, Number(rule.value), Number(rule.value2 ?? rule.value));
    }
    case 'date': {
      const day = dayOf(value, dateFormat);

      return !Number.isNaN(day) && compare(day, operator, dayOf(rule.value), dayOf(rule.value2 ?? rule.value));
    }
    case 'textLength':
      return compare(String(value).length, operator, Number(rule.value), Number(rule.value2 ?? rule.value));
    default:
      return true;
  }
};

/** A list's items written in a field: one per line, or separated by commas. */
export const parseItems = (text: string): string[] => text.split(/\r?\n|,/).map(item => item.trim())
  .filter(Boolean);
