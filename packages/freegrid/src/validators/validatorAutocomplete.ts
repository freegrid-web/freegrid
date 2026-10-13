import type { ValidatorContext } from '../cellTypes/types';

/**
 * Valid: with `strict` and a `source`, a value from the source (a list, or a function that gives one for the value);
 * without them, anything. An empty value is valid with `allowEmpty`.
 */
export default function validatorAutocomplete(this: ValidatorContext, value: unknown,
  callback: (valid: boolean) => void): void {
  const valueToValidate = value ?? '';

  if (this.allowEmpty && valueToValidate === '') {
    callback(true);

    return;
  }
  if (!this.strict || !this.source) {
    callback(true);

    return;
  }
  const isInSource = (source: unknown[]) => callback(source.some(item => item === valueToValidate));

  if (typeof this.source === 'function') {
    this.source(valueToValidate, isInSource);
  } else {
    isInSource(this.source);
  }
}
