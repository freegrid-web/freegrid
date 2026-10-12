import { stringify } from './mixed';

/**
 * Upper-cases the first character.
 */
export const toUpperCaseFirst = (string: string): string => string[0].toUpperCase() + string.slice(1);

/**
 * Checks if all values are the same string, ignoring case (values are stringified first).
 */
export const equalsIgnoreCase = (...strings: unknown[]): boolean => {
  const unique: string[] = [];
  let length = strings.length;

  while (length) {
    length -= 1;
    const string = stringify(strings[length]).toLowerCase();

    if (unique.indexOf(string) === -1) {
      unique.push(string);
    }
  }

  return unique.length === 1;
};

const s4 = (): string => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);

/**
 * Returns a random 16-character hexadecimal string.
 */
export const randomString = (): string => s4() + s4() + s4() + s4();

/**
 * Checks if the value is a percentage from `0%` to `100%`.
 */
export const isPercentValue = (value: unknown): boolean => /^([0-9][0-9]?%$)|(^100%$)/.test(`${value}`);

/**
 * Replaces `[name]` in `template` with `variables[name]` (`''` when it is undefined). `\[name]` is kept literally,
 * without the backslash.
 */
export const substitute = (template: unknown, variables: Record<string, unknown> = {}): string =>
  `${template}`.replace(/(?:\\)?\[([^[\]]+)]/g, (match: string, name: string) => {
    if (match.charAt(0) === '\\') {
      return match.slice(1);
    }

    return variables[name] === void 0 ? '' : `${variables[name]}`;
  });

const STRIP_TAGS_REGEX = /<\/?\w+\/?>|<\w+[\s|/][^>]*>/gi;

/**
 * Removes HTML tags from a string.
 */
export const stripTags = (string: unknown): string => `${string}`.replace(STRIP_TAGS_REGEX, '');
