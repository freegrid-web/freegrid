import './sidePanel.css';
import { getWorkbookOf } from './../workbook/workbook';
import * as C from './../i18n/constants';
import type Core from './../core';

/** What a panel shows: its title, its content, and the panel it goes back to (an arrow before the title). */
export type PanelView = {
  title(): string;
  /** The panel the back arrow opens. */
  back?: string;
  render(body: HTMLElement): void;
  /** Called when another panel opens or the panel closes. */
  destroy?(): void;
  /** Escape in the panel (by default it closes the panel). */
  onEscape?(): void;
};

export type PanelViewFactory = (root: Core, panel: SidePanel, options: Record<string, unknown>) => PanelView;

const views = new Map<string, PanelViewFactory>();
const panels = new WeakMap<Core, SidePanel>();

/** Adds a panel that `openPanel(name)` opens. */
export const registerPanelView = (name: string, factory: PanelViewFactory): void => {
  views.set(name, factory);
};

/** The document's first sheet (panels belong to the document). */
export const documentRoot = (hot: Core): Core => getWorkbookOf(hot)?.root || hot;

/** The grids of the document: every sheet, or the grid alone. */
export const documentGrids = (hot: Core): { instance: Core; id: string | null; name: string | null }[] => {
  const workbook = getWorkbookOf(hot);

  return workbook ? workbook.sheets.map(sheet => ({ instance: sheet.instance, id: sheet.id, name: sheet.name })) :
    [{ instance: hot, id: null, name: null }];
};

/** The grid the user works in: the active sheet, or the grid alone. */
export const activeGrid = (hot: Core): Core => {
  const workbook = getWorkbookOf(hot);

  return workbook ? workbook.require(workbook.activeId).instance : hot;
};

/** Draws a grid again with its sizes measured anew (the room it has changed). */
const refreshSize = (instance: Core): void => {
  if (!instance.view || instance.isDestroyed) {
    return;
  }
  instance.forceFullRender = true;
  instance.view.render();
  instance.view.wt.wtOverlays.adjustElementsSize(true);
  instance.forceFullRender = true;
  instance.view.render();
};

/**
 * The side panel: a panel at the right of the document (comments, conditional formatting rules, …). In a frame (the
 * element that holds the formula bar, the sheets and the tabs) the sheets make room for it; a container narrower than
 * 600 px, or a grid without a frame, gets the panel over the grid.
 */
export class SidePanel {
  root: Core;
  element: HTMLElement | null = null;
  name: string | null = null;
  view: PanelView | null = null;
  #body: HTMLElement | null = null;
  #title: HTMLElement | null = null;
  #back: HTMLButtonElement | null = null;

  constructor(root: Core) {
    this.root = root;
  }

  /** The element that holds the panel: the document's frame, or the grid. */
  get host(): HTMLElement {
    const parent = this.root.rootElement.parentElement;

    return parent && parent.classList.contains('fs-document') ? parent : this.root.rootElement;
  }

  /**
   * Opens a panel (another one open is replaced).
   *
   * @param name The panel (`comments`, `conditionalFormatting`, …).
   * @param options Options of that panel.
   */
  open(name: string, options: Record<string, unknown> = {}): void {
    const factory = views.get(name);

    if (!factory) {
      throw new Error(`No side panel named "${name}".`);
    }
    const wasOpen = !!this.element;

    this.view?.destroy?.();
    this.build();
    this.name = name;
    this.view = factory(this.root, this, options);
    this.refresh();
    if (!wasOpen) {
      this.layout();
    }
    this.root.runHooks('afterPanelOpen', name);
  }

  /** Closes the panel; the sheets take the room back. */
  close(): void {
    if (!this.element) {
      return;
    }
    const name = this.name;

    this.view?.destroy?.();
    this.view = null;
    this.name = null;
    this.element.remove();
    this.element = null;
    this.host.classList.remove('fs-panel-host', 'fs-panel-host--over');
    this.refreshGrids();
    activeGrid(this.root).listen();
    this.root.runHooks('afterPanelClose', name);
  }

  /** Draws the open panel again (its title and content). */
  refresh(): void {
    if (!this.view || !this.#body || !this.#title || !this.#back) {
      return;
    }
    this.#title.textContent = this.view.title();
    this.#back.hidden = !this.view.back;
    this.#body.replaceChildren();
    this.view.render(this.#body);
  }

  build(): void {
    if (this.element) {
      return;
    }
    const panel = document.createElement('aside');
    const header = document.createElement('div');
    const back = document.createElement('button');
    const title = document.createElement('h2');
    const close = document.createElement('button');
    const body = document.createElement('div');

    panel.className = ['fs-side-panel',
      ...Array.from(this.root.rootElement.classList).filter(name => /^fs-(theme|style)-/.test(name))].join(' ');
    panel.setAttribute('role', 'complementary');
    header.className = 'fs-side-panel__header';
    back.type = 'button';
    back.className = 'fs-side-panel__back';
    back.setAttribute('aria-label', this.root.getTranslatedPhrase(C.PANEL_BACK, 0) as string);
    back.addEventListener('click', () => this.view?.back && this.open(this.view.back));
    title.className = 'fs-side-panel__title';
    close.type = 'button';
    close.className = 'fs-side-panel__close';
    close.setAttribute('aria-label', this.root.getTranslatedPhrase(C.PANEL_CLOSE, 0) as string);
    close.addEventListener('click', () => this.close());
    body.className = 'fs-side-panel__body';
    header.append(back, title, close);
    panel.append(header, body);

    // The panel's keys stay in the panel; the grid gets the keyboard back when the panel closes.
    panel.addEventListener('mousedown', event => event.stopPropagation());
    panel.addEventListener('focusin', () => activeGrid(this.root).unlisten());
    panel.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        if (this.view?.onEscape) {
          this.view.onEscape();
        } else {
          this.close();
        }
      }
    });

    this.element = panel;
    this.#body = body;
    this.#title = title;
    this.#back = back;
    this.host.appendChild(panel);
  }

  /** The sheets make room for the panel (or it goes over them, in a narrow container or without a frame). */
  layout(): void {
    const host = this.host;
    const framed = host !== this.root.rootElement;

    host.classList.add('fs-panel-host');
    host.classList.toggle('fs-panel-host--over', !framed || host.clientWidth < 600);
    this.refreshGrids();
  }

  refreshGrids(): void {
    documentGrids(this.root).forEach(({ instance }) => refreshSize(instance));
  }

  /** With the grid that holds the document: the panel goes, nothing is drawn again and no grid takes the keyboard. */
  destroy(): void {
    this.view?.destroy?.();
    this.view = null;
    this.name = null;
    this.element?.remove();
    this.element = null;
    this.host.classList.remove('fs-panel-host', 'fs-panel-host--over');
  }
}

/** The document's panel. */
export const getSidePanel = (hot: Core): SidePanel => {
  const root = documentRoot(hot);
  let panel = panels.get(root);

  if (!panel) {
    panel = new SidePanel(root);
    panels.set(root, panel);
  }

  return panel;
};

/** The document's panel, if it was made. */
export const findSidePanel = (hot: Core): SidePanel | undefined => panels.get(documentRoot(hot));
