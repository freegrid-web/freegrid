import type { PluginHost } from './../_base';

/** A selected range, as menu item callbacks get it. */
export type SelectedRange = { start: { row: number; col: number }; end: { row: number; col: number } };

/**
 * An entry of the context menu (and the dropdown menus). Its functions run with the grid as `this`.
 */
export type MenuItem = {
  key?: string;
  // `getTranslatedPhrase` returns null for an unknown key (the menu then shows an empty label).
  name: string | ((this: PluginHost) => string | null);
  callback?: (this: PluginHost, key: string, selection: SelectedRange[], event?: MouseEvent) => void;
  disabled?: boolean | ((this: PluginHost) => boolean);
  hidden?: boolean | ((this: PluginHost) => boolean);
  submenu?: { items: MenuItem[] };
  /** An icon at the left: SVG (or other HTML) written by your code, never by users. */
  icon?: string;
  /** The keys that do the same, shown at the right (`'Ctrl+K'`; a Mac shows ⌘K). */
  shortcut?: string;
  [option: string]: unknown;
};
