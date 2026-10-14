import { getValidSelection } from './../utils';
import * as C from './../../../i18n/constants';
import type { MenuItem } from './../menuItem';
import type { PluginHost } from './../../_base';

export const KEY = 'row_above';

const rowAboveItem = (): MenuItem => ({
  key: KEY,
  name(this: PluginHost) {
    return this.getTranslatedPhrase(C.CONTEXTMENU_ITEMS_ROW_ABOVE);
  },
  callback(this: PluginHost, key, normalizedSelection) {
    const latestSelection = normalizedSelection[Math.max(normalizedSelection.length - 1, 0)];

    this.alter('insert_row', latestSelection.start.row, 1, 'ContextMenu.rowAbove');
  },
  disabled(this: PluginHost) {
    const selected = getValidSelection(this);

    if (!selected) {
      return true;
    }

    return this.selection.isSelectedByColumnHeader() || this.countRows() >= this.getSettings().maxRows;
  },
  hidden(this: PluginHost) {
    return !this.getSettings().allowInsertRow;
  },
});

export default rowAboveItem;
