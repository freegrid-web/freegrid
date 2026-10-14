import type { Phrase } from '../dictionariesManager';

/**
 * The plural form `pluralForm` (an index into the phrase's forms), or the phrase as it is when it has no forms or
 * `pluralForm` is not an integer.
 */
const pluralize = (phrasePropositions: Phrase, pluralForm: unknown): Phrase => (
  Array.isArray(phrasePropositions) && Number.isInteger(pluralForm)
    ? phrasePropositions[pluralForm as number]
    : phrasePropositions);

export default pluralize;
