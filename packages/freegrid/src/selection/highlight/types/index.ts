/* eslint-disable import/prefer-default-export */
import staticRegister from './../../../utils/staticRegister';
import type { Selection } from './../../../3rdparty/walkontable/src';
import type { CustomSelectionOptions, HighlightOptions } from './options';

import activeHeaderHighlight from './activeHeader';
import areaHighlight from './area';
import cellHighlight from './cell';
import customSelection from './customSelection';
import fillHighlight from './fill';
import headerHighlight from './header';

type HighlightFactory = (options: HighlightOptions & CustomSelectionOptions) => Selection;

const {
  register,
  getItem,
} = staticRegister<HighlightFactory>('highlight/types');

register('active-header', activeHeaderHighlight);
register('area', areaHighlight);
register('cell', cellHighlight);
register('custom-selection', customSelection);
register('fill', fillHighlight);
register('header', headerHighlight);

/** A new Walkontable Selection of a highlight type (`cell`, `area`, `header`, …). */
const createHighlight = (highlightType: string, options: HighlightOptions & CustomSelectionOptions): Selection => (
  getItem(highlightType) as HighlightFactory)(options);

export {
  createHighlight,
};
