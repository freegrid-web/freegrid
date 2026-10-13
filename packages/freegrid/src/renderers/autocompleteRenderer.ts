import { withLegacyClassNames } from './../helpers/classNames';
import { addClass, hasClass } from './../helpers/dom/element';
import EventManager from './../eventManager';
import { CellCoords } from './../3rdparty/walkontable/src';
import { getRenderer } from './index';
import type { Renderer } from '../cellTypes/types';

// Cloned for every cell: faster than creating the element.
const clonableARROW = document.createElement('DIV');

clonableARROW.className = withLegacyClassNames('fg-autocomplete-arrow');
clonableARROW.appendChild(document.createTextNode(String.fromCharCode(9660)));

/**
 * The value (as text, or as HTML with `allowHtml`) with a dropdown arrow. A mousedown on the arrow opens the cell's
 * editor.
 */
const autocompleteRenderer: Renderer = (instance, TD, row, col, prop, value, cellProperties) => {
  getRenderer(cellProperties.allowHtml ? 'html' : 'text')(instance, TD, row, col, prop, value, cellProperties);

  if (!TD.firstChild) {
    // An empty cell would otherwise have no height to align the arrow with.
    TD.appendChild(document.createTextNode(String.fromCharCode(160)));
  }
  TD.insertBefore(clonableARROW.cloneNode(true), TD.firstChild);
  addClass(TD, 'fg-autocomplete');

  if (!instance.acArrowListener) {
    const eventManager = new EventManager(instance);

    instance.acArrowListener = (event: MouseEvent) => {
      if (hasClass(event.target as HTMLElement, 'fg-autocomplete-arrow')) {
        instance.view.wt.getSetting('onCellDblClick', null, new CellCoords(row, col), TD);
      }
    };
    eventManager.addEventListener(instance.rootElement, 'mousedown', instance.acArrowListener);
    // Removes the listener when the grid is destroyed.
    instance.addHookOnce('afterDestroy', () => {
      eventManager.destroy();
    });
  }
};

export default autocompleteRenderer;
