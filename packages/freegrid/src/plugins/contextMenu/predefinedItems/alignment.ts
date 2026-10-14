import { classNameIncludes } from './../../../helpers/classNames';
import { align, getAlignmentClasses, checkSelectionConsistency, markLabelAsSelected } from './../utils';
import { KEY as SEPARATOR } from './separator';
import * as C from './../../../i18n/constants';
import type { MenuItem } from './../menuItem';
import type { PluginHost } from './../../_base';

export const KEY = 'alignment';

/**
 * The entry that aligns the selected cells (`fg-left`, `fg-top`, …): checked when a selected cell has that alignment.
 * The `beforeCellAlignment` hook gets the alignment before the change (for undo).
 */
const alignmentOption = (name: string, label: string, type: 'horizontal' | 'vertical', className: string): MenuItem => ({
  key: `${KEY}:${name}`,
  name(this: PluginHost) {
    const text = this.getTranslatedPhrase(label);
    const hasClass = checkSelectionConsistency(this.getSelectedRange(), (row: number, col: number) => {
      const cellClassName = this.getCellMeta(row, col).className;

      return cellClassName && classNameIncludes(cellClassName, className) ? true : undefined;
    });

    return hasClass ? markLabelAsSelected(text) : text;
  },
  callback(this: PluginHost) {
    const selectedRange = this.getSelectedRange()!;
    const stateBefore = getAlignmentClasses(selectedRange, (row: number, col: number) => this.getCellMeta(row, col).className);

    this.runHooks('beforeCellAlignment', stateBefore, selectedRange, type, className);
    align(selectedRange, type, className, (row: number, col: number) => this.getCellMeta(row, col),
      (row: number, col: number, key: string, value: unknown) => this.setCellMeta(row, col, key, value));
    this.render();
  },
  disabled: false,
});

/** The context menu entry with the alignment options (disabled without a selection or for the whole table). */
const alignmentItem = (): MenuItem => ({
  key: KEY,
  name(this: PluginHost) {
    return this.getTranslatedPhrase(C.CONTEXTMENU_ITEMS_ALIGNMENT);
  },
  disabled(this: PluginHost) {
    return !(this.getSelectedRange() && !this.selection.isSelectedByCorner());
  },
  submenu: {
    items: [
      alignmentOption('left', C.CONTEXTMENU_ITEMS_ALIGNMENT_LEFT, 'horizontal', 'fg-left'),
      alignmentOption('center', C.CONTEXTMENU_ITEMS_ALIGNMENT_CENTER, 'horizontal', 'fg-center'),
      alignmentOption('right', C.CONTEXTMENU_ITEMS_ALIGNMENT_RIGHT, 'horizontal', 'fg-right'),
      alignmentOption('justify', C.CONTEXTMENU_ITEMS_ALIGNMENT_JUSTIFY, 'horizontal', 'fg-justify'),
      { name: SEPARATOR },
      alignmentOption('top', C.CONTEXTMENU_ITEMS_ALIGNMENT_TOP, 'vertical', 'fg-top'),
      alignmentOption('middle', C.CONTEXTMENU_ITEMS_ALIGNMENT_MIDDLE, 'vertical', 'fg-middle'),
      alignmentOption('bottom', C.CONTEXTMENU_ITEMS_ALIGNMENT_BOTTOM, 'vertical', 'fg-bottom'),
    ],
  },
});

export default alignmentItem;
