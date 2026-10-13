import { isNumeric } from './../helpers/number';
import type { ValidatorContext } from '../cellTypes/types';

/** Valid: a number, or an empty value with `allowEmpty`. */
export default function numericValidator(this: ValidatorContext, value: unknown, callback: (valid: boolean) => void): void {
  const valueToValidate = value ?? '';

  if (valueToValidate === '') {
    callback(!!this.allowEmpty);
  } else {
    callback(isNumeric(value));
  }
}
