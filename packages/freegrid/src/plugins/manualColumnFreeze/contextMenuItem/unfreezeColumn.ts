import * as C from './../../../i18n/constants';
import type ManualColumnFreeze from './../manualColumnFreeze';
import type { MenuItem } from './../../contextMenu/menuItem';
import type { PluginHost } from './../../_base';

/** The context menu entry that unfreezes the selected column (shown when one frozen column is selected). */
const unfreezeColumnItem = (manualColumnFreezePlugin: ManualColumnFreeze): MenuItem => ({
  key: 'unfreeze_column',
  name(this: PluginHost) {
    return this.getTranslatedPhrase(C.CONTEXTMENU_ITEMS_UNFREEZE_COLUMN);
  },
  callback(this: PluginHost, key, selected) {
    const [{ start: { col: selectedColumn } }] = selected;

    manualColumnFreezePlugin.unfreezeColumn(selectedColumn);

    this.render();
    this.view.wt.wtOverlays.adjustElementsSize(true);
  },
  hidden(this: PluginHost) {
    const selection = this.getSelectedRange();

    return selection === undefined || selection.length > 1 || selection[0].from.col !== selection[0].to.col
      || selection[0].from.col >= this.getSettings().fixedColumnsLeft;
  },
});

export default unfreezeColumnItem;
