import { getValidSelection } from './../utils';
import { transformSelectionToColumnDistance } from './../../../selection/utils';
import * as C from './../../../i18n/constants';
import type { MenuItem } from './../menuItem';
import type { PluginHost } from './../../_base';

export const KEY = 'remove_col';

const removeColumnItem = (): MenuItem => ({
  key: KEY,
  name(this: PluginHost) {
    const selection = this.getSelected();
    let pluralForm = 0;

    if (selection) {
      if (selection.length > 1) {
        pluralForm = 1;
      } else {
        const [, fromColumn, , toColumn] = selection[0];

        if (fromColumn - toColumn !== 0) {
          pluralForm = 1;
        }
      }
    }

    return this.getTranslatedPhrase(C.CONTEXTMENU_ITEMS_REMOVE_COLUMN, pluralForm);
  },
  callback(this: PluginHost) {
    this.alter('remove_col', transformSelectionToColumnDistance(this.getSelected()!), null, 'ContextMenu.removeColumn');
  },
  disabled(this: PluginHost) {
    const selected = getValidSelection(this);
    const totalColumns = this.countCols();

    if (!selected) {
      return true;
    }

    return this.selection.isSelectedByRowHeader() || this.selection.isSelectedByCorner() ||
           !this.isColumnModificationAllowed() || !totalColumns;
  },
  hidden(this: PluginHost) {
    return !this.getSettings().allowRemoveColumn;
  },
});

export default removeColumnItem;
