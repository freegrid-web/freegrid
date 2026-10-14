import * as C from './../../../i18n/constants';
import type { MenuItem } from './../menuItem';
import type { PluginHost } from './../../_base';

export const KEY = 'undo';

const undoItem = (): MenuItem => ({
  key: KEY,
  name(this: PluginHost) {
    return this.getTranslatedPhrase(C.CONTEXTMENU_ITEMS_UNDO);
  },
  callback(this: PluginHost) {
    this.undo();
  },
  disabled(this: PluginHost) {
    return this.undoRedo && !this.undoRedo.isUndoAvailable();
  },
});

export default undoItem;
