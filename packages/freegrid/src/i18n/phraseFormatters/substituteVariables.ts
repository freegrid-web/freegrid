import { substitute } from './../../helpers/string';
import type { Phrase } from '../dictionariesManager';

/** The phrase (or each of its forms) with `[name]` variables replaced by the values in `zippedVariablesAndValues`. */
const substituteVariables = (phrasePropositions: Phrase, zippedVariablesAndValues: Record<string, unknown>): Phrase => (
  Array.isArray(phrasePropositions)
    ? phrasePropositions.map(phrase => substitute(phrase, zippedVariablesAndValues))
    : substitute(phrasePropositions, zippedVariablesAndValues));

export default substituteVariables;
