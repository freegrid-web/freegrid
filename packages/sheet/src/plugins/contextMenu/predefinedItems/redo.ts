import * as C from './../../../i18n/constants';
import type { MenuItem } from './../menuItem';
import type { PluginHost } from './../../_base';
import { ICONS } from './../icons';

export const KEY = 'redo';

const redoItem = (): MenuItem => ({
  key: KEY,
  icon: ICONS.redo,
  shortcut: 'Ctrl+Y',
  name(this: PluginHost) {
    return this.getTranslatedPhrase(C.CONTEXTMENU_ITEMS_REDO);
  },
  callback(this: PluginHost) {
    this.redo!();
  },
  disabled(this: PluginHost) {
    return Boolean(this.undoRedo && !this.undoRedo.isRedoAvailable());
  },
});

export default redoItem;
