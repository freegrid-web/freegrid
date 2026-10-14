import staticRegister from './../utils/staticRegister';
import type { Renderer } from '../cellTypes/types';

import rendererBase from './rendererBase';
import rendererAutocomplete from './rendererAutocomplete';
import rendererCheckbox from './rendererCheckbox';
import rendererHtml from './rendererHtml';
import rendererNumeric from './rendererNumeric';
import rendererPassword from './rendererPassword';
import rendererText from './rendererText';

const {
  register,
  getItem,
  hasItem,
  getNames,
  getValues,
} = staticRegister<Renderer>('renderers');

register('base', rendererBase);
register('autocomplete', rendererAutocomplete);
register('checkbox', rendererCheckbox);
register('html', rendererHtml);
register('numeric', rendererNumeric);
register('password', rendererPassword);
register('text', rendererText);

/** A registered renderer by name (a function is returned as it is); throws for an unknown name. */
const getRendererItem = (name: string | Renderer): Renderer => {
  if (typeof name === 'function') {
    return name;
  }
  if (!hasItem(name)) {
    throw Error(`No registered renderer found under "${name}" name`);
  }

  return getItem(name) as Renderer;
};

export {
  register as registerRenderer,
  getRendererItem as getRenderer,
  hasItem as hasRenderer,
  getNames as getRegisteredRendererNames,
  getValues as getRegisteredRenderers,
};
