import './changesPanel';
import BasePlugin from './../_base';
import { registerPlugin } from './../../plugins';
import { addItem } from './../contextMenu/predefinedItems';
import * as C from './../../i18n/constants';
import type { MenuItem } from './../contextMenu/menuItem';
import type { PluginHost } from './../_base';

/** A cell's change: its data row and column, and its value before and after. */
export type CellChange = { row: number; col: number; before: unknown; after: unknown };

/**
 * One recorded change: an edit of cells (typing, a paste, a fill, Replace all, an undo), or rows or columns added or
 * removed. `time` is a timestamp (ms), `user` the name from the setting.
 */
export type ChangeEntry = {
  id: number;
  time: number;
  user?: string;
  kind: 'edit' | 'insert_row' | 'remove_row' | 'insert_col' | 'remove_col';
  /** The changed cells (an edit). */
  cells: CellChange[];
  /** Where rows or columns were added or removed, and how many (visual index at that time). */
  index?: number;
  amount?: number;
  /** What made the change (`'edit'`, `'CopyPaste.paste'`, `'UndoRedo.undo'`, …). */
  source?: string;
};

type ChangeHistorySettings = { user?: string; limit?: number };

/** Changes the history does not record: loading data is not editing it. */
const IGNORED_SOURCES = ['loadData', 'updateData', 'ObserveChanges.change', 'populateFromArray.loadData'];

let nextId = 1;

/**
 * The change history ("Show Changes"): every edit of the grid's cells (old and new value), and rows and columns added
 * and removed, with the time and the user's name. The side panel `'changes'` lists them, newest first, grouped by
 * day; a click selects the changed cells. The context menu entry `'show_changes'` opens it.
 *
 * ```js
 * new FreeSheet(container, { data, changeHistory: { user: 'Ada' }, sidePanel: true });
 * grid.openPanel('changes');
 * grid.getPlugin('changeHistory').getChanges();
 * ```
 */
class ChangeHistory extends BasePlugin {
  #entries: ChangeEntry[] = [];

  get settings(): ChangeHistorySettings {
    const setting = this.hot.getSettings().changeHistory;

    return setting && typeof setting === 'object' ? setting : {};
  }

  isEnabled(): boolean {
    return !!this.hot.getSettings().changeHistory;
  }

  enablePlugin(): void {
    if (this.enabled) {
      return;
    }
    this.addHook('afterChange', (changes: [number, string | number, unknown, unknown][] | null, source: string) =>
      this.onAfterChange(changes, source));
    this.addHook('afterCreateRow', (index: number, amount: number, source: string) =>
      this.record({ kind: 'insert_row', cells: [], index, amount, source }));
    this.addHook('afterRemoveRow', (index: number, amount: number, _rows: unknown, source: string) =>
      this.record({ kind: 'remove_row', cells: [], index, amount, source }));
    this.addHook('afterCreateCol', (index: number, amount: number, source: string) =>
      this.record({ kind: 'insert_col', cells: [], index, amount, source }));
    this.addHook('afterRemoveCol', (index: number, amount: number, _columns: unknown, source: string) =>
      this.record({ kind: 'remove_col', cells: [], index, amount, source }));
    super.enablePlugin();
  }

  disablePlugin(): void {
    this.#entries = [];
    super.disablePlugin();
  }

  /** The recorded changes, oldest first (copies). */
  getChanges(): ChangeEntry[] {
    return this.#entries.map(entry => ({ ...entry, cells: entry.cells.map(cell => ({ ...cell })) }));
  }

  /** Forgets the recorded changes. */
  clearChanges(): void {
    this.#entries = [];
    this.hot.runHooks('afterChangeRecorded', null);
  }

  onAfterChange(changes: [number, string | number, unknown, unknown][] | null, source: string): void {
    if (!changes || IGNORED_SOURCES.includes(source)) {
      return;
    }
    const cells = changes.filter(([, , before, after]) => before !== after && !(before == null && after === ''))
      .map(([row, prop, before, after]) => ({
        row: this.hot.toPhysicalRow(row) ?? row,
        col: this.hot.toPhysicalColumn(this.hot.propToCol(prop as never) as number) ?? (prop as number),
        before,
        after,
      }));

    if (cells.length) {
      this.record({ kind: 'edit', cells, source });
    }
  }

  record(entry: Omit<ChangeEntry, 'id' | 'time' | 'user'>): void {
    if (entry.source && IGNORED_SOURCES.includes(entry.source)) {
      return;
    }
    const { user, limit = 1000 } = this.settings;
    const recorded: ChangeEntry = { id: nextId, time: Date.now(), ...(user ? { user } : {}), ...entry };

    nextId += 1;
    this.#entries.push(recorded);
    if (this.#entries.length > Math.max(1, limit)) {
      this.#entries.splice(0, this.#entries.length - limit);
    }
    this.hot.runHooks('afterChangeRecorded', { ...recorded });
  }
}

// Not in the default menu: add the key 'show_changes' to `contextMenu`.
addItem('show_changes', (): MenuItem => ({
  key: 'show_changes',
  name(this: PluginHost) {
    return this.getTranslatedPhrase(C.CHANGES_SHOW);
  },
  callback(this: PluginHost) {
    (this as unknown as { openPanel(name: string): void }).openPanel('changes');
  },
  disabled(this: PluginHost) {
    return !this.getPlugin('changeHistory')?.enabled;
  },
}));

registerPlugin('changeHistory', ChangeHistory);

export default ChangeHistory;
