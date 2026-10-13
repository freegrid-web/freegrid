import { classNameIncludes } from './../helpers/classNames';
import { getRenderer } from './index';
import { isNumeric } from './../helpers/number';
import { formatNumber } from './../helpers/numberFormat';

/**
 * Numeric cell renderer
 *
 * @private
 * @renderer NumericRenderer
 * @param {Object} instance FreeGrid instance
 * @param {Element} TD Table cell where to render
 * @param {Number} row
 * @param {Number} col
 * @param {String|Number} prop Row object property name
 * @param value Value to render (remember to escape unsafe HTML before inserting to DOM!)
 * @param {Object} cellProperties Cell properties (shared by cell renderer and editor)
 */
function numericRenderer(instance, TD, row, col, prop, value, cellProperties) {
  let newValue = value;

  if (isNumeric(newValue)) {
    const className = cellProperties.className || '';
    const classArr = className.length ? className.split(' ') : [];

    newValue = formatNumber(Number(newValue), cellProperties.numericFormat);

    const classes = classArr.join(' ');

    if (!['fg-left', 'fg-center', 'fg-right', 'fg-justify'].some(alignment => classNameIncludes(classes, alignment))) {
      classArr.push('fg-right');
    }

    if (!classNameIncludes(classes, 'fg-numeric')) {
      classArr.push('fg-numeric');
    }

    cellProperties.className = classArr.join(' ');
  }

  getRenderer('text')(instance, TD, row, col, prop, newValue, cellProperties);
}

export default numericRenderer;
