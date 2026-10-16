import './formulaBar.css';
import BasePlugin from './../_base';
import { registerPlugin } from './../../plugins';
import { spreadsheetColumnLabel } from './../../helpers/data';

/** `F6` → `[5, 5]` (visual row and column), or `null`. */
const parseAddress = (text: string): [number, number] | null => {
  const match = /^\s*([A-Za-z]+)\s*([1-9][0-9]*)\s*$/.exec(text);

  if (!match) {
    return null;
  }
  const column = match[1].toUpperCase().split('').reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;

  return [Number(match[2]) - 1, column];
};

const address = (row: number, column: number): string => `${spreadsheetColumnLabel(column)}${row + 1}`;

/**
 * The formula bar: a bar above the grid, as in Excel, with the selected cell's address and its value (a formula
 * shows as its formula). Typing in the bar and pressing Enter writes the cell; Escape cancels. Typing an address
 * (`F6`) in the name box and pressing Enter selects that cell.
 *
 * ```js
 * new FreeSheet(container, { data, formulaBar: true });
 * ```
 */
class FormulaBar extends BasePlugin {
  /** The bar's element, while the plugin is enabled. */
  element: HTMLDivElement | null = null;
  nameBox: HTMLInputElement | null = null;
  input: HTMLInputElement | null = null;
  /** The cell the bar shows, as visual coordinates. */
  #cell: [number, number] | null = null;
  #mirroredEditors = new WeakSet<HTMLTextAreaElement>();

  isEnabled(): boolean {
    return !!this.hot.getSettings().formulaBar;
  }

  enablePlugin(): void {
    if (this.enabled) {
      return;
    }
    this.createElement();
    this.addHook('afterSelectionEnd', () => this.refresh());
    this.addHook('afterDeselect', () => this.refresh());
    this.addHook('afterChange', () => this.refresh());
    this.addHook('afterLoadData', () => this.refresh());
    this.addHook('afterBeginEditing', () => this.mirrorEditor());
    this.addHook('afterRender', () => this.matchGridWidth());

    super.enablePlugin();
    this.refresh();
  }

  disablePlugin(): void {
    this.removeElement();
    super.disablePlugin();
  }

  updatePlugin(): void {
    this.disablePlugin();
    this.enablePlugin();
    super.updatePlugin();
  }

  destroy(): void {
    this.removeElement();
    super.destroy();
  }

  createElement(): void {
    const root = this.hot.rootElement;
    const bar = document.createElement('div');

    bar.className = 'fs-formula-bar';
    bar.innerHTML = '<input class="fs-formula-bar__name" type="text" aria-label="Cell address" spellcheck="false">' +
      '<span class="fs-formula-bar__fx" aria-hidden="true">fx</span>' +
      '<input class="fs-formula-bar__input" type="text" aria-label="Cell value or formula" spellcheck="false">';

    this.element = bar;
    this.nameBox = bar.querySelector('.fs-formula-bar__name');
    this.input = bar.querySelector('.fs-formula-bar__input');

    // A click in the bar is not a click outside the grid: the selection stays.
    bar.addEventListener('mousedown', event => event.stopPropagation());
    // While the bar has the focus, the grid does not take the keyboard, and the bar's keys never reach the grid (an
    // Enter that writes the cell would otherwise also open the cell's editor once the grid listens again).
    bar.addEventListener('focusin', () => this.hot.unlisten());
    bar.addEventListener('keydown', event => event.stopPropagation());
    this.input!.addEventListener('keydown', event => this.onInputKeyDown(event));
    this.nameBox!.addEventListener('keydown', event => this.onNameKeyDown(event));

    root.parentNode?.insertBefore(bar, root);
    this.matchGridWidth();
  }

  /** The bar is as wide as the drawn grid (its table and vertical scrollbar), not as its container. */
  matchGridWidth(): void {
    const wtTable = this.hot.view?.wt?.wtTable;

    if (!this.element || !wtTable) {
      return;
    }
    const holder = wtTable.holder as HTMLElement;
    const scrollbar = holder.offsetWidth - holder.clientWidth;
    const width = Math.min(this.hot.rootElement.offsetWidth, (wtTable.TABLE as HTMLElement).offsetWidth + scrollbar);

    this.element.style.width = width > 0 ? `${width}px` : '';
  }

  removeElement(): void {
    this.element?.remove();
    this.element = null;
    this.nameBox = null;
    this.input = null;
    this.#cell = null;
  }

  /** Shows the selected cell's address and value. */
  refresh(): void {
    if (!this.element) {
      return;
    }
    // The grid's theme and style classes, so the bar looks like the grid.
    const themeClasses = Array.from(this.hot.rootElement.classList).filter(name => /^fs-(theme|style)-/.test(name));

    this.element.className = ['fs-formula-bar', ...themeClasses].join(' ');

    const selected = this.hot.getSelectedLast();

    if (!selected) {
      this.#cell = null;
      this.nameBox!.value = '';
      this.input!.value = '';

      return;
    }
    const [row, column, row2, column2] = selected;
    const top = Math.max(0, Math.min(row, row2));
    const left = Math.max(0, Math.min(column, column2));
    const bottom = Math.max(row, row2);
    const right = Math.max(column, column2);

    this.#cell = [Math.max(0, row), Math.max(0, column)];
    this.nameBox!.value = top === bottom && left === right ? address(top, left) :
      `${address(top, left)}:${address(bottom, right)}`;
    this.input!.value = this.sourceText(this.#cell[0], this.#cell[1]);
  }

  /** The cell's source value as text (a formula as its formula). */
  sourceText(row: number, column: number): string {
    const physicalRow = this.hot.toPhysicalRow(row);
    const value = physicalRow === null ? null : this.hot.getSourceDataAtCell(physicalRow, column);

    return value === null || value === void 0 ? '' : String(value);
  }

  /** Writes the bar's text to the cell and gives the keyboard back to the grid. */
  confirm(): void {
    (document.activeElement as HTMLElement | null)?.blur();
    if (this.#cell && this.input) {
      const [row, column] = this.#cell;

      if (this.input.value !== this.sourceText(row, column)) {
        this.hot.setDataAtCell(row, column, this.input.value, 'formulaBar');
      }
      this.hot.selectCell(row, column);
    }
    this.hot.listen();
    this.refresh();
  }

  /** Restores the cell's value in the bar and gives the keyboard back to the grid. */
  cancel(): void {
    (document.activeElement as HTMLElement | null)?.blur();
    this.refresh();
    this.hot.listen();
  }

  onInputKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.confirm();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancel();
    }
  }

  onNameKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      const cell = parseAddress(this.nameBox!.value);

      this.nameBox!.blur();

      if (cell && cell[0] < this.hot.countRows() && cell[1] < this.hot.countCols()) {
        this.hot.selectCell(cell[0], cell[1]);
      }
      this.hot.listen();
      this.refresh();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancel();
    }
  }

  /** While the cell is edited in the grid, the bar shows what is typed. */
  mirrorEditor(): void {
    const textarea = (this.hot.getActiveEditor() as { TEXTAREA?: HTMLTextAreaElement } | undefined)?.TEXTAREA;

    if (!textarea || this.#mirroredEditors.has(textarea)) {
      return;
    }
    this.#mirroredEditors.add(textarea);
    textarea.addEventListener('input', () => {
      if (this.input && this.enabled) {
        this.input.value = textarea.value;
      }
    });
  }
}

registerPlugin('formulaBar', FormulaBar);

export default FormulaBar;
