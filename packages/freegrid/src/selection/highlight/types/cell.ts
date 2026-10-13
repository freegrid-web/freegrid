import { Selection } from './../../../3rdparty/walkontable/src';

/**
 * Creates the new instance of Selection responsible for highlighting currently selected cell. This type of selection
 * can present on the table only one at the time.
 *
 * @return {Selection}
 */
function createHighlight({ cellCornerVisible }) {
  const s = new Selection({
    className: 'current',
    border: {
      width: 2,
      color: 'var(--fg-selection-border-color)', // see src/css/variables.css
      cornerVisible: cellCornerVisible,
    },
  });

  return s;
}

export default createHighlight;
