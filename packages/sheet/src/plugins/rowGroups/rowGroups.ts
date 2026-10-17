import './rowGroups.css';
import BasePlugin from './../_base';
import { registerPlugin } from './../../plugins';
import { getTranslator } from './../../utils/recordTranslator';
import { stopImmediatePropagation } from './../../helpers/dom/event';
import * as C from './../../i18n/constants';
import type { IndexVisibility } from './../../utils/indexVisibility';
import type { MenuItem } from './../contextMenu/menuItem';

const SOURCE = 'rowGroups';
/** The width of one level in the row headers' gutter. */
const LEVEL_WIDTH = 14;
/** Excel's limit. */
const MAX_LEVELS = 7;

/** A group of rows (physical indexes, inclusive). */
type Group = { start: number; end: number; collapsed: boolean };

/** A group as the API gives it: data rows, its level (1 for the outermost) and whether it is collapsed. */
export type RowGroup = { from: number; to: number; level: number; collapsed: boolean };

/** The saved form of the groups (`getDocument`, Excel files): rows as indexes of the data. */
type RowGroupsSettings = { groups?: { from: number; to: number; collapsed?: boolean }[] };

/**
 * Row groups, as a spreadsheet's outline (Data ▸ Group): any adjacent rows can be grouped, groups can hold groups (up
 * to 7 levels), and a group collapses to hide its rows. The data stays flat.
 *
 * - The row headers get a gutter: a bracket along each group's rows and a −/+ button on the row after the group (the
 *   row before it, when the group ends the sheet). The corner has a button for each level: 1 shows only the
 *   outermost rows, 2 one level more, and so on.
 * - The context menu gets Group rows and Ungroup rows; Alt+Shift+→ groups the selected rows, Alt+Shift+← ungroups
 *   them.
 * - `getDocument()` and Excel files keep the groups.
 *
 * ```js
 * const grid = new FreeSheet(container, { data, rowHeaders: true, colHeaders: true, rowGroups: true });
 * grid.getPlugin('rowGroups').groupRows(1, 4);
 * ```
 */
class RowGroups extends BasePlugin {
  #groups: Group[] = [];

  get visibility(): IndexVisibility {
    return getTranslator(this.hot).rows!;
  }

  isEnabled(): boolean {
    return !!this.hot.getSettings().rowGroups;
  }

  enablePlugin(): void {
    if (this.enabled) {
      return;
    }
    this.addHook('afterGetRowHeader', (row: number, TH: HTMLTableCellElement) => this.decorateRowHeader(row, TH));
    this.addHook('afterGetColHeader', (column: number, TH: HTMLTableCellElement) => this.decorateCorner(column, TH));
    this.addHook('modifyRowHeaderWidth', (width: number) => this.onModifyRowHeaderWidth(width));
    this.addHook('afterCreateRow', (index: number, amount: number) => this.onAfterCreateRow(index, amount));
    this.addHook('beforeRemoveRow', (_row: number, _amount: number, physicalRows: number[] = []) =>
      this.onBeforeRemoveRow(physicalRows));
    this.addHook('afterRemoveRow', () => this.update(false));
    // New data has the groups of the setting (none for `true`; a document's saved groups).
    this.addHook('afterLoadData', (_data: unknown, initialLoad: boolean) => {
      if (!initialLoad) {
        this.readSetting();
      }
    });
    this.addHook('beforeKeyDown', (event: KeyboardEvent) => this.onBeforeKeyDown(event));
    this.addHook('afterContextMenuDefaultOptions', (options: { items: MenuItem[] }) => this.addMenuItems(options));
    this.hot.rootElement.addEventListener('mousedown', this.onMouseDown, true);
    this.hot.rootElement.classList.add('fs-row-groups');
    super.enablePlugin();
    this.readSetting();
  }

  disablePlugin(): void {
    this.hot.rootElement.removeEventListener('mousedown', this.onMouseDown, true);
    this.hot.rootElement.classList.remove('fs-row-groups');
    this.#groups = [];
    this.visibility.setHidden(SOURCE, null);
    super.disablePlugin();
  }

  updatePlugin(): void {
    if (this.hot.getSettings().rowGroups && typeof this.hot.getSettings().rowGroups === 'object') {
      this.readSetting();
    }
    super.updatePlugin();
  }

  destroy(): void {
    this.hot.rootElement?.removeEventListener('mousedown', this.onMouseDown, true);
    super.destroy();
  }

  /** The groups of the saved form (`rowGroups: { groups }`). */
  readSetting(): void {
    const setting = this.hot.getSettings().rowGroups as boolean | RowGroupsSettings;
    const groups = typeof setting === 'object' && Array.isArray(setting.groups) ? setting.groups : [];

    this.#groups = groups.filter(({ from, to }) => Number.isInteger(from) && Number.isInteger(to) && from <= to)
      .map(({ from, to, collapsed }) => ({ start: from, end: to, collapsed: !!collapsed }));
    this.sortGroups();
    this.update(false);
  }

  // -- Groups -------------------------------------------------------------------------------------------------------

  /** Outer groups first, then by their first row. */
  sortGroups(): void {
    this.#groups.sort((a, b) => a.start - b.start || b.end - a.end);
  }

  /** How many groups hold the group (itself included): 1 for an outermost group. */
  levelOf(group: Group): number {
    return this.#groups.filter(other => other.start <= group.start && other.end >= group.end).length;
  }

  /** The deepest level. */
  maxLevel(): number {
    return this.#groups.reduce((deepest, group) => Math.max(deepest, this.levelOf(group)), 0);
  }

  /** The row the group's −/+ button is on: the row after it, or the row before it at the end of the data. */
  toggleRowOf(group: Group): number | null {
    const total = this.hot.countSourceRows();

    if (group.end + 1 < total) {
      return group.end + 1;
    }

    return group.start > 0 ? group.start - 1 : null;
  }

  /**
   * The groups, outermost first: their first and last row as rows of the data (`getSourceData`; the rows a collapsed
   * group hides have no visual index), their level and whether they are collapsed.
   */
  getGroups(): RowGroup[] {
    return this.#groups.map(group => ({ from: group.start, to: group.end, level: this.levelOf(group),
      collapsed: group.collapsed }));
  }

  /** The groups in their saved form (data rows), for `getDocument`. */
  getSavedGroups(): { from: number; to: number; collapsed?: boolean }[] {
    return this.#groups.map(({ start, end, collapsed }) => ({ from: start, to: end, ...(collapsed ? { collapsed } :
      {}) }));
  }

  toPhysical(visual: number): number {
    return this.hot.toPhysicalRow(visual) ?? visual;
  }

  /**
   * Groups rows (visual indexes, as many as from `from` to `to`). A group like an existing one is not added twice;
   * more than 7 levels are not made.
   *
   * @param from The first row.
   * @param to The last row.
   */
  groupRows(from: number, to: number = from): void {
    const start = this.toPhysical(Math.min(from, to));
    const end = this.toPhysical(Math.max(from, to));
    const group = { start, end, collapsed: false };

    if (this.#groups.some(other => other.start === start && other.end === end) ||
      this.levelOf(group) + 1 > MAX_LEVELS) {
      return;
    }
    this.#groups.push(group);
    this.sortGroups();
    this.update();
  }

  /**
   * Ungroups rows: removes the groups inside the rows from `from` to `to`, or else the innermost group that holds
   * them.
   *
   * @param from The first row.
   * @param to The last row.
   */
  ungroupRows(from: number, to: number = from): void {
    const start = this.toPhysical(Math.min(from, to));
    const end = this.toPhysical(Math.max(from, to));
    const inside = this.#groups.filter(group => group.start >= start && group.end <= end);
    const holding = this.#groups.filter(group => group.start <= start && group.end >= end)
      .sort((a, b) => (a.end - a.start) - (b.end - b.start))[0];
    const removed = inside.length ? inside : holding ? [holding] : [];

    this.#groups = this.#groups.filter(group => !removed.includes(group));
    this.update();
  }

  /** The innermost group whose rows or whose −/+ row is the row (visual index). */
  groupAt(row: number): Group | undefined {
    const physical = this.toPhysical(row);

    return this.#groups.filter(group => (group.start <= physical && group.end >= physical) ||
      this.toggleRowOf(group) === physical).sort((a, b) => (a.end - a.start) - (b.end - b.start))[0];
  }

  /** Collapses the group of a row (visual index): its rows are hidden. */
  collapseGroup(row: number): void {
    this.setCollapsed(this.groupAt(row), true);
  }

  /** Expands the group of a row (visual index). */
  expandGroup(row: number): void {
    this.setCollapsed(this.groupAt(row), false);
  }

  setCollapsed(group: Group | undefined, collapsed: boolean): void {
    if (group && group.collapsed !== collapsed) {
      group.collapsed = collapsed;
      this.update();
    }
  }

  /** Shows the outline down to a level: the groups deeper than it collapse, the others expand (1: the outermost). */
  showLevel(level: number): void {
    this.#groups.forEach((group) => {
      group.collapsed = this.levelOf(group) >= level;
    });
    this.update();
  }

  expandAll(): void {
    this.#groups.forEach((group) => {
      group.collapsed = false;
    });
    this.update();
  }

  /** Hides the rows of collapsed groups and draws the grid again. */
  update(render = true): void {
    const hidden = new Set<number>();

    this.#groups.filter(group => group.collapsed).forEach((group) => {
      for (let row = group.start; row <= group.end; row += 1) {
        hidden.add(row);
      }
    });
    this.visibility.setHidden(SOURCE, hidden.size ? hidden : null);
    if (render && this.hot.view) {
      this.hot.forceFullRender = true;
      this.hot.render();
      this.hot.view.wt.wtOverlays.adjustElementsSize(true);
      this.hot.render();
    }
  }

  // -- Rows added and removed -----------------------------------------------------------------------------------------

  onAfterCreateRow(index: number, amount: number): void {
    const physical = this.toPhysical(index);

    this.#groups.forEach((group) => {
      if (group.start >= physical) {
        group.start += amount;
        group.end += amount;
      } else if (group.end >= physical) {
        group.end += amount;
      }
    });
    this.update(false);
  }

  onBeforeRemoveRow(physicalRows: number[]): void {
    const removed = [...physicalRows].sort((a, b) => a - b);
    const before = (row: number) => removed.filter(index => index < row).length;

    this.#groups = this.#groups.map((group) => {
      const inside = removed.filter(row => row >= group.start && row <= group.end).length;

      return { ...group, start: group.start - before(group.start), end: group.end - before(group.start) - inside };
    }).filter(group => group.end >= group.start);
  }

  // -- Drawing --------------------------------------------------------------------------------------------------------

  onModifyRowHeaderWidth(width: number): number {
    const levels = this.maxLevel();

    return levels ? Math.max(width || 50, 50) + levels * LEVEL_WIDTH : width;
  }

  /** The gutter of a row header: the groups' brackets and −/+ buttons, one column per level. */
  decorateRowHeader(row: number, TH: HTMLTableCellElement): void {
    const container = (TH.firstElementChild || TH) as HTMLElement;

    TH.querySelector('.fs-row-groups__gutter')?.remove();
    container.style.paddingLeft = row >= 0 && this.#groups.length ? `${this.maxLevel() * LEVEL_WIDTH}px` : '';
    if (row < 0 || !this.#groups.length) {
      return;
    }
    const physical = this.toPhysical(row);
    const gutter = document.createElement('span');

    gutter.className = 'fs-row-groups__gutter';
    gutter.style.width = `${this.maxLevel() * LEVEL_WIDTH}px`;
    this.#groups.forEach((group, index) => {
      const level = this.levelOf(group);
      const left = `${(level - 1) * LEVEL_WIDTH}px`;

      if (!group.collapsed && physical >= group.start && physical <= group.end) {
        const line = document.createElement('span');

        line.className = `fs-row-groups__line${physical === group.end ? ' fs-row-groups__line--end' : ''}${
          physical === group.start ? ' fs-row-groups__line--start' : ''}`;
        line.style.left = left;
        gutter.appendChild(line);
      }
      if (this.toggleRowOf(group) === physical) {
        const toggle = document.createElement('span');
        const label = this.hot.getTranslatedPhrase(group.collapsed ? C.ROW_GROUPS_EXPAND : C.ROW_GROUPS_COLLAPSE);

        toggle.className = `fs-row-groups__toggle${group.collapsed ? ' fs-row-groups__toggle--collapsed' : ''}`;
        toggle.setAttribute('role', 'button');
        toggle.setAttribute('aria-expanded', String(!group.collapsed));
        toggle.setAttribute('aria-label', String(label));
        toggle.title = String(label);
        toggle.dataset.group = String(index);
        toggle.textContent = group.collapsed ? '+' : '−';
        toggle.style.left = left;
        gutter.appendChild(toggle);
      }
    });
    TH.classList.add('fs-row-groups__header');
    TH.insertBefore(gutter, TH.firstChild);
  }

  /** The corner's level buttons (1, 2, …: show the outline down to that level). */
  decorateCorner(column: number, TH: HTMLTableCellElement): void {
    TH.querySelector('.fs-row-groups__levels')?.remove();
    if (column !== -1 || !this.#groups.length) {
      return;
    }
    const levels = document.createElement('span');

    levels.className = 'fs-row-groups__levels';
    for (let level = 1; level <= this.maxLevel() + 1; level += 1) {
      const button = document.createElement('span');

      button.className = 'fs-row-groups__level';
      button.setAttribute('role', 'button');
      button.setAttribute('aria-label', String(this.hot.getTranslatedPhrase(C.ROW_GROUPS_LEVEL)).replace('{level}',
        String(level)));
      button.dataset.level = String(level);
      button.textContent = String(level);
      levels.appendChild(button);
    }
    TH.insertBefore(levels, TH.firstChild);
  }

  onMouseDown = (event: MouseEvent): void => {
    const target = event.button === 0 ?
      (event.target as HTMLElement).closest<HTMLElement>('.fs-row-groups__toggle, .fs-row-groups__level') : null;

    if (!target || !this.hot.rootElement.contains(target)) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (target.dataset.level) {
      this.showLevel(Number(target.dataset.level));
    } else {
      const group = this.#groups[Number(target.dataset.group)];

      this.setCollapsed(group, !!group && !group.collapsed);
    }
  };

  /** Alt+Shift+→ groups the selected rows, Alt+Shift+← ungroups them (as in Excel). */
  onBeforeKeyDown(event: KeyboardEvent): void {
    const selected = this.hot.getSelectedLast();
    const left = event.key === 'ArrowLeft' || event.keyCode === 37;
    const right = event.key === 'ArrowRight' || event.keyCode === 39;

    if (!selected || !event.altKey || !event.shiftKey || (!left && !right)) {
      return;
    }
    event.preventDefault();
    stopImmediatePropagation(event);
    if (right) {
      this.groupRows(Math.max(0, selected[0]), Math.max(0, selected[2]));
    } else {
      this.ungroupRows(Math.max(0, selected[0]), Math.max(0, selected[2]));
    }
  }

  addMenuItems(options: { items: MenuItem[] }): void {
    const rows = () => {
      const [r1, , r2] = this.hot.getSelectedLast() || [0, 0, 0];

      return [Math.max(0, Math.min(r1, r2)), Math.max(0, Math.max(r1, r2))] as const;
    };

    options.items.push({ name: '---------' } as MenuItem, {
      key: 'row_groups_group',
      name: () => String(this.hot.getTranslatedPhrase(C.ROW_GROUPS_GROUP)),
      callback: () => this.groupRows(...rows()),
      disabled: () => !this.hot.getSelectedLast(),
    } as MenuItem, {
      key: 'row_groups_ungroup',
      name: () => String(this.hot.getTranslatedPhrase(C.ROW_GROUPS_UNGROUP)),
      callback: () => this.ungroupRows(...rows()),
      disabled: () => {
        const [from, to] = rows();
        const start = this.toPhysical(from);
        const end = this.toPhysical(to);

        return !this.#groups.some(group => (group.start >= start && group.end <= end) ||
          (group.start <= start && group.end >= end));
      },
    } as MenuItem);
  }
}

registerPlugin('rowGroups', RowGroups);

export default RowGroups;
