import * as C from './../../../i18n/constants';
import { checkSelectionBorders, markSelected } from './../utils';
import type { Side } from './../utils';
import type CustomBorders from './../customBorders';
import type { MenuItem } from './../../contextMenu/menuItem';
import type { PluginHost } from './../../_base';

const LABELS: Record<Side, string> = {
  top: C.CONTEXTMENU_ITEMS_BORDERS_TOP,
  right: C.CONTEXTMENU_ITEMS_BORDERS_RIGHT,
  bottom: C.CONTEXTMENU_ITEMS_BORDERS_BOTTOM,
  left: C.CONTEXTMENU_ITEMS_BORDERS_LEFT,
};

/**
 * The context menu entry that toggles the border on one side of the selected cells (checked when a selected cell has
 * it).
 */
const sideItem = (customBordersPlugin: CustomBorders, side: Side): MenuItem => ({
  key: `borders:${side}`,
  name(this: PluginHost) {
    const label = this.getTranslatedPhrase(LABELS[side]);

    return checkSelectionBorders(this, side) ? markSelected(label) : label;
  },
  callback(this: PluginHost, key, selected) {
    customBordersPlugin.prepareBorder(selected, side, checkSelectionBorders(this, side));
  },
});

export default sideItem;
