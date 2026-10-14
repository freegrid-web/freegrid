import { getLanguageDictionary } from './dictionariesManager';
import type { Phrase } from './dictionariesManager';
import { getPhraseFormatters } from './phraseFormatters';

/**
 * Applies the registered phrase formatters (e.g. plural forms) to the phrase of a dictionary key.
 *
 * Each formatter receives the dictionary's phrase, not the previous formatter's result.
 */
const getFormattedPhrase = (phrasePropositions: Phrase, argumentsForFormatters: unknown): Phrase => {
  let formattedPhrasePropositions = phrasePropositions;

  getPhraseFormatters().forEach((formatter) => {
    formattedPhrasePropositions = formatter(phrasePropositions, argumentsForFormatters);
  });

  return formattedPhrasePropositions;
};

/**
 * The phrase of `dictionaryKey` in `languageCode` (`null` when the language or the key is unknown), formatted with
 * `argumentsForFormatters` (e.g. a count for plural forms).
 */
export const getTranslatedPhrase = (languageCode: string, dictionaryKey: string,
  argumentsForFormatters?: unknown): string | null => {
  const languageDictionary = getLanguageDictionary(languageCode);
  const phrasePropositions = languageDictionary?.[dictionaryKey];

  if (phrasePropositions === undefined) {
    return null;
  }
  const formattedPhrase = getFormattedPhrase(phrasePropositions, argumentsForFormatters);

  return Array.isArray(formattedPhrase) ? formattedPhrase[0] : formattedPhrase;
};
