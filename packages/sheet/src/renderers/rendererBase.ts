import { withCounterpartClassNames } from './../helpers/classNames';
import { addClass, removeClass } from './../helpers/dom/element';
import type { Renderer } from '../cellTypes/types';

/**
 * The base renderer: the cell's classes (its `className`, read-only, invalid, no word wrap, placeholder). The other
 * renderers start with it.
 */
const rendererBase: Renderer = (instance, TD, row, col, prop, value, cellProperties) => {
  const classesToAdd: string[] = [];
  const classesToRemove: string[] = [];

  if (cellProperties.className) {
    // Written directly (not via addClass), so add FreeSheet/legacy counterparts here.
    const classNames = Array.isArray(cellProperties.className)
      ? cellProperties.className
      : String(cellProperties.className).split(' ');
    const cellClassName = withCounterpartClassNames(classNames.filter(name => name)).join(' ');

    TD.className = TD.className ? `${TD.className} ${cellClassName}` : cellClassName;
  }
  if (cellProperties.readOnly) {
    classesToAdd.push(cellProperties.readOnlyCellClassName as string);
  }
  if (cellProperties.valid === false && cellProperties.invalidCellClassName) {
    classesToAdd.push(cellProperties.invalidCellClassName);
  } else {
    classesToRemove.push(cellProperties.invalidCellClassName as string);
  }
  if (cellProperties.wordWrap === false && cellProperties.noWordWrapClassName) {
    classesToAdd.push(cellProperties.noWordWrapClassName);
  }
  if (!value && cellProperties.placeholder) {
    classesToAdd.push(cellProperties.placeholderCellClassName as string);
  }
  removeClass(TD, classesToRemove);
  addClass(TD, classesToAdd);
};

export default rendererBase;
