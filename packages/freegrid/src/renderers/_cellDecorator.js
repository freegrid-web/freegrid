import { withCounterpartClassNames } from './../helpers/classNames';
/**
 * Adds appropriate CSS class to table cell, based on cellProperties
 */
import { addClass, removeClass } from './../helpers/dom/element';

function cellDecorator(instance, TD, row, col, prop, value, cellProperties) {
  const classesToAdd = [];
  const classesToRemove = [];

  if (cellProperties.className) {
    // Written directly (not via addClass), so add FreeGrid/legacy counterparts here.
    const classNames = Array.isArray(cellProperties.className) ? cellProperties.className : String(cellProperties.className).split(' ');
    const cellClassName = withCounterpartClassNames(classNames.filter(name => name)).join(' ');

    if (TD.className) {
      TD.className = `${TD.className} ${cellClassName}`;
    } else {
      TD.className = cellClassName;
    }
  }

  if (cellProperties.readOnly) {
    classesToAdd.push(cellProperties.readOnlyCellClassName);
  }

  if (cellProperties.valid === false && cellProperties.invalidCellClassName) {
    classesToAdd.push(cellProperties.invalidCellClassName);

  } else {
    classesToRemove.push(cellProperties.invalidCellClassName);
  }

  if (cellProperties.wordWrap === false && cellProperties.noWordWrapClassName) {
    classesToAdd.push(cellProperties.noWordWrapClassName);
  }

  if (!value && cellProperties.placeholder) {
    classesToAdd.push(cellProperties.placeholderCellClassName);
  }

  removeClass(TD, classesToRemove);
  addClass(TD, classesToAdd);
}

export default cellDecorator;
