import { getValidSelection } from './../utils';
import * as C from './../../../i18n/constants';
import type { MenuItem } from './../menuItem';
import type { PluginHost } from './../../_base';

export const KEY = 'clear_column';

const clearColumnItem = (): MenuItem => ({
  key: KEY,
  name(this: PluginHost) {
    return this.getTranslatedPhrase(C.CONTEXTMENU_ITEMS_CLEAR_COLUMN);
  },
  callback(this: PluginHost, key, selection) {
    const column = selection[0].start.col;

    if (this.countRows()) {
      this.populateFromArray(0, column, [[null]], Math.max(selection[0].start.row, selection[0].end.row), column, 'ContextMenu.clearColumn');
    }
  },
  disabled(this: PluginHost) {
    const selected = getValidSelection(this);

    if (!selected) {
      return true;
    }
    const [startRow, startColumn, endRow] = selected[0];
    const entireRowSelection = [startRow, 0, endRow, this.countCols() - 1];
    const rowSelected = entireRowSelection.join(',') === selected.join(',');

    return startColumn < 0 || this.countCols() >= this.getSettings().maxCols || rowSelected;
  },
});

export default clearColumnItem;
