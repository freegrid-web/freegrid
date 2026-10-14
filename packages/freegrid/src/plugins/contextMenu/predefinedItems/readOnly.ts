import { checkSelectionConsistency, markLabelAsSelected } from './../utils';
import * as C from './../../../i18n/constants';
import type { MenuItem } from './../menuItem';
import type { PluginHost } from './../../_base';

export const KEY = 'make_read_only';

const readOnlyItem = (): MenuItem => ({
  key: KEY,
  name(this: PluginHost) {
    let label = this.getTranslatedPhrase(C.CONTEXTMENU_ITEMS_READ_ONLY);
    const atLeastOneReadOnly = checkSelectionConsistency(this.getSelectedRange(), (row, col) => this.getCellMeta(row, col).readOnly);

    if (atLeastOneReadOnly) {
      label = markLabelAsSelected(label);
    }

    return label;
  },
  callback(this: PluginHost) {
    const ranges = this.getSelectedRange()!;
    const atLeastOneReadOnly = checkSelectionConsistency(ranges, (row, col) => this.getCellMeta(row, col).readOnly);

    ranges.forEach((range: { forAll(callback: (row: number, col: number) => void): void }) => {
      range.forAll((row, col) => {
        this.setCellMeta(row, col, 'readOnly', !atLeastOneReadOnly);
      });
    });

    this.render();
  },
  disabled(this: PluginHost) {
    return !(this.getSelectedRange() && !this.selection.isSelectedByCorner());
  },
});

export default readOnlyItem;
