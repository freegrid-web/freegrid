import { fastInnerHTML } from './../helpers/dom/element';
import { getRenderer } from './index';
import type { Renderer } from '../cellTypes/types';

/** The value hidden: `hashSymbol` (default `*`) repeated `hashLength` times, or as many times as the value is long. */
const rendererPassword: Renderer = (instance, TD, row, col, prop, value, cellProperties) => {
  getRenderer('text')(instance, TD, row, col, prop, value, cellProperties);
  const hashLength = cellProperties.hashLength || TD.innerHTML.length;
  const hashSymbol = cellProperties.hashSymbol || '*';

  fastInnerHTML(TD, hashSymbol.repeat(Math.max(hashLength, 0)));
};

export default rendererPassword;
