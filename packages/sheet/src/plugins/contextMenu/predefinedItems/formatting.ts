import { PALETTE, selectionHasToggle, setCellStyle, toggleCellStyle, type StyleToggle } from './../../../formatting/formatting';
import { markLabelAsSelected } from './../utils';
import { KEY as SEPARATOR } from './separator';
import * as C from './../../../i18n/constants';
import type { MenuItem } from './../menuItem';
import type { PluginHost } from './../../_base';

export const KEY = 'formatting';

type FormattingGrid = PluginHost & Parameters<typeof setCellStyle>[0];

/** An entry that toggles bold, italic, underline or strikethrough: checked when every selected cell has it. */
const toggleOption = (toggle: StyleToggle, label: string): MenuItem => ({
  key: `${KEY}:${toggle}`,
  name(this: PluginHost) {
    const text = this.getTranslatedPhrase(label);

    return selectionHasToggle(this as FormattingGrid, toggle) ? markLabelAsSelected(text) : text;
  },
  callback(this: PluginHost) {
    toggleCellStyle(this as FormattingGrid, toggle);
  },
});

/** The color entries of "Text color" (`color`) or "Fill color" (`background`), and one that removes the color. */
const colorMenu = (name: string, label: string, property: 'color' | 'background'): MenuItem => ({
  key: `${KEY}:${name}`,
  name(this: PluginHost) {
    return this.getTranslatedPhrase(label);
  },
  submenu: {
    items: [
      ...PALETTE.map((color, index) => ({
        key: `${KEY}:${name}:${name}_${index}`,
        name: () => `<span class="fs-swatch" style="background:${color}"></span>${color}`,
        callback(this: PluginHost) {
          setCellStyle(this as FormattingGrid, { [property]: color });
        },
      })),
      {
        key: `${KEY}:${name}:${name}_none`,
        name(this: PluginHost) {
          return this.getTranslatedPhrase(C.CONTEXTMENU_ITEMS_FORMAT_NO_COLOR);
        },
        callback(this: PluginHost) {
          setCellStyle(this as FormattingGrid, { [property]: null });
        },
      },
    ] as MenuItem[],
  },
});

/** The context menu entry with the formatting commands (disabled without a selection). */
const formattingItem = (): MenuItem => ({
  key: KEY,
  name(this: PluginHost) {
    return this.getTranslatedPhrase(C.CONTEXTMENU_ITEMS_FORMAT);
  },
  disabled(this: PluginHost) {
    return !this.getSelectedRange();
  },
  submenu: {
    items: [
      toggleOption('bold', C.CONTEXTMENU_ITEMS_FORMAT_BOLD),
      toggleOption('italic', C.CONTEXTMENU_ITEMS_FORMAT_ITALIC),
      toggleOption('underline', C.CONTEXTMENU_ITEMS_FORMAT_UNDERLINE),
      toggleOption('strikethrough', C.CONTEXTMENU_ITEMS_FORMAT_STRIKETHROUGH),
      { name: SEPARATOR },
      colorMenu('text_color', C.CONTEXTMENU_ITEMS_FORMAT_TEXT_COLOR, 'color'),
      colorMenu('fill_color', C.CONTEXTMENU_ITEMS_FORMAT_FILL_COLOR, 'background'),
      { name: SEPARATOR },
      {
        key: `${KEY}:clear`,
        name(this: PluginHost) {
          return this.getTranslatedPhrase(C.CONTEXTMENU_ITEMS_FORMAT_CLEAR);
        },
        callback(this: PluginHost) {
          setCellStyle(this as FormattingGrid, null);
        },
      },
    ],
  },
});

export default formattingItem;
