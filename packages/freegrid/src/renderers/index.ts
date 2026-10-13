import staticRegister from './../utils/staticRegister';
import type { Renderer } from '../cellTypes/types';

import baseRenderer from './_cellDecorator';
import autocompleteRenderer from './autocompleteRenderer';
import checkboxRenderer from './checkboxRenderer';
import htmlRenderer from './htmlRenderer';
import numericRenderer from './numericRenderer';
import passwordRenderer from './passwordRenderer';
import textRenderer from './textRenderer';

const {
  register,
  getItem,
  hasItem,
  getNames,
  getValues,
} = staticRegister<Renderer>('renderers');

register('base', baseRenderer);
register('autocomplete', autocompleteRenderer);
register('checkbox', checkboxRenderer);
register('html', htmlRenderer);
register('numeric', numericRenderer);
register('password', passwordRenderer);
register('text', textRenderer);

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
