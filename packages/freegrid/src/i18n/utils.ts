import { isUndefined, isDefined } from './../helpers/mixed';
import { objectEach } from './../helpers/object';
import { error } from './../helpers/console';
import { toSingleLine } from './../helpers/templateLiteralTag';
import { DEFAULT_LANGUAGE_CODE, hasLanguageDictionary } from './dictionariesManager';

/**
 * Copies to `target` the properties of `extension` that `target` does not have (a shallow extend that keeps what
 * `target` already has).
 */
export const extendNotExistingKeys = <T extends Record<string, unknown>>(target: T, extension: object): T => {
  objectEach(extension, (value, key) => {
    if (isUndefined(target[key as string])) {
      (target as Record<string, unknown>)[key as string] = value;
    }
  });

  return target;
};

/**
 * A range of headers, smallest first: `(2, 7)` and `(7, 2)` give `2-7`; `(0, 4, 'A', 'D')` and `(4, 0, 'D', 'A')`
 * give `A-D`.
 */
export const createCellHeadersRange = (firstRowIndex: number, nextRowIndex: number, fromValue: unknown = firstRowIndex,
  toValue: unknown = nextRowIndex): string => (firstRowIndex > nextRowIndex
  ? `${toValue}-${fromValue}`
  : `${fromValue}-${toValue}`);

/** A language code in its usual case: `eN-us` → `en-US`. Other text is returned as it is. */
export const normalizeLanguageCode = (languageCode: string): string => {
  const parts = /^([a-zA-Z]{2})-([a-zA-Z]{2})$/.exec(languageCode);

  return parts ? `${parts[1].toLowerCase()}-${parts[2].toUpperCase()}` : languageCode;
};

/** Logs an error that the language is not registered (nothing for an undefined code). */
export const warnUserAboutLanguageRegistration = (languageCode: string | undefined): void => {
  if (isDefined(languageCode)) {
    error(toSingleLine`Language with code "${languageCode}" was not found. You should register particular language 
    before using it (for example, load dist/languages/${languageCode}.js or import '@freegrid/sheet/languages/${languageCode}').`);
  }
};

/**
 * Sets `settings.language` to the registered language `languageCode` (in its usual case), or to the default language
 * with an error message when it is not registered.
 */
export const applyLanguageSetting = (settings: { language?: string }, languageCode: string): void => {
  const normalizedLanguageCode = normalizeLanguageCode(languageCode);

  if (hasLanguageDictionary(normalizedLanguageCode)) {
    settings.language = normalizedLanguageCode;
  } else {
    settings.language = DEFAULT_LANGUAGE_CODE;
    warnUserAboutLanguageRegistration(languageCode);
  }
};
