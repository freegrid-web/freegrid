import * as C from './../../../i18n/constants';
import { checkSelectionBorders } from './../utils';
import type CustomBorders from './../customBorders';
import type { MenuItem } from './../../contextMenu/menuItem';
import type { PluginHost } from './../../_base';

/** The context menu entry that removes the borders of the selected cells (disabled when they have none). */
const noBorders = (customBordersPlugin: CustomBorders): MenuItem => ({
  key: 'borders:no_borders',
  name(this: PluginHost) {
    return this.getTranslatedPhrase(C.CONTEXTMENU_ITEMS_REMOVE_BORDERS);
  },
  callback(key, selected) {
    customBordersPlugin.prepareBorder(selected, 'noBorders');
  },
  disabled(this: PluginHost) {
    return !checkSelectionBorders(this);
  },
});

export default noBorders;
