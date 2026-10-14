import { getCellType } from './../cellTypes';
import { hasOwnProperty } from './object';

const COLUMN_LABEL_BASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const COLUMN_LABEL_BASE_LENGTH = COLUMN_LABEL_BASE.length;

/**
 * Converts a 0-based column index to a spreadsheet label (0 → `A`, 26 → `AA`).
 */
export const spreadsheetColumnLabel = (index: number): string => {
  let dividend = index + 1;
  let columnLabel = '';

  while (dividend > 0) {
    const modulo = (dividend - 1) % COLUMN_LABEL_BASE_LENGTH;

    columnLabel = String.fromCharCode(65 + modulo) + columnLabel;
    dividend = parseInt(String((dividend - modulo) / COLUMN_LABEL_BASE_LENGTH), 10);
  }

  return columnLabel;
};

/**
 * Converts a spreadsheet column label to a 0-based index (`A` → 0, `AA` → 26); -1 for an empty label.
 */
export const spreadsheetColumnIndex = (label: string): number => {
  let result = 0;

  if (label) {
    for (let i = 0, j = label.length - 1; i < label.length; i += 1, j -= 1) {
      result += (COLUMN_LABEL_BASE_LENGTH ** j) * (COLUMN_LABEL_BASE.indexOf(label[i]) + 1);
    }
  }
  result -= 1;

  return result;
};

/**
 * Creates sample data: a `rows` × `columns` array of cell labels (`A1`, `B1`, …).
 */
export const createSpreadsheetData = (rows = 100, columns = 4): string[][] => {
  const data: string[][] = [];

  for (let i = 0; i < rows; i++) {
    const row: string[] = [];

    for (let j = 0; j < columns; j++) {
      row.push(spreadsheetColumnLabel(j) + (i + 1));
    }
    data.push(row);
  }

  return data;
};

/**
 * Creates sample data as objects (`{ prop0: 'A1', prop1: 'B1', … }`).
 */
export const createSpreadsheetObjectData = (rows = 100, colCount = 4): Array<Record<string, string>> => {
  const data: Array<Record<string, string>> = [];

  for (let i = 0; i < rows; i++) {
    const row: Record<string, string> = {};

    for (let j = 0; j < colCount; j++) {
      row[`prop${j}`] = spreadsheetColumnLabel(j) + (i + 1);
    }
    data.push(row);
  }

  return data;
};

/**
 * Creates a `rows` × `columns` array of empty strings.
 */
export const createEmptySpreadsheetData = (rows: number, columns: number): string[][] => {
  const data: string[][] = [];

  for (let i = 0; i < rows; i++) {
    const row: string[] = [];

    for (let j = 0; j < columns; j++) {
      row.push('');
    }
    data.push(row);
  }

  return data;
};

/**
 * Transposes rows into columns; rows may have different lengths.
 */
export const translateRowsToColumns = <T>(input: ArrayLike<ArrayLike<T>>): T[][] => {
  const output: T[][] = [];
  let olen = 0;

  for (let i = 0, ilen = input.length; i < ilen; i++) {
    for (let j = 0, jlen = input[i].length; j < jlen; j++) {
      if (j === olen) {
        output.push([]);
        olen += 1;
      }
      output[j].push(input[i][j]);
    }
  }

  return output;
};

type CellProperties = Record<string, unknown> | null | undefined;
type CellMetaSource = { getCellMeta(row: number, col: number): CellProperties };

/**
 * Creates a function that finds `methodName` (renderer, editor, validator, …) for a cell: in the cell's own
 * properties, then in its cell type, then up the prototype chain of the settings. Called with `this` set to the
 * grid instance and `(row, col)`, or with a cell properties object as the first argument.
 */
export const cellMethodLookupFactory = (methodName: string, allowUndefined?: boolean) => {
  const isUndefinedAllowed = typeof allowUndefined === 'undefined' ? true : allowUndefined;

  const getMethodFromProperties = (properties: CellProperties): unknown => {
    if (!properties) {
      return undefined; // method not found

    } else if (hasOwnProperty(properties, methodName) && properties[methodName] !== void 0) { // own and not empty
      return properties[methodName]; // method defined directly

    } else if (hasOwnProperty(properties, 'type') && properties.type) { // own and not empty
      if (typeof properties.type !== 'string') {
        throw new Error('Cell type must be a string ');
      }

      // cellTypes is still JavaScript; its types are plain objects of renderer/editor/validator.
      const type = getCellType(properties.type) as Record<string, unknown>;

      if (hasOwnProperty(type, methodName)) {
        return type[methodName]; // method defined in type.
      } else if (isUndefinedAllowed) {
        return undefined; // method does not defined in type (eg. validator), returns undefined
      }
    }

    return getMethodFromProperties(Object.getPrototypeOf(properties));
  };

  // A function, not an arrow: `this` is the grid instance.
  return function cellMethodLookup(this: CellMetaSource, row: number | CellProperties, col?: number): unknown {
    return getMethodFromProperties(typeof row === 'number' ? this.getCellMeta(row, col as number) : row);
  };
};
