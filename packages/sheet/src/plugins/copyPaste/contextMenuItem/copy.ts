import * as C from './../../../i18n/constants';
import type CopyPaste from './../copyPaste';
import type { MenuItem } from './../../contextMenu/menuItem';
import type { PluginHost } from './../../_base';

/** The context menu entry that copys the selection (disabled without a selection or with several ranges). */
const copyItem = (copyPastePlugin: CopyPaste): MenuItem => ({
  key: 'copy',
  name(this: PluginHost) {
    return this.getTranslatedPhrase(C.CONTEXTMENU_ITEMS_COPY);
  },
  callback() {
    copyPastePlugin.copy();
  },
  disabled(this: PluginHost) {
    const selected = this.getSelected();

    return !selected || selected.length > 1;
  },
  hidden: false,
});

export default copyItem;
