import staticRegister from './../../utils/staticRegister';
import pluralizeFn from './pluralize';
import type { Phrase } from '../dictionariesManager';

/** Turns a phrase (or its forms) into another, e.g. picks a plural form. */
export type PhraseFormatter = (phrasePropositions: Phrase, argumentsForFormatters: unknown) => Phrase;

const {
  register: registerGloballyPhraseFormatter,
  getValues: getGlobalPhraseFormatters,
} = staticRegister<PhraseFormatter>('phraseFormatters');

export const register = (name: string, formatterFn: PhraseFormatter): void => {
  registerGloballyPhraseFormatter(name, formatterFn);
};

/** The registered formatters, in registration order. */
export const getAll = (): PhraseFormatter[] => getGlobalPhraseFormatters();

export {
  register as registerPhraseFormatter,
  getAll as getPhraseFormatters,
};

register('pluralize', pluralizeFn);
