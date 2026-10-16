import './loading.css';
import * as C from './../i18n/constants';
import type Core from './../core';

const overlays = new WeakMap<Core, HTMLElement>();

/**
 * Shows or hides the loading state of a grid: a layer over the grid with a spinner and a text, which takes the
 * clicks; the grid ignores the keyboard meanwhile and is marked busy for assistive technology.
 *
 * @param grid The grid.
 * @param state `true` (the default text), a text, or `false` to hide it.
 */
export const setLoading = (grid: Core, state: boolean | string): void => {
  let overlay = overlays.get(grid);

  if (!state) {
    overlay?.remove();
    overlays.delete(grid);
    grid.rootElement.removeAttribute('aria-busy');

    return;
  }
  const text = typeof state === 'string' ? state : grid.getTranslatedPhrase(C.LOADING, 0) as string;

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'fs-loading';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.append(Object.assign(document.createElement('span'), { className: 'fs-loading__spinner' }),
      Object.assign(document.createElement('span'), { className: 'fs-loading__text' }));
    // Clicks stay on the layer.
    overlay.addEventListener('mousedown', event => event.stopPropagation());
    grid.rootElement.appendChild(overlay);
    overlays.set(grid, overlay);
  }
  overlay.querySelector('.fs-loading__text')!.textContent = text;
  grid.rootElement.setAttribute('aria-busy', 'true');
};

/** Whether a grid shows its loading state. */
export const isLoading = (grid: Core): boolean => overlays.has(grid);
