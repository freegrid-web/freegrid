/**
 * Themes for the parts FreeGrid appends to <body> (context menu, comment editor, date picker): they are outside the
 * grid, so they get the grid's theme class explicitly. See src/css/variables.css.
 */
const THEMES = ['fg-theme-light', 'fg-theme-dark', 'fg-theme-auto'] as const;

export type ThemeClassName = typeof THEMES[number];

/**
 * The theme of the closest element (the element itself or an ancestor) with a `fg-theme-*` class or a
 * `data-fg-theme` attribute; `null` when there is none (the default light look).
 */
export const getThemeClassName = (element: Element | null | undefined): ThemeClassName | null => {
  for (let node = element ?? null; node; node = node.parentElement) {
    const current = node;
    const byClass = THEMES.find(theme => current.classList.contains(theme));

    if (byClass) {
      return byClass;
    }
    const byAttribute = current.getAttribute('data-fg-theme');

    if (byAttribute === 'light' || byAttribute === 'dark' || byAttribute === 'auto') {
      return `fg-theme-${byAttribute}`;
    }
  }

  return null;
};

const STYLES = ['fg-style-classic', 'fg-style-modern'] as const;

export type StyleClassName = typeof STYLES[number];

/**
 * The style of the closest element with a `fg-style-*` class or a `data-fg-style` attribute (`classic` or `modern`);
 * `null` when there is none (the default Classic look). An explicit Classic is for a Classic grid inside a Modern page.
 */
export const getStyleClassName = (element: Element | null | undefined): StyleClassName | null => {
  for (let node = element ?? null; node; node = node.parentElement) {
    const current = node;
    const byClass = STYLES.find(style => current.classList.contains(style));

    if (byClass) {
      return byClass;
    }
    const byAttribute = current.getAttribute('data-fg-style');

    if (byAttribute === 'classic' || byAttribute === 'modern') {
      return `fg-style-${byAttribute}`;
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
 * The default row height in px from the `--fg-row-height` variable of `element` (23 when it is not set, e.g. for an
 * element outside the document).
 */
export const getRowHeight = (element: Element | null | undefined): number => {
  if (!element) {
    return CLASSIC_ROW_HEIGHT;
  }
  const height = parseFloat(getComputedStyle(element).getPropertyValue('--fg-row-height'));

  return height > 0 ? height : CLASSIC_ROW_HEIGHT;
};
