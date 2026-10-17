import './statusBar.css';
import BasePlugin from './../_base';
import Hooks from './../../pluginHooks';
import { registerPlugin } from './../../plugins';
import * as C from './../../i18n/constants';
import { getWorkbook } from './../../workbook/workbook';
import type { PluginHost } from './../_base';

/** What the bar can show about the selected cells. */
export const STATUS_BAR_ITEMS = ['average', 'count', 'numericalCount', 'min', 'max', 'sum'] as const;

export type StatusBarItem = typeof STATUS_BAR_ITEMS[number];

const DEFAULT_ITEMS: StatusBarItem[] = ['average', 'count', 'sum'];

const LABELS: Record<StatusBarItem, string> = {
  average: C.STATUS_BAR_AVERAGE,
  count: C.STATUS_BAR_COUNT,
  numericalCount: C.STATUS_BAR_NUMERICAL_COUNT,
  min: C.STATUS_BAR_MIN,
  max: C.STATUS_BAR_MAX,
  sum: C.STATUS_BAR_SUM,
};

/** The hooks of every grid that change what the bar shows (the bar follows the active sheet). */
const SHEET_HOOKS = ['afterSelectionEnd', 'afterDeselect', 'afterChange', 'afterSetDataAtCell', 'afterLoadData'];

/** The figures of the selected cells: values (formula results), not empty, and the numbers among them. */
export const summarize = (grid: PluginHost): Record<StatusBarItem, number> & { cells: number } => {
  const values: unknown[] = [];
  const seen = new Set<string>();
  let cells = 0;

  (grid.getSelectedRange() || []).forEach((range) => {
    const from = range.getTopLeftCorner();
    const to = range.getBottomRightCorner();

    for (let row = Math.max(0, from.row); row <= Math.min(to.row, grid.countRows() - 1); row += 1) {
      for (let col = Math.max(0, from.col); col <= Math.min(to.col, grid.countCols() - 1); col += 1) {
        if (!seen.has(`${row}:${col}`)) {
          seen.add(`${row}:${col}`);
          cells += 1;
          values.push(grid.getDataAtCell(row, col));
        }
      }
    }
  });
  const filled = values.filter(value => value !== null && value !== void 0 && value !== '');
  const numbers = filled.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const sum = numbers.reduce((total, value) => total + value, 0);

  return {
    cells,
    count: filled.length,
    numericalCount: numbers.length,
    sum: numbers.length ? sum : NaN,
    average: numbers.length ? sum / numbers.length : NaN,
    min: numbers.length ? Math.min(...numbers) : NaN,
    max: numbers.length ? Math.max(...numbers) : NaN,
  };
};

/**
 * The status bar: a strip below the grid (below the sheet tabs), as in Excel, with the average, count and sum of the
 * selected cells, when more than one cell is selected. It follows the active sheet.
 *
 * ```js
 * new FreeSheet(container, { data, statusBar: true });
 * // or choose what it shows:
 * new FreeSheet(container, { data, statusBar: { items: ['sum', 'min', 'max'] } });
 * ```
 */
class StatusBar extends BasePlugin {
  /** The bar's element, while the plugin is enabled. */
  element: HTMLDivElement | null = null;
  #onSheetHook = (grid: PluginHost) => {
    if (grid === this.activeSheet()) {
      this.refresh();
    }
  };
  #hooks: [string, (this: PluginHost) => void][] = [];

  isEnabled(): boolean {
    // Sheets added to a document do not inherit the setting: the document's grid has the bar.
    return !!this.hot.getSettings().statusBar;
  }

  enablePlugin(): void {
    if (this.enabled) {
      return;
    }
    const onSheetHook = this.#onSheetHook;

    this.createElement();
    this.#hooks = SHEET_HOOKS.map(name => [name, function onSheetHookOf(this: PluginHost) {
      onSheetHook(this);
    }]);
    // Every grid's hooks: the bar shows the active sheet, which may be another grid of the document.
    this.#hooks.forEach(([name, callback]) => Hooks.getSingleton().add(name, callback));
    this.addHook('afterSheetActivate', () => this.refresh());
    this.addHook('afterRender', () => this.matchGridWidth());
    super.enablePlugin();
    this.refresh();
  }

  disablePlugin(): void {
    this.#hooks.forEach(([name, callback]) => Hooks.getSingleton().remove(name, callback));
    this.#hooks = [];
    this.element?.remove();
    this.element = null;
    super.disablePlugin();
  }

  updatePlugin(): void {
    this.disablePlugin();
    this.enablePlugin();
    super.updatePlugin();
  }

  destroy(): void {
    this.disablePlugin();
    super.destroy();
  }

  /** The grid whose selection the bar shows. */
  activeSheet(): PluginHost {
    // Without a document yet, the grid itself (asking the grid would make a document before its sheets are read).
    const workbook = getWorkbook(this.hot as unknown as Parameters<typeof getWorkbook>[0]);

    return (workbook?.get(workbook.activeId)?.instance as unknown as PluginHost | undefined) || this.hot;
  }

  /** The items the `statusBar` setting asks for. */
  getItems(): StatusBarItem[] {
    const setting = this.hot.getSettings().statusBar as boolean | { items?: StatusBarItem[] };
    const items = typeof setting === 'object' && Array.isArray(setting.items) ? setting.items : DEFAULT_ITEMS;

    return items.filter(item => STATUS_BAR_ITEMS.includes(item));
  }

  createElement(): void {
    const bar = document.createElement('div');
    const root = this.hot.rootElement;
    const frame = root.parentElement?.classList.contains('fs-document') ? root.parentElement : null;

    bar.className = 'fs-status-bar';
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-live', 'polite');
    bar.addEventListener('mousedown', event => event.stopPropagation());
    // At the bottom of the document: below the sheets and their tabs.
    if (frame) {
      frame.appendChild(bar);
    } else {
      root.parentNode?.insertBefore(bar, root.nextSibling);
    }
    this.element = bar;
  }

  /** The bar is as wide as the drawn grid, as the formula bar is. */
  matchGridWidth(): void {
    const wtTable = this.hot.view?.wt?.wtTable;

    if (!this.element || !wtTable || this.element.parentElement?.classList.contains('fs-document')) {
      return;
    }
    const holder = wtTable.holder as HTMLElement;
    const width = Math.min(this.hot.rootElement.offsetWidth,
      (wtTable.TABLE as HTMLElement).offsetWidth + holder.offsetWidth - holder.clientWidth);

    this.element.style.width = width > 0 ? `${width}px` : '';
  }

  /** Shows the figures of the active sheet's selected cells (nothing for one cell or no numbers to count). */
  refresh(): void {
    if (!this.element) {
      return;
    }
    const themeClasses = Array.from(this.hot.rootElement.classList).filter(name => /^fs-(theme|style)-/.test(name));

    this.element.className = ['fs-status-bar', ...themeClasses].join(' ');
    const figures = summarize(this.activeSheet());
    const format = new Intl.NumberFormat(void 0, { maximumFractionDigits: 10 });

    this.element.textContent = '';
    if (figures.cells < 2 || figures.count === 0) {
      return;
    }
    this.getItems().forEach((item) => {
      const value = figures[item];

      // Average, minimum, maximum and sum need numbers (Excel leaves them out too).
      if (Number.isNaN(value)) {
        return;
      }
      const element = document.createElement('span');

      element.className = 'fs-status-bar__item';
      element.dataset.item = item;
      element.textContent = `${this.hot.getTranslatedPhrase(LABELS[item])}: ${format.format(value)}`;
      this.element!.appendChild(element);
    });
  }
}

registerPlugin('statusBar', StatusBar);

export default StatusBar;
