import { Selection } from './../../../3rdparty/walkontable/src';
import type { CustomSelectionOptions } from './options';

/** A custom selection, e.g. a border added by the CustomBorders plugin. */
const createHighlight = ({ border, cellRange }: CustomSelectionOptions): Selection => new Selection(border, cellRange);

export default createHighlight;
