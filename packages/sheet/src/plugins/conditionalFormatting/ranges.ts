/** A rectangle of physical rows and columns (inclusive); `Infinity` for a whole column or row. */
export type Rect = { r1: number; c1: number; r2: number; c2: number };

const columnIndex = (letters: string): number => letters.toUpperCase().split('')
  .reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;

const columnLetters = (index: number): string => {
  let letters = '';
  let value = index + 1;

  while (value > 0) {
    const rest = (value - 1) % 26;

    letters = String.fromCharCode(65 + rest) + letters;
    value = Math.floor((value - 1) / 26);
  }

  return letters;
};

/** `B2`, `B2:F20`, `C:C`, `3:5` (with or without `$`) as a rectangle, or `null`. */
export const parseRange = (text: string): Rect | null => {
  const clean = String(text).replace(/\$/g, '').trim();
  const cells = /^([A-Za-z]{1,3})(\d+)(?::([A-Za-z]{1,3})(\d+))?$/.exec(clean);

  if (cells) {
    const [, a, b, c = a, d = b] = cells;
    const [r1, r2] = [Number(b) - 1, Number(d) - 1];
    const [c1, c2] = [columnIndex(a), columnIndex(c)];

    return r1 < 0 || r2 < 0 ? null :
      { r1: Math.min(r1, r2), c1: Math.min(c1, c2), r2: Math.max(r1, r2), c2: Math.max(c1, c2) };
  }
  const columns = /^([A-Za-z]{1,3}):([A-Za-z]{1,3})$/.exec(clean);

  if (columns) {
    const [c1, c2] = [columnIndex(columns[1]), columnIndex(columns[2])];

    return { r1: 0, c1: Math.min(c1, c2), r2: Infinity, c2: Math.max(c1, c2) };
  }
  const rows = /^(\d+):(\d+)$/.exec(clean);

  if (rows && Number(rows[1]) > 0 && Number(rows[2]) > 0) {
    const [r1, r2] = [Number(rows[1]) - 1, Number(rows[2]) - 1];

    return { r1: Math.min(r1, r2), c1: 0, r2: Math.max(r1, r2), c2: Infinity };
  }

  return null;
};

/** A rectangle as A1 text. */
export const formatRange = ({ r1, c1, r2, c2 }: Rect): string => {
  if (r2 === Infinity) {
    return `${columnLetters(c1)}:${columnLetters(c2)}`;
  }
  if (c2 === Infinity) {
    return `${r1 + 1}:${r2 + 1}`;
  }
  const start = `${columnLetters(c1)}${r1 + 1}`;

  return r1 === r2 && c1 === c2 ? start : `${start}:${columnLetters(c2)}${r2 + 1}`;
};

export const rectContains = ({ r1, c1, r2, c2 }: Rect, row: number, column: number): boolean =>
  row >= r1 && row <= r2 && column >= c1 && column <= c2;

export const rectsIntersect = (a: Rect, b: Rect): boolean =>
  a.r1 <= b.r2 && b.r1 <= a.r2 && a.c1 <= b.c2 && b.c1 <= a.c2;

/** The rectangle after `amount` rows were inserted at `index`: below moves down, across grows. */
export const insertRows = (rect: Rect, index: number, amount: number): Rect => {
  if (rect.r2 === Infinity || index > rect.r2) {
    return rect;
  }

  return index <= rect.r1 ? { ...rect, r1: rect.r1 + amount, r2: rect.r2 + amount } :
    { ...rect, r2: rect.r2 + amount };
};

/** The rectangle after the given rows were removed, or `null` when none of its rows is left. */
export const removeRows = (rect: Rect, removed: number[]): Rect | null => {
  if (rect.r2 === Infinity) {
    return rect;
  }
  const inside = removed.filter(row => row >= rect.r1 && row <= rect.r2).length;
  const above = removed.filter(row => row < rect.r1).length;
  const height = rect.r2 - rect.r1 + 1 - inside;

  return height <= 0 ? null : { ...rect, r1: rect.r1 - above, r2: rect.r1 - above + height - 1 };
};

const transpose = (rect: Rect): Rect => ({ r1: rect.c1, c1: rect.r1, r2: rect.c2, c2: rect.r2 });

export const insertColumns = (rect: Rect, index: number, amount: number): Rect =>
  transpose(insertRows(transpose(rect), index, amount));

export const removeColumns = (rect: Rect, removed: number[]): Rect | null => {
  const result = removeRows(transpose(rect), removed);

  return result ? transpose(result) : null;
};

/** `rect` without the cells of `cut`: up to four rectangles. */
export const subtractRect = (rect: Rect, cut: Rect): Rect[] => {
  if (!rectsIntersect(rect, cut)) {
    return [rect];
  }
  const parts: Rect[] = [];
  const top = Math.max(rect.r1, cut.r1);
  const bottom = Math.min(rect.r2, cut.r2);

  if (cut.r1 > rect.r1) {
    parts.push({ ...rect, r2: cut.r1 - 1 });
  }
  if (cut.r2 < rect.r2) {
    parts.push({ ...rect, r1: cut.r2 + 1 });
  }
  if (cut.c1 > rect.c1) {
    parts.push({ r1: top, c1: rect.c1, r2: bottom, c2: cut.c1 - 1 });
  }
  if (cut.c2 < rect.c2) {
    parts.push({ r1: top, c1: cut.c2 + 1, r2: bottom, c2: rect.c2 });
  }

  return parts;
};

/**
 * A formula written for one cell, moved by `rows` and `columns` for another: relative references move, the parts
 * fixed with `$` and the text in quotes do not.
 */
export const shiftFormula = (formula: string, rows: number, columns: number): string => formula
  .split(/("(?:[^"]|"")*")/)
  .map((part, index) => (index % 2 === 1 ? part : part.replace(
    /(^|[^A-Za-z0-9_.$])(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?![A-Za-z0-9_(])/g,
    (match, before: string, fixColumn: string, letters: string, fixRow: string, digits: string) => {
      const column = fixColumn ? letters.toUpperCase() : columnLetters(Math.max(0, columnIndex(letters) + columns));
      const row = fixRow ? digits : String(Math.max(1, Number(digits) + rows));

      return `${before}${fixColumn}${column}${fixRow}${row}`;
    },
  )))
  .join('');
