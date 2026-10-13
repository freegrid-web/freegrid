import { classNameIncludes } from './../helpers/classNames';
import { getRenderer } from './index';
import { isNumeric } from './../helpers/number';
import { formatNumber } from './../helpers/numberFormat';
import type { Renderer } from '../cellTypes/types';

const ALIGNMENTS = ['fg-left', 'fg-center', 'fg-right', 'fg-justify'];

/**
 * A number formatted with `numericFormat`, right-aligned unless the cell has another alignment class. Values that
 * are not numbers are shown as text.
 */
const numericRenderer: Renderer = (instance, TD, row, col, prop, value, cellProperties) => {
  let newValue = value;

  if (isNumeric(newValue)) {
    const className = (cellProperties.className || '') as string;
    const classArr = className.length ? className.split(' ') : [];

    newValue = formatNumber(Number(newValue), cellProperties.numericFormat);

    if (!ALIGNMENTS.some(alignment => classNameIncludes(className, alignment))) {
      classArr.push('fg-right');
    }
    if (!classNameIncludes(className, 'fg-numeric')) {
      classArr.push('fg-numeric');
    }
    cellProperties.className = classArr.join(' ');
  }
  getRenderer('text')(instance, TD, row, col, prop, newValue, cellProperties);
};

export default numericRenderer;
