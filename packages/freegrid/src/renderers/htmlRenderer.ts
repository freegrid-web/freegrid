import { fastInnerHTML } from './../helpers/dom/element';
import { getRenderer } from './index';
import type { Renderer } from '../cellTypes/types';

/** The value as HTML (`allowHtml`): only for values you trust. */
const htmlRenderer: Renderer = (instance, TD, row, col, prop, value, cellProperties) => {
  getRenderer('base')(instance, TD, row, col, prop, value, cellProperties);
  fastInnerHTML(TD, value === null || value === undefined ? '' : value as string);
};

export default htmlRenderer;
