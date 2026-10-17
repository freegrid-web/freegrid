import * as C from './../../../i18n/constants';
import { addItem } from './../../contextMenu/predefinedItems';
import type CopyPaste from './../copyPaste';
import type { MenuItem } from './../../contextMenu/menuItem';
import type { PluginHost } from './../../_base';

type PasteMode = Parameters<CopyPaste['pasteSpecial']>[0];

const noSelection = function noSelection(this: PluginHost): boolean {
  return !this.getSelectedLast() || !this.getPlugin('copyPaste')?.enabled;
};

const paste = (grid: PluginHost, mode: PasteMode): void => {
  void (grid.getPlugin('copyPaste') as unknown as CopyPaste).pasteSpecial(mode);
};

/** The context menu entry that pastes what was copied (its values or formulas, with their formatting). */
export const pasteItem = (): MenuItem => ({
  key: 'paste',
  name(this: PluginHost) {
    return this.getTranslatedPhrase(C.CONTEXTMENU_ITEMS_PASTE);
  },
  shortcut: 'Ctrl+V',
  callback(this: PluginHost) {
    paste(this, 'all');
  },
  disabled: noSelection,
});

const option = (mode: PasteMode, label: string): MenuItem => ({
  key: `paste_special:${mode}`,
  name(this: PluginHost) {
    return this.getTranslatedPhrase(label);
  },
  callback(this: PluginHost) {
    paste(this, mode);
  },
  disabled: noSelection,
});

/** Paste Special: only the values, only the formulas, only the formatting, or transposed. */
export const pasteSpecialItem = (): MenuItem => ({
  key: 'paste_special',
  name(this: PluginHost) {
    return this.getTranslatedPhrase(C.CONTEXTMENU_ITEMS_PASTE_SPECIAL);
  },
  disabled: noSelection,
  submenu: {
    items: [
      option('values', C.CONTEXTMENU_ITEMS_PASTE_VALUES),
      option('formulas', C.CONTEXTMENU_ITEMS_PASTE_FORMULAS),
      option('formats', C.CONTEXTMENU_ITEMS_PASTE_FORMATS),
      option('transpose', C.CONTEXTMENU_ITEMS_PASTE_TRANSPOSE),
    ],
  },
});

// Not in the default menu: add the keys 'paste' and 'paste_special' to `contextMenu`.
addItem('paste', pasteItem);
addItem('paste_special', pasteSpecialItem);
