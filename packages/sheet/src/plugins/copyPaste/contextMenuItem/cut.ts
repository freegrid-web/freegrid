import * as C from './../../../i18n/constants';
import type CopyPaste from './../copyPaste';
import type { MenuItem } from './../../contextMenu/menuItem';
import type { PluginHost } from './../../_base';
import { ICONS } from './../../contextMenu/icons';

/** The context menu entry that cuts the selection (disabled without a selection or with several ranges). */
const cutItem = (copyPastePlugin: CopyPaste): MenuItem => ({
  key: 'cut',
  icon: ICONS.cut,
  shortcut: 'Ctrl+X',
  name(this: PluginHost) {
    return this.getTranslatedPhrase(C.CONTEXTMENU_ITEMS_CUT);
  },
  callback() {
    copyPastePlugin.cut();
  },
  disabled(this: PluginHost) {
    const selected = this.getSelected();

    return !selected || selected.length > 1;
  },
  hidden: false,
});

export default cutItem;
