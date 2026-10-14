import { Selection } from './../../../3rdparty/walkontable/src';
import type { HighlightOptions } from './options';

/** Highlights the headers of fully selected rows and columns. */
const createHighlight = ({ activeHeaderClassName }: HighlightOptions): Selection => new Selection({
  highlightHeaderClassName: activeHeaderClassName,
});

export default createHighlight;
