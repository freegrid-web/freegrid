import { previewCellStyle, selectionHasToggle, setCellStyle, toggleCellStyle, type StyleToggle }
  from './../../../formatting/formatting';
import { createPalette } from './../../../formatting/palette';
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

/** The palette of a grid, for `color` or `background`: pointing previews, clicking sets and closes the menu. */
export const paletteFor = (grid: PluginHost, property: 'color' | 'background', done: () => void): HTMLElement =>
  createPalette({
    labels: {
      theme: grid.getTranslatedPhrase(C.CONTEXTMENU_ITEMS_FORMAT_THEME_COLORS) as string,
      standard: grid.getTranslatedPhrase(C.CONTEXTMENU_ITEMS_FORMAT_STANDARD_COLORS) as string,
      none: grid.getTranslatedPhrase(C.CONTEXTMENU_ITEMS_FORMAT_NO_COLOR) as string,
      more: grid.getTranslatedPhrase(C.CONTEXTMENU_ITEMS_FORMAT_MORE_COLORS) as string,
    },
    preview: color => previewCellStyle(grid as FormattingGrid, color === void 0 ? void 0 : { [property]: color }),
    pick: (color) => {
      setCellStyle(grid as FormattingGrid, { [property]: color });
      done();
    },
  });

/** "Text color" (`color`) or "Fill color" (`background`): a submenu with a palette. */
const colorMenu = (name: string, label: string, property: 'color' | 'background'): MenuItem => ({
  key: `${KEY}:${name}`,
  name(this: PluginHost) {
    return this.getTranslatedPhrase(label);
  },
  submenu: {
    items: [{
      key: `${KEY}:${name}:palette`,
      name: '',
      isCommand: false,
      disableSelection: true,
      // `this` is the grid the menu belongs to (the first argument is the menu's own table).
      renderer(this: PluginHost) {
        return paletteFor(this, property, () => this.getPlugin('contextMenu').close());
      },
    }] as MenuItem[],
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
