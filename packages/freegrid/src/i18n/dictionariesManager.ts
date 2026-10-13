import { isObject, deepClone } from '../helpers/object';
import { extendNotExistingKeys } from './utils';
import staticRegister from '../utils/staticRegister';
import DEFAULT_DICTIONARY from './languages/en-US';

/** A phrase, or its plural forms. */
export type Phrase = string | string[];

/** The phrases of a language by dictionary key (see constants.ts), and its code such as `en-US`. */
export type LanguageDictionary = { languageCode: string; [key: string]: Phrase };

const DEFAULT_LANGUAGE_CODE = DEFAULT_DICTIONARY.languageCode;

const {
  register: registerGloballyLanguageDictionary,
  getItem: getGlobalLanguageDictionary,
  hasItem: hasGlobalLanguageDictionary,
  getValues: getGlobalLanguagesDictionaries,
} = staticRegister<LanguageDictionary>('languagesDictionaries');

/** Fills the phrases a dictionary lacks with the default language's. */
const extendLanguageDictionary = (languageCode: string, dictionary: LanguageDictionary): void => {
  if (languageCode !== DEFAULT_LANGUAGE_CODE) {
    extendNotExistingKeys(dictionary, getGlobalLanguageDictionary(DEFAULT_LANGUAGE_CODE) as LanguageDictionary);
  }
};

/**
 * Registers a language: `registerLanguage(dictionary)` or `registerLanguage('de-DE', dictionary)`. Missing phrases
 * come from the default language. Returns a copy (the registered dictionary is not shared by reference).
 */
const registerLanguage = (languageCodeOrDictionary: string | LanguageDictionary,
  dictionary?: LanguageDictionary): LanguageDictionary => {
  const dictionaryObject = (isObject(languageCodeOrDictionary) ? languageCodeOrDictionary : dictionary) as LanguageDictionary;
  const languageCode = isObject(languageCodeOrDictionary)
    ? dictionaryObject.languageCode
    : languageCodeOrDictionary as string;

  extendLanguageDictionary(languageCode, dictionaryObject);
  registerGloballyLanguageDictionary(languageCode, deepClone(dictionaryObject));

  return deepClone(dictionaryObject);
};

const hasLanguage = (languageCode: string): boolean => hasGlobalLanguageDictionary(languageCode);

/** A copy of a registered language, or `null`. */
const getLanguage = (languageCode: string): LanguageDictionary | null => (hasLanguage(languageCode)
  ? deepClone(getGlobalLanguageDictionary(languageCode)) as LanguageDictionary
  : null);

const getDefaultLanguage = (): LanguageDictionary => DEFAULT_DICTIONARY;

const getLanguages = (): LanguageDictionary[] => getGlobalLanguagesDictionaries();

export {
  registerLanguage as registerLanguageDictionary,
  getLanguage as getLanguageDictionary,
  hasLanguage as hasLanguageDictionary,
  getDefaultLanguage as getDefaultLanguageDictionary,
  getLanguages as getLanguagesDictionaries,
  DEFAULT_LANGUAGE_CODE,
};

registerLanguage(DEFAULT_DICTIONARY);
