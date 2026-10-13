import { Selection } from './../../../3rdparty/walkontable/src';
import type { HighlightOptions } from './options';

/** Highlights the current cell (one at a time). */
const createHighlight = ({ cellCornerVisible }: HighlightOptions): Selection => new Selection({
  className: 'current',
  border: {
    width: 2,
    color: 'var(--fg-selection-border-color)', // see src/css/variables.css
    cornerVisible: cellCornerVisible,
  },
});

export default createHighlight;
