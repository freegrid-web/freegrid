import type { NumericFormat } from '../helpers/numberFormat';
import type { Prop } from './../dataMap';
import type Core from './../core';

/**
 * Types shared by cell types, renderers and validators. The grid itself (src/core.js) is not typed yet: GridInstance
 * lists the members these modules use.
 */


/** The settings of one cell (cell meta): the grid's, its column's and its own. */
export type CellProperties = {
  row?: number;
  col?: number;
  prop?: string | number;
  instance?: GridInstance;
  type?: string;
  className?: string | string[];
  readOnly?: boolean;
  readOnlyCellClassName?: string;
  valid?: boolean;
  invalidCellClassName?: string;
  wordWrap?: boolean;
  noWordWrapClassName?: string;
  placeholder?: string;
  placeholderCellClassName?: string;
  trimWhitespace?: boolean;
  enterBeginsEditing?: boolean;
  allowHtml?: boolean;
  allowEmpty?: boolean;
  hashLength?: number;
  hashSymbol?: string;
  checkedTemplate?: unknown;
  uncheckedTemplate?: unknown;
  label?: { value?: unknown; property?: string | number; position?: 'before' | 'after' };
  numericFormat?: NumericFormat;
  dateFormat?: string;
  timeFormat?: string;
  correctFormat?: boolean;
  source?: unknown[] | ((query: unknown, process: (source: unknown[]) => void) => void);
  strict?: boolean;
  [setting: string]: unknown;
};

/** The grid, as cell types, renderers and validators use it. */
export type GridInstance = Core;

/** Draws a value into a cell. */
export type Renderer = (instance: GridInstance, td: HTMLTableCellElement, row: number, column: number,
  prop: Prop, value: unknown, cellProperties: CellProperties) => void;

/** What a validator's `this` is: the cell's settings, with the grid and the cell's position. */
export type ValidatorContext = CellProperties & { instance: GridInstance; row: number; col: number };

/** Checks a value; calls `callback(valid)`, possibly later. */
export type Validator = (this: ValidatorContext, value: unknown, callback: (valid: boolean) => void) => void;

/** A cell type: an editor, a renderer and a validator under one name, plus default settings. */
export type CellType = { editor?: unknown; renderer?: Renderer; validator?: Validator; [setting: string]: unknown };
