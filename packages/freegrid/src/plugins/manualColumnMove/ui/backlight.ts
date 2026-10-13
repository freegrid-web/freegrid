import BaseUI from './_base';
import { addClass } from './../../../helpers/dom/element';

const CSS_CLASSNAME = 'fg-manual-column-move--backlight';

/**
 * @class BacklightUI
 * @util
 */
class BacklightUI extends BaseUI {
  /**
   * Custom className on build process.
   */
  build() {
    super.build();

    addClass(this._element, CSS_CLASSNAME);
  }
}

export default BacklightUI;
