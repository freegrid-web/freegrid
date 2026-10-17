import * as C from './../../../i18n/constants';
import type CopyPaste from './../copyPaste';
import type { MenuItem } from './../../contextMenu/menuItem';
import type { PluginHost } from './../../_base';

type PasteMode = Parameters<CopyPaste['pasteSpecial']>[0];

const noSelection = function noSelection(this: PluginHost): boolean {
  return !this.getSelectedLast();
};

/** The context menu entry that pastes what was copied (its values or formulas, with their formatting). */
export const pasteItem = (copyPastePlugin: CopyPaste): MenuItem => ({
  key: 'paste',
  name(this: PluginHost) {
    return this.getTranslatedPhrase(C.CONTEXTMENU_ITEMS_PASTE);
  },
  shortcut: 'Ctrl+V',
  callback() {
    void copyPastePlugin.pasteSpecial('all');
  },
  disabled: noSelection,
});

const option = (copyPastePlugin: CopyPaste, mode: PasteMode, label: string): MenuItem => ({
  key: `paste_special:${mode}`,
  name(this: PluginHost) {
    return this.getTranslatedPhrase(label);
  },
  callback() {
    void copyPastePlugin.pasteSpecial(mode);
  },
  disabled: noSelection,
});

/** Paste Special: only the values, only the formulas, only the formatting, or transposed. */
export const pasteSpecialItem = (copyPastePlugin: CopyPaste): MenuItem => ({
  key: 'paste_special',
  name(this: PluginHost) {
    return this.getTranslatedPhrase(C.CONTEXTMENU_ITEMS_PASTE_SPECIAL);
  },
  disabled: noSelection,
  submenu: {
    items: [
      option(copyPastePlugin, 'values', C.CONTEXTMENU_ITEMS_PASTE_VALUES),
      option(copyPastePlugin, 'formulas', C.CONTEXTMENU_ITEMS_PASTE_FORMULAS),
      option(copyPastePlugin, 'formats', C.CONTEXTMENU_ITEMS_PASTE_FORMATS),
      option(copyPastePlugin, 'transpose', C.CONTEXTMENU_ITEMS_PASTE_TRANSPOSE),
    ],
  },
});
