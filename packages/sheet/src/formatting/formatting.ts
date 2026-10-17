import type { CellRange } from './../3rdparty/walkontable/src';
import { CELL_STYLE_PROPERTIES, type CellStyle } from './../utils/cellStyle';

/** A grid as formatting sees it. */
type FormattingHost = {
  getSelectedRange(): CellRange[] | undefined;
  getCellMeta(row: number, col: number): { style?: CellStyle; className?: string | string[] };
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

/** A grid that can also remove a cell's own setting. */
type MetaHost = FormattingHost & { removeCellMeta(row: number, col: number, key: string): void };

/** The settings a cell's format is made of (format painter, number formats). */
const FORMAT_KEYS = ['style', 'className', 'type', 'numericFormat', 'renderer', 'editor', 'validator', 'dataType'];

/** Changes of cells' settings, for undo: `[row, col, before, after]` with `undefined` for "not the cell's own". */
export type CellFormatChange = [number, number, Record<string, unknown>, Record<string, unknown>];

/** Sets (or, for `undefined`, removes) a cell's own settings. */
export const writeCellMeta = (grid: MetaHost, row: number, col: number, values: Record<string, unknown>): void => {
  Object.entries(values).forEach(([key, value]) => {
    if (value === void 0) {
      grid.removeCellMeta(row, col, key);
    } else {
      grid.setCellMeta(row, col, key, value);
    }
  });
};

/**
 * Sets settings of cells, one undo step for all: each `values` object is written (an `undefined` removes the
 * cell's own setting, so the column's applies). Runs `afterSetCellFormat` and renders.
 */
export const formatCells = (grid: MetaHost, cells: { row: number; col: number; values: Record<string, unknown> }[]):
  void => {
  endPreview(grid);
  const changes: CellFormatChange[] = [];

  cells.forEach(({ row, col, values }) => {
    const meta = grid.getCellMeta(row, col) as Record<string, unknown>;
    const before = Object.fromEntries(Object.keys(values).map(key => [key,
      Object.prototype.hasOwnProperty.call(meta, key) ? meta[key] : void 0]));

    if (JSON.stringify(before) !== JSON.stringify(values) || Object.keys(values).some(key => before[key] !==
      values[key])) {
      changes.push([row, col, before, values]);
      writeCellMeta(grid, row, col, values);
    }
  });
  if (changes.length) {
    grid.runHooks('afterSetCellFormat', changes);
  }
  grid.render();
};

/** Where `setCellBorders` draws lines in the selected ranges. */
export type BorderKind = 'all' | 'outside' | 'thick_outside' | 'top' | 'bottom' | 'left' | 'right' | 'none';

/**
 * Draws lines on the selected cells, as a spreadsheet's Borders menu: every side of every cell (`all`), around each
 * range (`outside`, `thick_outside`), one side of each range, or none (removes every line of the cells).
 */
export const setCellBorders = (grid: FormattingHost, kind: BorderKind, color = '#000000'): void => {
  const ranges = grid.getSelectedRange() || [];
  const line = `${kind === 'thick_outside' ? 2 : 1}px solid ${color}`;
  const sidesOf = new Map<string, Partial<CellStyle>>();

  ranges.forEach((range) => {
    const from = range.getTopLeftCorner();
    const to = range.getBottomRightCorner();

    eachCell(grid, [range], (row, col) => {
      const sides: Partial<CellStyle> = { ...sidesOf.get(`${row}:${col}`) };
      const edge = { borderTop: row === from.row, borderBottom: row === to.row, borderLeft: col === from.col,
        borderRight: col === to.col };

      (Object.keys(edge) as (keyof typeof edge)[]).forEach((side) => {
        const outside = kind === 'outside' || kind === 'thick_outside';

        if (kind === 'all' || (outside && edge[side]) || (kind === side.slice(6).toLowerCase() && edge[side])) {
          sides[side] = line;
        }
      });
      sidesOf.set(`${row}:${col}`, sides);
    });
  });
  if (kind === 'none') {
    restyleCells(grid, ranges, before => compact({ ...before, border: null, borderTop: null, borderRight: null,
      borderBottom: null, borderLeft: null }));

    return;
  }
  // Each cell gets its own sides.
  formatCells(grid as MetaHost, [...sidesOf].map(([key, sides]) => {
    const [row, col] = key.split(':').map(Number);

    return { row, col, values: { style: compact({ ...grid.getCellMeta(row, col).style, ...sides }) } };
  }));
};

/** The number formats of the formatting bar: `null` is General (the column's own type and format). */
export const NUMBER_FORMATS: Record<string, string | null> = {
  general: null,
  number: '0,0.00',
  currency: '$0,0.00',
  percent: '0.00%',
};

/** Gives the selected cells a number format (a numbro pattern), or General with `null`. One undo step. */
export const setNumberFormat = (grid: MetaHost, pattern: string | null): void => {
  const cells: { row: number; col: number; values: Record<string, unknown> }[] = [];

  eachCell(grid, grid.getSelectedRange() || [], (row, col) => {
    cells.push({ row, col, values: {
      type: pattern === null ? void 0 : 'numeric',
      numericFormat: pattern === null ? void 0 : { pattern },
      // The type's renderer, editor and validator follow the type.
      renderer: void 0, editor: void 0, validator: void 0, dataType: void 0,
    } });
  });
  formatCells(grid, cells);
};

/** The formats of the selected cells (the last range), by rows: what the format painter copies. */
export const copyCellFormats = (grid: FormattingHost): Record<string, unknown>[][] => {
  const range = grid.getSelectedRange()?.slice(-1)[0];

  if (!range) {
    return [];
  }
  const from = range.getTopLeftCorner();
  const to = range.getBottomRightCorner();
  const formats: Record<string, unknown>[][] = [];

  for (let row = Math.max(0, from.row); row <= Math.min(to.row, grid.countRows() - 1); row += 1) {
    formats.push([]);
    for (let col = Math.max(0, from.col); col <= Math.min(to.col, grid.countCols() - 1); col += 1) {
      const meta = grid.getCellMeta(row, col) as Record<string, unknown>;

      formats[formats.length - 1].push(Object.fromEntries(FORMAT_KEYS.map(key => [key,
        Object.prototype.hasOwnProperty.call(meta, key) ? meta[key] : void 0])));
    }
  }

  return formats;
};

/** Gives the selected cells copied formats, repeated over a bigger selection. One undo step. */
export const pasteCellFormats = (grid: MetaHost, formats: Record<string, unknown>[][]): void => {
  if (!formats.length || !formats[0].length) {
    return;
  }
  const cells: { row: number; col: number; values: Record<string, unknown> }[] = [];

  (grid.getSelectedRange() || []).forEach((range) => {
    const from = range.getTopLeftCorner();

    eachCell(grid, [range], (row, col) => {
      const rowFormats = formats[(row - Math.max(0, from.row)) % formats.length];

      cells.push({ row, col, values: { ...rowFormats[(col - Math.max(0, from.col)) % rowFormats.length] } });
    });
  });
  formatCells(grid, cells);
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

/** The horizontal alignment classes (with their older names). */
const HORIZONTAL = /^(fs-(left|center|right|justify)|ht(Left|Center|Right|Justify))$/;

/**
 * Gives cells a style and a horizontal alignment at once (a paste with formatting): each cell's style is replaced,
 * and its alignment class too (`undefined`: no alignment). One `afterSetCellStyle` (undo) for all of them.
 */
export const setCellFormats = (grid: FormattingHost,
  cells: { row: number; col: number; style?: CellStyle; align?: string }[]): void => {
  endPreview(grid);
  const changes: unknown[][] = [];

  cells.forEach(({ row, col, style, align }) => {
    const meta = grid.getCellMeta(row, col);
    const classBefore = meta.className;
    const classes = (Array.isArray(classBefore) ? classBefore : String(classBefore || '').split(/\s+/))
      .filter(name => name && !HORIZONTAL.test(name));
    const classAfter = [...classes, ...(align ? [`fs-${align}`] : [])].join(' ') || void 0;
    const after = style ? compact(style as Record<string, unknown>) : void 0;

    if (JSON.stringify(meta.style) !== JSON.stringify(after) || (classBefore || void 0) !== classAfter) {
      changes.push([row, col, meta.style, after, classBefore, classAfter]);
      grid.setCellMeta(row, col, 'style', after);
      grid.setCellMeta(row, col, 'className', classAfter);
    }
  });
  if (changes.length) {
    grid.runHooks('afterSetCellStyle', changes);
  }
  grid.render();
};
