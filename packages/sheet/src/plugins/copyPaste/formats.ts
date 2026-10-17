import type { CellStyle } from './../../utils/cellStyle';

/** The formatting of a copied or pasted cell: its style and its horizontal alignment. */
export type CellFormat = { style?: CellStyle; align?: 'left' | 'center' | 'right' | 'justify' };

const ALIGNMENTS = ['left', 'center', 'right', 'justify'] as const;

/** `property: value` pairs of a declaration list (`font-weight:700; color:red`), by lower-case property. */
const declarations = (text: string): Record<string, string> => Object.fromEntries(text.split(';')
  .map(part => part.split(':'))
  .filter(pair => pair.length >= 2)
  .map(([property, ...value]) => [property.trim().toLowerCase(), value.join(':').trim().replace(/!important$/, '')
    .trim()]));

/** The class rules of a pasted document's `<style>` (Excel puts the formatting there: `.xl65 { … }`). */
const classRules = (doc: Document): Map<string, Record<string, string>> => {
  const rules = new Map<string, Record<string, string>>();

  doc.querySelectorAll('style').forEach((style) => {
    // Comments around the rules (`<!-- … -->`, `/* … */`) are not part of them.
    const text = (style.textContent || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--|-->/g, '');

    for (const match of text.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      match[1].split(',').map(selector => selector.trim()).forEach((selector) => {
        const name = /^(?:td)?\.([\w-]+)$/i.exec(selector)?.[1];

        if (name) {
          rules.set(name, { ...rules.get(name), ...declarations(match[2]) });
        }
      });
    }
  });

  return rules;
};

/** A CSS color as `#rrggbb` (`red`, `rgb(…)`, `#f00`), or `null` for no color or one the browser does not know. */
const toHex = (color: string | undefined): string | null => {
  if (!color || /^(transparent|none|inherit|initial|auto|windowtext|window)$/i.test(color)) {
    return null;
  }
  const probe = document.createElement('span');

  probe.style.color = color;
  if (!probe.style.color) {
    return null;
  }
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g)?.map(Number) || [];

  probe.remove();
  if (rgb.length < 3 || (rgb.length > 3 && rgb[3] === 0)) {
    return null;
  }

  return `#${rgb.slice(0, 3).map(value => Math.round(value).toString(16).padStart(2, '0')).join('')}`;
};

/** The formatting of one pasted cell, from its class rules, its own style and its `<b>`, `<i>`, `<u>`, `<s>`. */
const formatOf = (cell: HTMLTableCellElement, rules: Map<string, Record<string, string>>): CellFormat => {
  const css: Record<string, string> = {};

  Array.from(cell.classList).forEach(name => Object.assign(css, rules.get(name)));
  Object.assign(css, declarations(cell.getAttribute('style') || ''));
  const style: CellStyle = {};
  const weight = css['font-weight'];
  const decorations = new Set((css['text-decoration'] || css['text-decoration-line'] || '').split(/\s+/));

  if (weight === 'bold' || weight === 'bolder' || Number(weight) >= 600 || cell.querySelector('b, strong')) {
    style.fontWeight = 'bold';
  }
  if (css['font-style'] === 'italic' || cell.querySelector('i, em')) {
    style.fontStyle = 'italic';
  }
  if (cell.querySelector('u')) {
    decorations.add('underline');
  }
  if (cell.querySelector('s, strike, del')) {
    decorations.add('line-through');
  }
  const lines = ['underline', 'line-through'].filter(line => decorations.has(line));

  if (lines.length) {
    style.textDecoration = lines.join(' ');
  }
  const color = toHex(css.color);
  // Black text is no formatting (Excel writes it for every cell).
  const background = toHex(css['background-color'] || css.background?.split(/\s+/)[0]);

  if (color && color !== '#000000') {
    style.color = color;
  }
  if (background && background !== '#ffffff') {
    style.background = background;
  }
  const align = (css['text-align'] || cell.getAttribute('align') || '').toLowerCase();
  const format: CellFormat = {};

  if (Object.keys(style).length) {
    format.style = style;
  }
  if ((ALIGNMENTS as readonly string[]).includes(align)) {
    format.align = align as CellFormat['align'];
  }

  return format;
};

/**
 * The formatting of the cells of a pasted HTML table, by rows (as `tableToArray` reads their values), or `null` when
 * no cell has any (the paste then keeps the cells' own formatting).
 */
export const tableToFormats = (html: string): CellFormat[][] | null => {
  const doc = new DOMParser().parseFromString(html.replace(/\n/g, ''), 'text/html');
  const table = doc.querySelector('table');

  if (!table) {
    return null;
  }
  const rules = classRules(doc);
  const formats = Array.from(table.rows, row => Array.from(row.cells, cell => formatOf(cell, rules)));

  return formats.some(row => row.some(format => format.style || format.align)) ? formats : null;
};

/** A cell's formatting as an inline `style` attribute value, for the HTML a copy puts on the clipboard. */
export const formatToCss = ({ style = {}, align }: CellFormat): string => {
  const css: string[] = [];

  if (style.fontWeight) {
    css.push(`font-weight:${style.fontWeight}`);
  }
  if (style.fontStyle) {
    css.push(`font-style:${style.fontStyle}`);
  }
  if (style.textDecoration) {
    css.push(`text-decoration:${style.textDecoration}`);
  }
  if (style.color) {
    css.push(`color:${style.color}`);
  }
  if (style.background) {
    css.push(`background-color:${style.background}`);
  }
  if (align) {
    css.push(`text-align:${align}`);
  }

  return css.join(';');
};
