import staticRegister from './../utils/staticRegister';
import type { Validator } from '../cellTypes/types';

import autocompleteValidator from './autocompleteValidator';
import dateValidator from './dateValidator';
import numericValidator from './numericValidator';
import timeValidator from './timeValidator';

const {
  register,
  getItem,
  hasItem,
  getNames,
  getValues,
} = staticRegister<Validator>('validators');

register('autocomplete', autocompleteValidator);
register('date', dateValidator);
register('numeric', numericValidator);
register('time', timeValidator);

/** A registered validator by name (a function is returned as it is); throws for an unknown name. */
const getValidatorItem = (name: string | Validator): Validator => {
  if (typeof name === 'function') {
    return name;
  }
  if (!hasItem(name)) {
    throw Error(`No registered validator found under "${name}" name`);
  }

  return getItem(name) as Validator;
};

export {
  register as registerValidator,
  getValidatorItem as getValidator,
  hasItem as hasValidator,
  getNames as getRegisteredValidatorNames,
  getValues as getRegisteredValidators,
};
