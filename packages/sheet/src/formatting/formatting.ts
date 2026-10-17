import type { CellRange } from './../3rdparty/walkontable/src';
import { CELL_STYLE_PROPERTIES, type CellStyle } from './../utils/cellStyle';

/** A grid as formatting sees it. */
type FormattingHost = {
  getSelectedRange(): CellRange[] | undefined;
  getCellMeta(row: number, col: number): { style?: CellStyle };
  setCellMeta(row: number, col: number, key: string, value: unknown): void;
  countRows(): number;
  countCols(): number;
  runHooks(name: string, ...args: unknown[]): unknown;
  render(): void;
};

/** The style changes of `setCellStyle`, for undo: `[row, col, styleBefore, styleAfter]` (visual indexes). */
export type CellStyleChange = [number, number, CellStyle | undefined, CellStyle | undefined];

/** The style toggles of the menu and of Ctrl+B, Ctrl+I and Ctrl+U. */
export type StyleToggle = 'bold' | 'italic' | 'underline' | 'strikethrough';

/** The colors of the "Text color" and "Fill color" menus. */
export const PALETTE = ['#000000', '#7f7f7f', '#c00000', '#ff0000', '#ffc000', '#ffff00', '#00b050', '#00b0f0',
  '#0070c0', '#7030a0'];

const DECORATIONS: Partial<Record<StyleToggle, string>> = { underline: 'underline', strikethrough: 'line-through' };

/** The cells of the ranges, each once, inside the grid (a header selection has negative indexes). */
const eachCell = (grid: FormattingHost, ranges: CellRange[], callback: (row: number, col: number) => void): void => {
  const seen = new Set<string>();

  ranges.forEach((range) => {
    const from = range.getTopLeftCorner();
    const to = range.getBottomRightCorner();

    for (let row = Math.max(0, from.row); row <= Math.min(to.row, grid.countRows() - 1); row += 1) {
      for (let col = Math.max(0, from.col); col <= Math.min(to.col, grid.countCols() - 1); col += 1) {
        const key = `${row}:${col}`;

        if (!seen.has(key)) {
          seen.add(key);
          callback(row, col);
        }
      }
    }
  });
};

/** A style without its empty properties, or `undefined` when nothing is left. */
const compact = (style: Record<string, unknown>): CellStyle | undefined => {
  const result: Record<string, string> = {};

  CELL_STYLE_PROPERTIES.forEach((property) => {
    if (typeof style[property] === 'string' && style[property]) {
      result[property] = style[property] as string;
    }
  });

  return Object.keys(result).length ? result as CellStyle : void 0;
};

/** The styles the selected cells had before a preview, by grid. */
const previews = new WeakMap<FormattingHost, [number, number, CellStyle | undefined][]>();

/** Puts back the styles a preview changed (without rendering). */
const endPreview = (grid: FormattingHost): boolean => {
  const before = previews.get(grid);

  previews.delete(grid);
  before?.forEach(([row, col, style]) => grid.setCellMeta(row, col, 'style', style));

  return !!before;
};

/**
 * Shows a style on the selected cells without setting it (as a palette does while the pointer is on a color);
 * `undefined` shows the cells as they are again. Setting a style ends the preview.
 */
export const previewCellStyle = (grid: FormattingHost, style: Partial<Record<keyof CellStyle, string | null>> |
  undefined): void => {
  const ended = endPreview(grid);

  if (style !== void 0) {
    const before: [number, number, CellStyle | undefined][] = [];

    eachCell(grid, grid.getSelectedRange() || [], (row, col) => {
      const current = grid.getCellMeta(row, col).style;

      before.push([row, col, current]);
      grid.setCellMeta(row, col, 'style', compact({ ...current, ...style }));
    });
    previews.set(grid, before);
  }
  if (ended || style !== void 0) {
    grid.render();
  }
};

/** Gives each cell of the ranges the style `restyle` makes of its style; runs `afterSetCellStyle` and renders. */
const restyleCells = (grid: FormattingHost, ranges: CellRange[] | undefined,
  restyle: (style: CellStyle | undefined) => CellStyle | undefined): void => {
  endPreview(grid);
  if (!ranges || !ranges.length) {
    return;
  }
  const changes: CellStyleChange[] = [];

  eachCell(grid, ranges, (row, col) => {
    const before = grid.getCellMeta(row, col).style;
    const after = restyle(before);

    if (JSON.stringify(before) !== JSON.stringify(after)) {
      changes.push([row, col, before, after]);
      grid.setCellMeta(row, col, 'style', after);
    }
  });
  if (changes.length) {
    grid.runHooks('afterSetCellStyle', changes);
  }
  grid.render();
};

/**
 * Sets the style of the cells (the selected ones by default): `style` is merged into each cell's `style` meta, where a
 * `null` (or empty) property removes that property; a `null` style removes the whole style. Runs `afterSetCellStyle`
 * with the changes (which undo records) and renders.
 */
export const setCellStyle = (grid: FormattingHost, style: Partial<Record<keyof CellStyle, string | null>> | null,
  ranges = grid.getSelectedRange()): void => {
  restyleCells(grid, ranges, before => (style === null ? void 0 : compact({ ...before, ...style })));
};

/** Whether a cell's style has the toggle (bold, italic, underline or strikethrough). */
export const hasToggle = (style: CellStyle | undefined, toggle: StyleToggle): boolean => {
  if (toggle === 'bold') {
    return style?.fontWeight === 'bold' || Number(style?.fontWeight) >= 600;
  }
  if (toggle === 'italic') {
    return style?.fontStyle === 'italic';
  }

  return (style?.textDecoration || '').split(/\s+/).includes(DECORATIONS[toggle]!);
};

/** Whether every selected cell has the toggle. */
export const selectionHasToggle = (grid: FormattingHost, toggle: StyleToggle): boolean => {
  let all = true;
  let any = false;

  eachCell(grid, grid.getSelectedRange() || [], (row, col) => {
    any = true;
    all = all && hasToggle(grid.getCellMeta(row, col).style, toggle);
  });

  return any && all;
};

/**
 * Turns a toggle on for the selected cells, or off when all of them have it (as a spreadsheet's Bold button does).
 * Underline and strikethrough share `textDecoration`, so each cell keeps the other one.
 */
export const toggleCellStyle = (grid: FormattingHost, toggle: StyleToggle): void => {
  const on = !selectionHasToggle(grid, toggle);

  if (toggle === 'bold') {
    setCellStyle(grid, { fontWeight: on ? 'bold' : null });
  } else if (toggle === 'italic') {
    setCellStyle(grid, { fontStyle: on ? 'italic' : null });
  } else {
    restyleCells(grid, grid.getSelectedRange(), (before) => {
      const lines = (before?.textDecoration || '').split(/\s+/).filter(line => line && line !== DECORATIONS[toggle]);

      return compact({ ...before, textDecoration: (on ? [...lines, DECORATIONS[toggle]!] : lines).join(' ') });
    });
  }
};
