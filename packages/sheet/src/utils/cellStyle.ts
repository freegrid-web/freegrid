/** A cell's own style (its `style` meta): what Excel's fonts, fills and borders become. */
export type CellStyle = {
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  color?: string;
  background?: string;
  border?: string;
};

export const CELL_STYLE_PROPERTIES: (keyof CellStyle)[] = ['fontWeight', 'fontStyle', 'textDecoration', 'color',
  'background', 'border'];

/**
 * Draws a cell's `style` meta on its cell, after removing the style the cell had for another cell (cells are reused
 * while scrolling). Conditional formatting draws over it.
 */
export const applyCellStyle = (TD: HTMLTableCellElement, style: CellStyle | undefined): void => {
  const previous = TD.dataset.fsStyle;

  if (previous) {
    previous.split(',').forEach((property) => {
      (TD.style as unknown as Record<string, string>)[property] = '';
    });
    delete TD.dataset.fsStyle;
  }
  if (!style || typeof style !== 'object') {
    return;
  }
  const applied = CELL_STYLE_PROPERTIES.filter(property => typeof style[property] === 'string' && style[property]);

  applied.forEach((property) => {
    (TD.style as unknown as Record<string, string>)[property] = style[property]!;
  });
  if (applied.length) {
    TD.dataset.fsStyle = applied.join(',');
  }
};
