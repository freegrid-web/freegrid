import './formattingBar.css';
import BasePlugin from './../_base';
import { registerPlugin } from './../../plugins';
import { applyTheme } from './../../helpers/dom/theme';
import { selectionHasToggle, setCellStyle, toggleCellStyle, previewCellStyle,
  type StyleToggle } from './../../formatting/formatting';
import { paletteFor } from './../contextMenu/predefinedItems/formatting';
import { align, getAlignmentClasses } from './../contextMenu/utils';
import { classNameIncludes } from './../../helpers/classNames';
import * as C from './../../i18n/constants';

/** The buttons of the bar, in order. */
export const FORMATTING_BAR_ITEMS = ['bold', 'italic', 'underline', 'strikethrough', 'fill_color', 'text_color',
  'alignment', 'clear'] as const;

export type FormattingBarItem = typeof FORMATTING_BAR_ITEMS[number];

const DEFAULT_ITEMS: FormattingBarItem[] = ['bold', 'italic', 'underline', 'fill_color', 'text_color', 'alignment',
  'clear'];

const ICONS: Record<string, string> = {
  bold: '<b>B</b>',
  italic: '<i>I</i>',
  underline: '<u>U</u>',
  strikethrough: '<s>S</s>',
  fill_color: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5 8 3.5l4.5 4.5L8 12.5z" fill="none" ' +
    'stroke="currentColor" stroke-width="1.3"/><path d="M13.5 10.5c0 1-.6 1.6-1.2 1.6s-1.2-.6-1.2-1.6l1.2-1.9z" ' +
    'fill="currentColor"/></svg>',
  text_color: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 12 8 3l3.5 9M5.8 9h4.4" fill="none" ' +
    'stroke="currentColor" stroke-width="1.4"/></svg>',
  left: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 7h8M2 10h12M2 13h8" stroke="currentColor"/></svg>',
  center: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M4 7h8M2 10h12M4 13h8" stroke="currentColor"/></svg>',
  right: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M6 7h8M2 10h12M6 13h8" stroke="currentColor"/></svg>',
  clear: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 13h8M3.5 9.5 9 4l3.5 3.5L7 13H5z" fill="none" ' +
    'stroke="currentColor" stroke-width="1.3"/></svg>',
};

const LABELS: Record<string, string> = {
  bold: C.CONTEXTMENU_ITEMS_FORMAT_BOLD,
  italic: C.CONTEXTMENU_ITEMS_FORMAT_ITALIC,
  underline: C.CONTEXTMENU_ITEMS_FORMAT_UNDERLINE,
  strikethrough: C.CONTEXTMENU_ITEMS_FORMAT_STRIKETHROUGH,
  fill_color: C.CONTEXTMENU_ITEMS_FORMAT_FILL_COLOR,
  text_color: C.CONTEXTMENU_ITEMS_FORMAT_TEXT_COLOR,
  left: C.CONTEXTMENU_ITEMS_ALIGNMENT_LEFT,
  center: C.CONTEXTMENU_ITEMS_ALIGNMENT_CENTER,
  right: C.CONTEXTMENU_ITEMS_ALIGNMENT_RIGHT,
  clear: C.CONTEXTMENU_ITEMS_FORMAT_CLEAR,
};

type FormattingGrid = Parameters<typeof setCellStyle>[0];

/**
 * The formatting bar: a small toolbar that opens above the context menu, as in Excel, with bold, italic, underline,
 * fill and text colors (a palette that shows a color on the cells while the pointer is on it), alignment and clear
 * formatting. It closes with the menu.
 *
 * ```js
 * new FreeSheet(container, { data, contextMenu: true, formattingBar: true });
 * // or choose the buttons:
 * new FreeSheet(container, { data, contextMenu: true, formattingBar: { items: ['bold', 'italic', 'fill_color'] } });
 * ```
 */
class FormattingBar extends BasePlugin {
  /** The bar's element, while it is open. */
  element: HTMLDivElement | null = null;
  /** The color the fill and text color buttons set (the last one chosen). */
  #colors = { fill_color: '#ffff00', text_color: '#ff0000' };
  #palette: HTMLElement | null = null;
  /** Escape closes the palette, then the menu. */
  #onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.#palette) {
      event.stopPropagation();
      event.preventDefault();
      this.closePalette();
    }
  };

  isEnabled(): boolean {
    return !!this.hot.getSettings().formattingBar;
  }

  enablePlugin(): void {
    if (this.enabled) {
      return;
    }
    // The menu takes its place after it opens.
    this.addHook('afterContextMenuShow', () => Promise.resolve().then(() => this.open()));
    this.addHook('afterContextMenuHide', () => this.close());
    super.enablePlugin();
  }

  disablePlugin(): void {
    this.close();
    super.disablePlugin();
  }

  updatePlugin(): void {
    this.disablePlugin();
    this.enablePlugin();
    super.updatePlugin();
  }

  destroy(): void {
    this.close();
    super.destroy();
  }

  /** The buttons the `formattingBar` setting asks for. */
  getItems(): FormattingBarItem[] {
    const setting = this.hot.getSettings().formattingBar as boolean | { items?: FormattingBarItem[] };
    const items = typeof setting === 'object' && Array.isArray(setting.items) ? setting.items : DEFAULT_ITEMS;

    return items.filter(item => FORMATTING_BAR_ITEMS.includes(item));
  }

  /** Opens the bar above the open context menu (below it when there is no room above). */
  open(): void {
    const menu = this.hot.getPlugin('contextMenu')?.menu as { container?: HTMLElement; isOpened(): boolean } | undefined;

    if (!this.enabled || !menu?.container || !menu.isOpened()) {
      return;
    }
    this.close();
    const bar = this.createElement();
    const menuBox = menu.container.getBoundingClientRect();

    document.body.appendChild(bar);
    applyTheme(bar, this.hot.rootElement);
    const above = menuBox.top - bar.offsetHeight - 6;

    bar.style.top = `${(above >= 0 ? above : menuBox.bottom + 6) + window.scrollY}px`;
    // Inside the window, as the menu is.
    const left = Math.max(0, Math.min(menuBox.left, document.documentElement.clientWidth - bar.offsetWidth - 4));

    bar.style.left = `${left + window.scrollX}px`;
    this.element = bar;
    document.addEventListener('keydown', this.#onKeyDown, true);
    this.refresh();
  }

  /** Closes the bar (and its palette, putting back the cells a palette was showing a color on). */
  close(): void {
    this.closePalette();
    this.element?.remove();
    this.element = null;
    document.removeEventListener('keydown', this.#onKeyDown, true);
  }

  /** Marks the buttons whose formatting every selected cell has. */
  refresh(): void {
    const grid = this.hot as unknown as FormattingGrid;
    const [row, col] = this.hot.getSelectedLast() || [0, 0];
    const className = String(this.hot.getCellMeta(row, col).className || '');

    this.element?.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
      const action = button.dataset.action!;
      let pressed: boolean | null = null;

      if (['bold', 'italic', 'underline', 'strikethrough'].includes(action)) {
        pressed = selectionHasToggle(grid, action as StyleToggle);
      } else if (['left', 'center', 'right'].includes(action)) {
        pressed = classNameIncludes(className, `fs-${action}`);
      }
      if (pressed !== null) {
        button.setAttribute('aria-pressed', String(pressed));
      }
    });
    this.element?.querySelectorAll<HTMLElement>('[data-color-of]').forEach((line) => {
      line.style.background = this.#colors[line.dataset.colorOf as 'fill_color' | 'text_color'];
    });
  }

  createElement(): HTMLDivElement {
    const bar = document.createElement('div');
    const phrase = (key: string) => this.hot.getTranslatedPhrase(key) as string;
    const button = (action: string, extra = '') => `<button type="button" class="fs-formatting-bar__button" ` +
      `data-action="${action}" title="${phrase(LABELS[action])}" aria-label="${phrase(LABELS[action])}">` +
      `${ICONS[action]}${extra}</button>`;

    bar.className = 'fs-formatting-bar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', phrase(C.FORMATTING_BAR));
    bar.innerHTML = this.getItems().map((item) => {
      if (item === 'fill_color' || item === 'text_color') {
        return `<span class="fs-formatting-bar__split">${button(item,
          `<span class="fs-formatting-bar__color" data-color-of="${item}"></span>`)}` +
          `<button type="button" class="fs-formatting-bar__arrow" data-palette="${item}" aria-haspopup="true" ` +
          `aria-label="${phrase(LABELS[item])}…"></button></span>`;
      }
      if (item === 'alignment') {
        return `<span class="fs-formatting-bar__group">${['left', 'center', 'right'].map(a => button(a)).join('')}</span>`;
      }

      return button(item);
    }).join('');

    // Mouse down, so the menu (which closes on mouse down outside it) and the grid's selection stay.
    bar.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action], [data-palette]');

      if (target?.dataset.palette) {
        this.togglePalette(target.dataset.palette as 'fill_color' | 'text_color', target);
      } else if (target?.dataset.action) {
        this.closePalette();
        this.run(target.dataset.action);
      }
    });

    return bar;
  }

  /** Runs a button's command on the selected cells. */
  run(action: string): void {
    const grid = this.hot as unknown as FormattingGrid;

    if (['bold', 'italic', 'underline', 'strikethrough'].includes(action)) {
      toggleCellStyle(grid, action as StyleToggle);
    } else if (action === 'fill_color') {
      setCellStyle(grid, { background: this.#colors.fill_color });
    } else if (action === 'text_color') {
      setCellStyle(grid, { color: this.#colors.text_color });
    } else if (action === 'clear') {
      setCellStyle(grid, null);
    } else if (['left', 'center', 'right'].includes(action)) {
      const ranges = this.hot.getSelectedRange();

      if (ranges) {
        const stateBefore = getAlignmentClasses(ranges, (row: number, col: number) => this.hot.getCellMeta(row, col)
          .className);

        this.hot.runHooks('beforeCellAlignment', stateBefore, ranges, 'horizontal', `fs-${action}`);
        align(ranges, 'horizontal', `fs-${action}`, (row: number, col: number) => this.hot.getCellMeta(row, col),
          (row: number, col: number, key: string, value: unknown) => this.hot.setCellMeta(row, col, key, value));
        this.hot.render();
      }
    }
    this.refresh();
  }

  /** Opens (or closes) the palette of the fill or text color button under it. */
  togglePalette(item: 'fill_color' | 'text_color', anchor: HTMLElement): void {
    const wasOpen = this.#palette?.dataset.item === item;

    this.closePalette();
    if (wasOpen || !this.element) {
      return;
    }
    const property = item === 'fill_color' ? 'background' : 'color';
    const palette = paletteFor(this.hot, property, () => {
      this.closePalette();
      this.refresh();
    });

    // The chosen color becomes the button's color.
    palette.addEventListener('mousedown', (event) => {
      const color = (event.target as HTMLElement).closest<HTMLElement>('[data-color]')?.dataset.color;

      if (color) {
        this.#colors[item] = color;
      }
    }, true);
    palette.dataset.item = item;
    palette.classList.add('fs-formatting-bar__palette');
    palette.style.left = `${anchor.offsetLeft - 24}px`;
    this.element.appendChild(palette);
    const overflow = palette.getBoundingClientRect().right - document.documentElement.clientWidth + 4;

    if (overflow > 0) {
      palette.style.left = `${anchor.offsetLeft - 24 - overflow}px`;
    }
    anchor.setAttribute('aria-expanded', 'true');
    this.#palette = palette;
  }

  closePalette(): void {
    if (this.#palette) {
      this.#palette.remove();
      this.#palette = null;
      this.element?.querySelectorAll('[aria-expanded]').forEach(arrow => arrow.removeAttribute('aria-expanded'));
      previewCellStyle(this.hot as unknown as FormattingGrid, void 0);
    }
  }
}

registerPlugin('formattingBar', FormattingBar);

export default FormattingBar;
