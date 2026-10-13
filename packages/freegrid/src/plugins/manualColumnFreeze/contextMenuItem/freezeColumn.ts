import * as C from './../../../i18n/constants';
import type ManualColumnFreeze from './../manualColumnFreeze';
import type { MenuItem } from './../../contextMenu/menuItem';
import type { PluginHost } from './../../_base';

/** The context menu entry that freezes the selected column (shown when one column that is not frozen is selected). */
const freezeColumnItem = (manualColumnFreezePlugin: ManualColumnFreeze): MenuItem => ({
  key: 'freeze_column',
  name(this: PluginHost) {
    return this.getTranslatedPhrase(C.CONTEXTMENU_ITEMS_FREEZE_COLUMN);
  },
  callback(this: PluginHost, key, selected) {
    const [{ start: { col: selectedColumn } }] = selected;

    manualColumnFreezePlugin.freezeColumn(selectedColumn);

    this.render();
    this.view.wt.wtOverlays.adjustElementsSize(true);
  },
  hidden(this: PluginHost) {
    const selection = this.getSelectedRange();

    return selection === undefined || selection.length > 1 || selection[0].from.col !== selection[0].to.col
      || selection[0].from.col <= this.getSettings().fixedColumnsLeft - 1;
  },
});

export default freezeColumnItem;
