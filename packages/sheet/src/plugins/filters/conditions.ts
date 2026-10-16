import * as C from './../../i18n/constants';
import { parseDate } from './../../helpers/dateFormat';

/** What a condition knows about the column: its cell type and date format. */
export type ConditionContext = { type?: string; dateFormat?: string };

export type ConditionDefinition = {
  /** The number of arguments the condition takes from the user (the value list's argument is not counted). */
  arity: 0 | 1 | 2;
  /** The phrase of its name in the column menu (built-in conditions). */
  phrase?: string;
  /** Its name in the column menu (custom conditions). */
  title?: string;
  /** The column types the column menu offers it for (custom conditions; every type when not given). */
  types?: string[];
  test(value: unknown, args: unknown[], context: ConditionContext): boolean;
};

/** A custom condition, as `FreeSheet.filters.registerCondition` takes it. */
export type CustomCondition = {
  title?: string;
  arity?: 0 | 1 | 2;
  types?: string[];
  test(value: unknown, args: unknown[], context: ConditionContext): boolean;
};

const DAY = 24 * 60 * 60 * 1000;

const isEmpty = (value: unknown): boolean => value === null || value === void 0 || value === '';

/** The text a cell shows for a value (what the value list lists and text conditions compare). */
export const toText = (value: unknown): string => (isEmpty(value) ? '' : String(value));

const lower = (value: unknown): string => toText(value).toLowerCase();

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
};

/** The day of a date value (midnight, local time), or `null`. */
const toDay = (value: unknown, context: ConditionContext): number | null => {
  if (isEmpty(value)) {
    return null;
  }
  const date = parseDate(value, context.dateFormat) || parseDate(value, void 0);

  return date ? new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() : null;
};

const today = (offset: number): number => {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() + offset * DAY;
};

/**
 * Two values in the same terms: days in a date column, numbers when both are numbers, otherwise text without case.
 * Returns `null` when they cannot be compared.
 */
const comparable = (value: unknown, arg: unknown, context: ConditionContext): [number, number] | [string, string] |
  null => {
  if (context.type === 'date') {
    const [a, b] = [toDay(value, context), toDay(arg, context)];

    return a === null || b === null ? null : [a, b];
  }
  const [a, b] = [toNumber(value), toNumber(arg)];

  if (a !== null && b !== null) {
    return [a, b];
  }

  return isEmpty(value) ? null : [lower(value), lower(arg)];
};

const compare = (value: unknown, arg: unknown, context: ConditionContext,
  check: (difference: number) => boolean): boolean => {
  const pair = comparable(value, arg, context);

  if (!pair) {
    return false;
  }
  const [a, b] = pair;

  return check(typeof a === 'number' ? a - (b as number) : a.localeCompare(b as string));
};

const equal = (value: unknown, args: unknown[], context: ConditionContext): boolean => {
  if (isEmpty(args[0])) {
    return isEmpty(value);
  }

  return compare(value, args[0], context, difference => difference === 0);
};

const between = (value: unknown, args: unknown[], context: ConditionContext): boolean => {
  const low = compare(value, args[0], context, difference => difference >= 0);
  const high = compare(value, args[1], context, difference => difference <= 0);
  // The arguments in any order.
  const lowReversed = compare(value, args[1], context, difference => difference >= 0);
  const highReversed = compare(value, args[0], context, difference => difference <= 0);

  return (low && high) || (lowReversed && highReversed);
};

const onDay = (offset: number) => (value: unknown, _args: unknown[], context: ConditionContext): boolean =>
  toDay(value, context) === today(offset);

/** The conditions, by name. */
export const CONDITIONS: Record<string, ConditionDefinition> = {
  empty: { arity: 0, phrase: C.FILTERS_CONDITIONS_EMPTY, test: isEmpty },
  not_empty: { arity: 0, phrase: C.FILTERS_CONDITIONS_NOT_EMPTY, test: value => !isEmpty(value) },
  eq: { arity: 1, phrase: C.FILTERS_CONDITIONS_EQUAL, test: equal },
  neq: { arity: 1, phrase: C.FILTERS_CONDITIONS_NOT_EQUAL, test: (value, args, context) => !equal(value, args, context) },
  begins_with: { arity: 1, phrase: C.FILTERS_CONDITIONS_BEGINS_WITH, test: (value, args) => lower(value).startsWith(lower(args[0])) },
  ends_with: { arity: 1, phrase: C.FILTERS_CONDITIONS_ENDS_WITH, test: (value, args) => lower(value).endsWith(lower(args[0])) },
  contains: { arity: 1, phrase: C.FILTERS_CONDITIONS_CONTAINS, test: (value, args) => lower(value).includes(lower(args[0])) },
  not_contains: { arity: 1, phrase: C.FILTERS_CONDITIONS_NOT_CONTAIN, test: (value, args) => !lower(value).includes(lower(args[0])) },
  gt: { arity: 1, phrase: C.FILTERS_CONDITIONS_GREATER_THAN, test: (value, args, context) => compare(value, args[0], context, d => d > 0) },
  gte: { arity: 1, phrase: C.FILTERS_CONDITIONS_GREATER_THAN_OR_EQUAL, test: (value, args, context) => compare(value, args[0], context, d => d >= 0) },
  lt: { arity: 1, phrase: C.FILTERS_CONDITIONS_LESS_THAN, test: (value, args, context) => compare(value, args[0], context, d => d < 0) },
  lte: { arity: 1, phrase: C.FILTERS_CONDITIONS_LESS_THAN_OR_EQUAL, test: (value, args, context) => compare(value, args[0], context, d => d <= 0) },
  between: { arity: 2, phrase: C.FILTERS_CONDITIONS_BETWEEN, test: between },
  not_between: { arity: 2, phrase: C.FILTERS_CONDITIONS_NOT_BETWEEN, test: (value, args, context) => !isEmpty(value) && !between(value, args, context) },
  date_before: { arity: 1, phrase: C.FILTERS_CONDITIONS_BEFORE, test: (value, args, context) => compare(value, args[0], { ...context, type: 'date' }, d => d < 0) },
  date_after: { arity: 1, phrase: C.FILTERS_CONDITIONS_AFTER, test: (value, args, context) => compare(value, args[0], { ...context, type: 'date' }, d => d > 0) },
  date_today: { arity: 0, phrase: C.FILTERS_CONDITIONS_TODAY, test: onDay(0) },
  date_tomorrow: { arity: 0, phrase: C.FILTERS_CONDITIONS_TOMORROW, test: onDay(1) },
  date_yesterday: { arity: 0, phrase: C.FILTERS_CONDITIONS_YESTERDAY, test: onDay(-1) },
  // args[0]: the texts of the values to keep (`''` for blank cells).
  by_value: { arity: 0, phrase: C.FILTERS_CONDITIONS_BY_VALUE, test: (value, args) =>
    Array.isArray(args[0]) && args[0].indexOf(toText(value)) !== -1 },
};

/** The names of the conditions added with `registerCondition`, in the order they were added. */
const customNames: string[] = [];

/**
 * Adds a condition (or replaces one, a built-in one too) for every grid: filters can use it by name, and the column
 * menu offers it for the column types it lists.
 *
 * ```js
 * FreeSheet.filters.registerCondition('regex', {
 *   title: 'Matches pattern',
 *   arity: 1,
 *   types: ['text'],
 *   test: (value, [pattern]) => new RegExp(pattern, 'i').test(String(value ?? '')),
 * });
 * ```
 *
 * @param name The condition's name, as `addCondition` takes it.
 * @param condition `test(value, args, { type, dateFormat })` tells whether a cell's value meets it; `arity` is the
 * number of values typed in the menu (0, 1 or 2, default 1); `title` its name in the menu.
 */
export const registerCondition = (name: string, condition: CustomCondition): void => {
  if (typeof name !== 'string' || name === '' || !condition || typeof condition.test !== 'function') {
    throw new Error('registerCondition needs a name and a condition with a test function.');
  }
  const arity = condition.arity === 0 || condition.arity === 2 ? condition.arity : 1;

  CONDITIONS[name] = { arity, title: condition.title || name, types: condition.types, test: condition.test };
  if (customNames.indexOf(name) === -1) {
    customNames.push(name);
  }
};

/** A condition by name (built-in or registered), or `undefined`. */
export const getCondition = (name: string): ConditionDefinition | undefined => CONDITIONS[name];

/** The names of every condition. */
export const getConditionNames = (): string[] => Object.keys(CONDITIONS);

/** The conditions the column menu offers for a column's type. */
export const conditionsForType = (type: string | undefined): string[] => {
  const common = ['empty', 'not_empty', 'eq', 'neq'];
  let names = [...common, 'begins_with', 'ends_with', 'contains', 'not_contains'];

  if (type === 'numeric') {
    names = [...common, 'gt', 'gte', 'lt', 'lte', 'between', 'not_between'];
  } else if (type === 'date') {
    names = [...common, 'date_before', 'date_after', 'between', 'date_today', 'date_tomorrow', 'date_yesterday'];
  }
  // Other cell types (dropdown, autocomplete, …) count as text.
  const kind = type === 'numeric' || type === 'date' ? type : 'text';
  const offered = (name: string) => {
    const { types } = CONDITIONS[name];

    return !types || types.indexOf(kind) !== -1 || (type !== void 0 && types.indexOf(type) !== -1);
  };
  const custom = customNames.filter(offered);

  return [...names.filter(name => customNames.indexOf(name) === -1 || offered(name)),
    ...custom.filter(name => names.indexOf(name) === -1)];
};
