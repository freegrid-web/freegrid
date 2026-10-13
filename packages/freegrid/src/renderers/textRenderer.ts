import { fastInnerText } from './../helpers/dom/element';
import { stringify } from './../helpers/mixed';
import { getRenderer } from './index';
import type { Renderer } from '../cellTypes/types';

/**
 * The default renderer: the value as text (or the placeholder when it is empty). Spaces are kept unless
 * `trimWhitespace` is on.
 */
const textRenderer: Renderer = (instance, TD, row, col, prop, value, cellProperties) => {
  getRenderer('base')(instance, TD, row, col, prop, value, cellProperties);
  let text = stringify(!value && cellProperties.placeholder ? cellProperties.placeholder : value);

  if (!instance.getSettings().trimWhitespace) {
    text = text.replace(/ /g, String.fromCharCode(160));
  }
  // Faster than innerHTML.
  fastInnerText(TD, text);
};

export default textRenderer;
