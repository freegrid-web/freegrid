import { Selection } from './../../../3rdparty/walkontable/src';

/** Highlights the cells the fill handle is dragged over (one at a time). */
const createHighlight = (): Selection => new Selection({
  className: 'fill',
  border: {
    width: 1,
    color: 'var(--fg-fill-border-color)', // see src/css/variables.css
  },
});

export default createHighlight;
