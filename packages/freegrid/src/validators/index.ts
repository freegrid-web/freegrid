import staticRegister from './../utils/staticRegister';
import type { Validator } from '../cellTypes/types';

import validatorAutocomplete from './validatorAutocomplete';
import validatorDate from './validatorDate';
import validatorNumeric from './validatorNumeric';
import validatorTime from './validatorTime';

const {
  register,
  getItem,
  hasItem,
  getNames,
  getValues,
} = staticRegister<Validator>('validators');

register('autocomplete', validatorAutocomplete);
register('date', validatorDate);
register('numeric', validatorNumeric);
register('time', validatorTime);

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
