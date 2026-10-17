import * as C from './../../../i18n/constants';
import type { MenuItem } from './../menuItem';
import type { PluginHost } from './../../_base';

export const KEY = 'freeze';

/** Freezes rows above and columns left of a cell (`fixedRowsTop` and `fixedColumnsLeft`). */
const freeze = (grid: PluginHost, rows: number, columns: number): void => {
  grid.updateSettings({ fixedRowsTop: rows, fixedColumnsLeft: columns });
};

const option = (name: string, label: string, callback: (grid: PluginHost) => void,
  disabled?: (grid: PluginHost) => boolean): MenuItem => ({
  key: `${KEY}:${name}`,
  name(this: PluginHost) {
    return this.getTranslatedPhrase(label);
  },
  callback(this: PluginHost) {
    callback(this);
  },
  disabled(this: PluginHost) {
    return disabled ? disabled(this) : false;
  },
});

/**
 * The context menu entry that freezes rows and columns, as in Excel: at the selected cell (the rows above it and the
 * columns left of it), the top row, the first column, or nothing (disabled without a selection).
 */
const freezeItem = (): MenuItem => ({
  key: KEY,
  name(this: PluginHost) {
    return this.getTranslatedPhrase(C.CONTEXTMENU_ITEMS_FREEZE);
  },
  disabled(this: PluginHost) {
    return !this.getSelectedLast();
  },
  submenu: {
    items: [
      option('panes', C.CONTEXTMENU_ITEMS_FREEZE_PANES, (grid) => {
        const [row, col] = grid.getSelectedLast()!;

        freeze(grid, Math.max(0, row), Math.max(0, col));
      }),
      option('top_row', C.CONTEXTMENU_ITEMS_FREEZE_TOP_ROW, grid => freeze(grid, 1, 0)),
      option('first_column', C.CONTEXTMENU_ITEMS_FREEZE_FIRST_COLUMN, grid => freeze(grid, 0, 1)),
      option('unfreeze', C.CONTEXTMENU_ITEMS_UNFREEZE, grid => freeze(grid, 0, 0),
        grid => !grid.getSettings().fixedRowsTop && !grid.getSettings().fixedColumnsLeft),
    ],
  },
});

export default freezeItem;
