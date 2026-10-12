/**
 * Themes for the parts FreeGrid appends to <body> (context menu, comment editor, date picker): they are outside the
 * grid, so they get the grid's theme class explicitly. See src/css/variables.css.
 */
const THEMES = ['fg-theme-dark', 'fg-theme-auto'] as const;

export type ThemeClassName = typeof THEMES[number];

/**
 * The theme of the closest element (the element itself or an ancestor) with a `fg-theme-*` class or a
 * `data-fg-theme` attribute; `null` when there is none (light theme).
 */
export const getThemeClassName = (element: Element | null | undefined): ThemeClassName | null => {
  for (let node = element ?? null; node; node = node.parentElement) {
    const current = node;
    const byClass = THEMES.find(theme => current.classList.contains(theme));

    if (byClass) {
      return byClass;
    }
    const byAttribute = current.getAttribute('data-fg-theme');

    if (byAttribute === 'dark' || byAttribute === 'auto') {
      return `fg-theme-${byAttribute}`;
    }
  }

  return null;
};

/**
 * Gives `floating` the theme of `source` (usually the grid's root element), replacing any theme it had.
 */
export const applyTheme = (floating: Element, source: Element | null | undefined): void => {
  floating.classList.remove(...THEMES);
  const theme = getThemeClassName(source);

  if (theme) {
    floating.classList.add(theme);
  }
};
