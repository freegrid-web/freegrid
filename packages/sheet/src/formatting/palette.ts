/** The base colors of the palette's first row; the rows under it are lighter and darker shades of each. */
export const THEME_COLORS = ['#ffffff', '#000000', '#e7e6e6', '#44546a', '#4472c4', '#ed7d31', '#a5a5a5', '#ffc000',
  '#5b9bd5', '#70ad47'];

/** The bright colors of the palette's last row. */
export const STANDARD_COLORS = ['#c00000', '#ff0000', '#ffc000', '#ffff00', '#92d050', '#00b050', '#00b0f0', '#0070c0',
  '#002060', '#7030a0'];

const toRgb = (hex: string): number[] => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb: number[]): string => `#${rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** A color mixed with white (`amount` > 0) or black (`amount` < 0). */
const mix = (hex: string, amount: number): string => toHex(toRgb(hex).map(v => (amount > 0 ?
  v + (255 - v) * amount : v * (1 + amount))));

/** The five shades under a base color: darker ones for white and light colors, lighter ones for black. */
export const shadesOf = (hex: string): string[] => {
  const [r, g, b] = toRgb(hex);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  if (luminance === 1) {
    return [-0.05, -0.15, -0.25, -0.35, -0.5].map(amount => mix(hex, amount));
  }
  if (luminance > 0.8) {
    return [-0.1, -0.25, -0.5, -0.75, -0.9].map(amount => mix(hex, amount));
  }
  if (luminance === 0) {
    return [0.5, 0.35, 0.25, 0.15, 0.05].map(amount => mix(hex, amount));
  }

  return [0.8, 0.6, 0.4, -0.25, -0.5].map(amount => mix(hex, amount));
};

export type PaletteOptions = {
  /** The labels: the two groups, the "no color" button and the "more colors" button. */
  labels: { theme: string; standard: string; none: string; more: string };
  /** A color under the pointer (shown on the cells until the pointer leaves), or `undefined`: show the cells as they are. */
  preview(color: string | null | undefined): void;
  /** The chosen color (`null`: no color). */
  pick(color: string | null): void;
};

/**
 * A color palette: a grid of theme colors with their shades, a row of standard colors, "no color" and "more colors"
 * (the browser's color picker). Pointing at a color previews it, clicking chooses it.
 */
export const createPalette = ({ labels, preview, pick }: PaletteOptions): HTMLElement => {
  const palette = document.createElement('div');
  const swatchRow = (colors: string[]) => {
    const row = document.createElement('div');

    row.className = 'fs-palette__row';
    colors.forEach((color) => {
      const swatch = document.createElement('button');

      swatch.type = 'button';
      swatch.className = 'fs-palette__swatch';
      swatch.style.background = color;
      swatch.title = color;
      swatch.setAttribute('aria-label', color);
      swatch.dataset.color = color;
      row.appendChild(swatch);
    });

    return row;
  };
  const heading = (text: string) => {
    const element = document.createElement('div');

    element.className = 'fs-palette__heading';
    element.textContent = text;

    return element;
  };
  const shades = THEME_COLORS.map(shadesOf);
  const button = (text: string, className: string) => {
    const element = document.createElement('button');

    element.type = 'button';
    element.className = `fs-palette__button ${className}`;
    element.textContent = text;

    return element;
  };
  const none = button(labels.none, 'fs-palette__none');
  const more = button(labels.more, 'fs-palette__more');
  const input = document.createElement('input');

  palette.className = 'fs-palette';
  input.type = 'color';
  input.className = 'fs-palette__input';
  input.tabIndex = -1;
  palette.append(heading(labels.theme), swatchRow(THEME_COLORS),
    ...[0, 1, 2, 3, 4].map(i => swatchRow(shades.map(column => column[i]))),
    heading(labels.standard), swatchRow(STANDARD_COLORS), none, more, input);

  palette.addEventListener('mouseover', (event) => {
    const target = (event.target as HTMLElement).closest('[data-color], .fs-palette__none');

    if (target) {
      preview(target === none ? null : (target as HTMLElement).dataset.color!);
    }
  });
  palette.addEventListener('mouseleave', () => preview(void 0));
  // Mouse down, not click: a menu closes on mouse down outside its items.
  palette.addEventListener('mousedown', (event) => {
    const target = (event.target as HTMLElement).closest('[data-color], .fs-palette__none, .fs-palette__more');

    event.preventDefault();
    event.stopPropagation();
    if (target === more) {
      input.click();
    } else if (target) {
      pick(target === none ? null : (target as HTMLElement).dataset.color!);
    }
  });
  input.addEventListener('input', () => preview(input.value));
  input.addEventListener('change', () => pick(input.value));

  return palette;
};
