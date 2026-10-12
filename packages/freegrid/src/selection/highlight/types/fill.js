import { Selection } from './../../../3rdparty/walkontable/src';

/**
 * Creates the new instance of Selection, responsible for highlighting cells which are covered by fill handle
 * functionality. This type of selection can present on the table only one at the time.
 *
 * @return {Selection}
 */
function createHighlight() {
  const s = new Selection({
    className: 'fill',
    border: {
      width: 1,
      color: 'var(--fg-fill-border-color)', // see src/css/variables.css
    },
  });

  return s;
}

export default createHighlight;
