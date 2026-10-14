import { getValidSelection } from './../utils';
import { transformSelectionToRowDistance } from './../../../selection/utils';
import * as C from './../../../i18n/constants';
import type { MenuItem } from './../menuItem';
import type { PluginHost } from './../../_base';

export const KEY = 'remove_row';

const removeRowItem = (): MenuItem => ({
  key: KEY,
  name(this: PluginHost) {
    const selection = this.getSelected();
    let pluralForm = 0;

    if (selection) {
      if (selection.length > 1) {
        pluralForm = 1;
      } else {
        const [fromRow, , toRow] = selection[0];

        if (fromRow - toRow !== 0) {
          pluralForm = 1;
        }
      }
    }

    return this.getTranslatedPhrase(C.CONTEXTMENU_ITEMS_REMOVE_ROW, pluralForm);
  },
  callback(this: PluginHost) {
    // With index groups, alter takes the amounts from the groups (the `1` is not used).
    this.alter('remove_row', transformSelectionToRowDistance(this.getSelected()!), 1, 'ContextMenu.removeRow');
  },
  disabled(this: PluginHost) {
    const selected = getValidSelection(this);
    const totalRows = this.countRows();

    if (!selected) {
      return true;
    }

    return this.selection.isSelectedByColumnHeader() || this.selection.isSelectedByCorner() || !totalRows;
  },
  hidden(this: PluginHost) {
    return !this.getSettings().allowRemoveRow;
  },
});

export default removeRowItem;
