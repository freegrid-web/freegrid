import { getValidSelection } from './../utils';
import * as C from './../../../i18n/constants';
import type { MenuItem } from './../menuItem';
import type { PluginHost } from './../../_base';
import { ICONS } from './../icons';

export const KEY = 'row_below';

const rowBelowItem = (): MenuItem => ({
  key: KEY,
  icon: ICONS.rowBelow,
  name(this: PluginHost) {
    return this.getTranslatedPhrase(C.CONTEXTMENU_ITEMS_ROW_BELOW);
  },
  callback(this: PluginHost, key, normalizedSelection) {
    const latestSelection = normalizedSelection[Math.max(normalizedSelection.length - 1, 0)];

    this.alter('insert_row', latestSelection.end.row + 1, 1, 'ContextMenu.rowBelow');
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

export default rowBelowItem;
