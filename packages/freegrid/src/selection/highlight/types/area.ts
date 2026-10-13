import { Selection } from './../../../3rdparty/walkontable/src';
import type { HighlightOptions } from './options';

/** Highlights a range of selected cells (one per layer of a non-consecutive selection). */
const createHighlight = ({ layerLevel = 0, areaCornerVisible }: HighlightOptions): Selection => new Selection({
  className: 'area',
  markIntersections: true,
  layerLevel: Math.min(layerLevel, 7),
  border: {
    width: 1,
    color: 'var(--fg-selection-border-color)', // see src/css/variables.css
    cornerVisible: areaCornerVisible,
  },
});

export default createHighlight;
