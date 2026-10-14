/**
 * Themes for the parts FreeSheet appends to <body> (context menu, comment editor, date picker): they are outside the
 * grid, so they get the grid's theme class explicitly. See src/css/variables.css.
 */
const THEMES = ['fs-theme-light', 'fs-theme-dark', 'fs-theme-auto'] as const;

export type ThemeClassName = typeof THEMES[number];

/**
 * The theme of the closest element (the element itself or an ancestor) with a `fs-theme-*` class or a
 * `data-fs-theme` attribute; `null` when there is none (the default light look).
 */
export const getThemeClassName = (element: Element | null | undefined): ThemeClassName | null => {
  for (let node = element ?? null; node; node = node.parentElement) {
    const current = node;
    const byClass = THEMES.find(theme => current.classList.contains(theme));

    if (byClass) {
      return byClass;
    }
    const byAttribute = current.getAttribute('data-fs-theme');

    if (byAttribute === 'light' || byAttribute === 'dark' || byAttribute === 'auto') {
      return `fs-theme-${byAttribute}`;
    }
  }

  return null;
};

const STYLES = ['fs-style-classic', 'fs-style-modern'] as const;

export type StyleClassName = typeof STYLES[number];

/**
 * The style of the closest element with a `fs-style-*` class or a `data-fs-style` attribute (`classic` or `modern`);
 * `null` when there is none (the default Classic look). An explicit Classic is for a Classic grid inside a Modern page.
 */
export const getStyleClassName = (element: Element | null | undefined): StyleClassName | null => {
  for (let node = element ?? null; node; node = node.parentElement) {
    const current = node;
    const byClass = STYLES.find(style => current.classList.contains(style));

    if (byClass) {
      return byClass;
    }
    const byAttribute = current.getAttribute('data-fs-style');

    if (byAttribute === 'classic' || byAttribute === 'modern') {
      return `fs-style-${byAttribute}`;
    }
  }

  return null;
};

/**
 * Gives `floating` the theme and the style of `source` (usually the grid's root element), replacing any it had.
 */
export const applyTheme = (floating: Element, source: Element | null | undefined): void => {
  floating.classList.remove(...THEMES, ...STYLES);
  const theme = getThemeClassName(source);
  const style = getStyleClassName(source);

  if (theme) {
    floating.classList.add(theme);
  }
  if (style) {
    floating.classList.add(style);
  }
};

const CLASSIC_ROW_HEIGHT = 23;

/**
 * The default row height in px from the `--fs-row-height` variable of `element` (23 when it is not set, e.g. for an
 * element outside the document).
 */
export const getRowHeight = (element: Element | null | undefined): number => {
  if (!element) {
    return CLASSIC_ROW_HEIGHT;
  }
  const height = parseFloat(getComputedStyle(element).getPropertyValue('--fs-row-height'));

  return height > 0 ? height : CLASSIC_ROW_HEIGHT;
};
