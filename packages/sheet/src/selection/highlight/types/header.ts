import { Selection } from './../../../3rdparty/walkontable/src';
import type { HighlightOptions } from './options';

/** Highlights the row and column headers of the selected cells. */
const createHighlight = ({ headerClassName, rowClassName, columnClassName }: HighlightOptions): Selection => new Selection({
  className: 'highlight',
  highlightHeaderClassName: headerClassName,
  highlightRowClassName: rowClassName,
  highlightColumnClassName: columnClassName,
});

export default createHighlight;
