import { readZip, writeZip } from './zip';
import { BUILT_IN_FORMATS, serialToDate } from './formats';
import { formatDate } from './../helpers/dateFormat';
import { formatRange, parseRange, shiftFormula } from './../plugins/conditionalFormatting/ranges';
import type { Rect } from './../plugins/conditionalFormatting/ranges';
import { lineOf, type CellStyle } from './../utils/cellStyle';
import type { Validation } from './../plugins/dataValidation/rules';
import type { ConditionalRule } from './../plugins/conditionalFormatting/conditionalFormatting';

/**
 * A workbook as .xlsx knows it, between FreeSheet and the file: cells with values, formulas, number formats and
 * styles, and each sheet's sizes, hidden and frozen rows and columns, merged cells, comments and conditional
 * formatting. Rows and columns are 0-based.
 */
export type BookCell = {
  value?: string | number | boolean | null;
  formula?: string;
  /** An error value (`#DIV/0!`, …). */
  error?: string;
  /** Excel's number format code (`#,##0.00`, `yyyy-mm-dd`). */
  numFmt?: string;
  style?: CellStyle;
  align?: { horizontal?: string; vertical?: string; wrap?: boolean };
  /** A data validation rule (see the dataValidation plugin). */
  validation?: Validation;
  /** A hyperlink (`https://…`, `mailto:…`). */
  link?: string;
};
export type BookComment = { row: number; column: number; text: string; author?: string };
export type BookSheet = {
  name: string;
  cells: (BookCell | null | undefined)[][];
  /** Pixels, `null` for the default. */
  columnWidths: (number | null | undefined)[];
  rowHeights: (number | null | undefined)[];
  hiddenRows: number[];
  hiddenColumns: number[];
  merges: Rect[];
  frozenRows: number;
  frozenColumns: number;
  comments: BookComment[];
  conditionalFormatting: ConditionalRule[];
  /** Row groups (an outline): rows from `from` to `to`, hidden when collapsed. */
  rowGroups?: { from: number; to: number; collapsed?: boolean }[];
};
export type Book = { sheets: BookSheet[]; active: number };

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const REL_TYPE = `${REL_NS}`;

const escapeXml = (text: unknown): string => String(text)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  // Characters XML does not allow.
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

const columnLetters = (index: number): string => formatRange({ r1: 0, c1: index, r2: 0, c2: index }).replace(/\d+$/, '');
const cellRef = (row: number, column: number): string => `${columnLetters(column)}${row + 1}`;

/** A CSS color (`#rgb`, `#rrggbb`, `rgb(…)`) as Excel's ARGB, or `null`. */
export const toArgb = (color: string | undefined): string | null => {
  if (!color) {
    return null;
  }
  const value = color.trim();
  let hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value)?.[1];

  if (hex && hex.length === 3) {
    hex = hex.split('').map(digit => digit + digit).join('');
  }
  if (!hex) {
    const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(value);

    hex = rgb ? rgb.slice(1, 4).map(part => Math.min(255, Number(part)).toString(16).padStart(2, '0')).join('') :
      void 0;
  }

  return hex ? `FF${hex.toUpperCase()}` : null;
};

/** Excel's ARGB as a CSS color. */
const fromArgb = (argb: string | null | undefined): string | undefined =>
  (argb && /^[0-9a-f]{8}$/i.test(argb) ? `#${argb.slice(2).toLowerCase()}` : argb && /^[0-9a-f]{6}$/i.test(argb) ?
    `#${argb.toLowerCase()}` : void 0);

/** The colors of Office's default theme, for colors given as a theme index. */
const THEME_COLORS = ['FFFFFF', '000000', 'E7E6E6', '44546A', '4472C4', 'ED7D31', 'A5A5A5', 'FFC000', '5B9BD5',
  '70AD47', '0563C1', '954F72'];

/** Column widths: pixels and Excel's character widths (Calibri 11: 7 pixels a character, 5 of padding). */
const pixelsToWidth = (pixels: number): number => Math.round(Math.max(0, pixels - 5) / 7 * 100) / 100;
const widthToPixels = (width: number): number => Math.round(width * 7 + 5);
/** Row heights: pixels and points. */
const pixelsToPoints = (pixels: number): number => Math.round(pixels * 0.75 * 100) / 100;
const pointsToPixels = (points: number): number => Math.round(points / 0.75);

// -- Conditional formatting ---------------------------------------------------------------------------------------

const CELL_IS: Record<string, string> = { gt: 'greaterThan', gte: 'greaterThanOrEqual', lt: 'lessThan',
  lte: 'lessThanOrEqual', eq: 'equal', neq: 'notEqual', between: 'between', not_between: 'notBetween' };
const TIME_PERIODS: Record<string, string> = { date_today: 'today', date_yesterday: 'yesterday',
  date_tomorrow: 'tomorrow', date_last_7_days: 'last7Days', date_this_week: 'thisWeek', date_last_week: 'lastWeek',
  date_next_week: 'nextWeek', date_this_month: 'thisMonth', date_last_month: 'lastMonth',
  date_next_month: 'nextMonth' };
const ICON_SETS: Record<string, string> = { arrows: '3Arrows', trafficLights: '3TrafficLights1', signs: '3Symbols' };

/** A value in a formula: a number as it is, text in quotes. */
const formulaValue = (value: unknown): string => {
  const text = String(value ?? '');

  return text !== '' && Number.isFinite(Number(text)) ? text : `"${text.replace(/"/g, '""')}"`;
};

const fromFormulaValue = (formula: string | undefined): string | number => {
  const text = String(formula ?? '').trim();

  if (/^".*"$/.test(text)) {
    return text.slice(1, -1).replace(/""/g, '"');
  }

  return text !== '' && Number.isFinite(Number(text)) ? Number(text) : text;
};

/** A rule as a `cfRule` element (or `null` when Excel has no such rule), with its `dxf` style index. */
const ruleXml = (rule: ConditionalRule, priority: number, dxf: (style: CellStyle) => number): string | null => {
  const ranges = Array.isArray(rule.range) ? rule.range : [rule.range || 'A1'];
  const first = parseRange(String(ranges[0])) || { r1: 0, c1: 0, r2: 0, c2: 0 };
  const cell = cellRef(first.r1, first.c1);
  const stop = rule.stopIfTrue ? ' stopIfTrue="1"' : '';
  const style = () => ` dxfId="${dxf(rule.style || {})}"`;
  const value = Array.isArray(rule.value) ? rule.value : [rule.value];
  const text = escapeXml(value[0] ?? '');
  const literal = escapeXml(formulaValue(value[0]));

  if (rule.colorScale && rule.colorScale.length >= 2) {
    const colors = rule.colorScale.slice(0, 3);
    const points = colors.length === 3 ? '<cfvo type="min"/><cfvo type="percentile" val="50"/><cfvo type="max"/>' :
      '<cfvo type="min"/><cfvo type="max"/>';

    return `<cfRule type="colorScale" priority="${priority}"><colorScale>${points}${colors.map(color =>
      `<color rgb="${toArgb(color) || 'FF000000'}"/>`).join('')}</colorScale></cfRule>`;
  }
  if (rule.dataBar) {
    const color = typeof rule.dataBar === 'string' ? rule.dataBar : rule.dataBar.color;

    return `<cfRule type="dataBar" priority="${priority}"><dataBar><cfvo type="min"/><cfvo type="max"/><color rgb="${
      toArgb(color) || 'FF638EC6'}"/></dataBar></cfRule>`;
  }
  if (rule.iconSet) {
    return `<cfRule type="iconSet" priority="${priority}"><iconSet iconSet="${ICON_SETS[rule.iconSet] || '3Arrows'
    }"><cfvo type="percent" val="0"/><cfvo type="percent" val="33"/><cfvo type="percent" val="67"/></iconSet></cfRule>`;
  }
  const when = rule.when || '';

  if (when.charAt(0) === '=') {
    return `<cfRule type="expression"${style()} priority="${priority}"${stop}><formula>${escapeXml(when.slice(1))
    }</formula></cfRule>`;
  }
  if (CELL_IS[when]) {
    const formulas = (when === 'between' || when === 'not_between' ? [value[0], value[1]] : [value[0]])
      .map(item => `<formula>${escapeXml(formulaValue(item))}</formula>`).join('');

    return `<cfRule type="cellIs"${style()} priority="${priority}"${stop} operator="${CELL_IS[when]}">${formulas
    }</cfRule>`;
  }
  if (TIME_PERIODS[when]) {
    return `<cfRule type="timePeriod"${style()} priority="${priority}"${stop} timePeriod="${TIME_PERIODS[when]
    }"><formula>FLOOR(${cell},1)=TODAY()</formula></cfRule>`;
  }
  switch (when) {
    case 'contains':
      return `<cfRule type="containsText"${style()} priority="${priority}"${stop} operator="containsText" text="${text
      }"><formula>NOT(ISERROR(SEARCH(${literal},${cell})))</formula></cfRule>`;
    case 'not_contains':
      return `<cfRule type="notContainsText"${style()} priority="${priority}"${stop} operator="notContains" text="${text
      }"><formula>ISERROR(SEARCH(${literal},${cell}))</formula></cfRule>`;
    case 'begins_with':
      return `<cfRule type="beginsWith"${style()} priority="${priority}"${stop} operator="beginsWith" text="${text
      }"><formula>LEFT(${cell},LEN(${literal}))=${literal}</formula></cfRule>`;
    case 'ends_with':
      return `<cfRule type="endsWith"${style()} priority="${priority}"${stop} operator="endsWith" text="${text
      }"><formula>RIGHT(${cell},LEN(${literal}))=${literal}</formula></cfRule>`;
    case 'empty':
      return `<cfRule type="containsBlanks"${style()} priority="${priority}"${stop}><formula>LEN(TRIM(${cell}))=0</formula></cfRule>`;
    case 'not_empty':
      return `<cfRule type="notContainsBlanks"${style()} priority="${priority}"${stop}><formula>LEN(TRIM(${cell}))>0</formula></cfRule>`;
    case 'duplicate':
      return `<cfRule type="duplicateValues"${style()} priority="${priority}"${stop}/>`;
    case 'unique':
      return `<cfRule type="uniqueValues"${style()} priority="${priority}"${stop}/>`;
    case 'top':
    case 'bottom':
      return `<cfRule type="top10"${style()} priority="${priority}"${stop}${rule.percent ? ' percent="1"' : ''}${
        when === 'bottom' ? ' bottom="1"' : ''} rank="${Math.max(1, Math.floor(Number(rule.value) || 10))}"/>`;
    case 'aboveAverage':
    case 'belowAverage':
      return `<cfRule type="aboveAverage"${style()} priority="${priority}"${stop}${when === 'belowAverage' ?
        ' aboveAverage="0"' : ''}/>`;
    default:
      return null;
  }
};

// -- Writing ------------------------------------------------------------------------------------------------------

/** Collects the styles cells and rules use, as `styles.xml`. */
class StyleSheet {
  numFmts = new Map<string, number>();
  fonts = ['<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>'];
  fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
  xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  dxfs: string[] = [];

  #index(list: string[], xml: string): number {
    const index = list.indexOf(xml);

    if (index !== -1) {
      return index;
    }
    list.push(xml);

    return list.length - 1;
  }

  numFmt(code: string | undefined): number {
    if (!code || code === 'General') {
      return 0;
    }
    const builtIn = Object.entries(BUILT_IN_FORMATS).find(([, value]) => value === code);

    if (builtIn) {
      return Number(builtIn[0]);
    }
    if (!this.numFmts.has(code)) {
      this.numFmts.set(code, 164 + this.numFmts.size);
    }

    return this.numFmts.get(code)!;
  }

  fontXml(style: CellStyle, dxf = false): string {
    const bold = /bold|[6-9]00/.test(style.fontWeight || '') ? '<b/>' : '';
    const italic = /italic|oblique/.test(style.fontStyle || '') ? '<i/>' : '';
    const strike = /line-through/.test(style.textDecoration || '') ? '<strike/>' : '';
    const underline = /underline/.test(style.textDecoration || '') ? '<u/>' : '';
    const color = toArgb(style.color);

    return `<font>${bold}${italic}${strike}${underline}${color ? `<color rgb="${color}"/>` : ''}${dxf ? '' :
      '<sz val="11"/><name val="Calibri"/><family val="2"/>'}</font>`;
  }

  fillXml(style: CellStyle, dxf = false): string | null {
    const color = toArgb(style.background);

    if (!color) {
      return null;
    }

    return dxf ? `<fill><patternFill patternType="solid"><bgColor rgb="${color}"/></patternFill></fill>` :
      `<fill><patternFill patternType="solid"><fgColor rgb="${color}"/><bgColor indexed="64"/></patternFill></fill>`;
  }

  borderXml(style: CellStyle): string | null {
    const sides = { left: style.borderLeft, right: style.borderRight, top: style.borderTop, bottom: style.borderBottom };
    const lines = Object.fromEntries(Object.entries(sides).map(([name, value]) => [name, lineOf(value ?? style.border)]));

    if (!Object.values(lines).some(Boolean)) {
      return null;
    }
    const side = (name: string) => {
      const line = lines[name];

      if (!line) {
        return `<${name}/>`;
      }
      const weight = line.width >= 3 ? 'thick' : line.width >= 2 ? 'medium' : 'thin';

      return `<${name} style="${weight}"><color rgb="${toArgb(line.color) || 'FF000000'}"/></${name}>`;
    };

    return `<border>${side('left')}${side('right')}${side('top')}${side('bottom')}<diagonal/></border>`;
  }

  xf(cell: BookCell): number {
    const style = cell.style || {};
    const numFmtId = this.numFmt(cell.numFmt);
    const fontId = this.#index(this.fonts, this.fontXml(style));
    const fill = this.fillXml(style);
    const fillId = fill ? this.#index(this.fills, fill) : 0;
    const border = this.borderXml(style);
    const borderId = border ? this.#index(this.borders, border) : 0;
    const { horizontal, vertical, wrap } = cell.align || {};
    const alignment = horizontal || vertical || wrap ? `<alignment${horizontal ? ` horizontal="${horizontal}"` : ''}${
      vertical ? ` vertical="${vertical === 'middle' ? 'center' : vertical}"` : ''}${wrap ? ' wrapText="1"' : ''}/>` : '';
    const xml = `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0"${
      numFmtId ? ' applyNumberFormat="1"' : ''}${fontId ? ' applyFont="1"' : ''}${fillId ? ' applyFill="1"' : ''}${
      borderId ? ' applyBorder="1"' : ''}${alignment ? ` applyAlignment="1">${alignment}</xf>` : '/>'}`;

    return this.#index(this.xfs, xml);
  }

  dxf(style: CellStyle): number {
    const font = this.fontXml(style, true);
    const xml = `<dxf>${font === '<font></font>' ? '' : font}${this.fillXml(style, true) || ''}${
      this.borderXml(style) || ''}</dxf>`;

    return this.#index(this.dxfs, xml);
  }

  xml(): string {
    const numFmts = this.numFmts.size ? `<numFmts count="${this.numFmts.size}">${Array.from(this.numFmts).map(
      ([code, id]) => `<numFmt numFmtId="${id}" formatCode="${escapeXml(code)}"/>`).join('')}</numFmts>` : '';

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${NS}">${numFmts}<fonts count="${this.fonts.length}">${this.fonts.join('')}</fonts>`
      + `<fills count="${this.fills.length}">${this.fills.join('')}</fills><borders count="${this.borders.length}">${
        this.borders.join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>`
      + `</cellStyleXfs><cellXfs count="${this.xfs.length}">${this.xfs.join('')}</cellXfs><cellStyles count="1">`
      + `<cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="${this.dxfs.length}">${
        this.dxfs.join('')}</dxfs></styleSheet>`;
  }
}

const cellXml = (cell: BookCell, ref: string, styles: StyleSheet): string => {
  const style = styles.xf(cell);
  const s = style ? ` s="${style}"` : '';
  const { value, formula, error } = cell;
  const f = formula ? `<f>${escapeXml(formula.replace(/^=/, ''))}</f>` : '';

  if (error) {
    return `<c r="${ref}"${s} t="e">${f}<v>${escapeXml(error)}</v></c>`;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"${s}>${f}<v>${value}</v></c>`;
  }
  if (typeof value === 'boolean') {
    return `<c r="${ref}"${s} t="b">${f}<v>${value ? 1 : 0}</v></c>`;
  }
  if (value === null || value === void 0 || value === '') {
    return f ? `<c r="${ref}"${s}>${f}</c>` : (style ? `<c r="${ref}"${s}/>` : '');
  }
  if (f) {
    return `<c r="${ref}"${s} t="str">${f}<v>${escapeXml(value)}</v></c>`;
  }

  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
};

const VALIDATION_TYPES: Record<Validation['type'], string> = { list: 'list', number: 'decimal', integer: 'whole',
  date: 'date', textLength: 'textLength' };
const VALIDATION_OPERATORS: Record<string, string> = { between: 'between', notBetween: 'notBetween', equal: 'equal',
  notEqual: 'notEqual', greater: 'greaterThan', less: 'lessThan', greaterOrEqual: 'greaterThanOrEqual',
  lessOrEqual: 'lessThanOrEqual' };

/** A rule's value as an Excel formula: a date as its serial number. */
const validationValue = (rule: Validation, value: unknown): string => {
  if (rule.type === 'date') {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));

    return match ? String(Math.round((Date.UTC(+match[1], +match[2] - 1, +match[3]) - Date.UTC(1899, 11, 30)) /
      86400000)) : String(value);
  }

  return String(value);
};

/** The data validation rules of a sheet: one element per rule, with every cell that has it. */
const validationsXml = (sheet: BookSheet): string => {
  const groups = new Map<string, { rule: Validation; refs: string[] }>();

  sheet.cells.forEach((cells, row) => (cells || []).forEach((cell, column) => {
    if (cell?.validation) {
      const key = JSON.stringify(cell.validation);

      if (!groups.has(key)) {
        groups.set(key, { rule: cell.validation, refs: [] });
      }
      groups.get(key)!.refs.push(cellRef(row, column));
    }
  }));
  if (!groups.size) {
    return '';
  }
  const rules = [...groups.values()].map(({ rule, refs }) => {
    const list = rule.type === 'list';
    const formula1 = list ? (Array.isArray(rule.source) ? `"${rule.source.map(item => String(item).replace(/"/g, '""'))
      .join(',')}"` : String(rule.source || '')) : validationValue(rule, rule.value);
    const between = rule.operator === 'between' || rule.operator === 'notBetween' || !rule.operator;
    const formula2 = !list && between && rule.value2 !== void 0 ? `<formula2>${escapeXml(validationValue(rule,
      rule.value2))}</formula2>` : '';

    return `<dataValidation type="${VALIDATION_TYPES[rule.type]}"${!list ? ` operator="${
      VALIDATION_OPERATORS[rule.operator || 'between']}"` : ''}${rule.allowBlank === false ? '' : ' allowBlank="1"'}${
      rule.strict === false ? ' errorStyle="warning"' : ''}${rule.inputMessage ? ` showInputMessage="1" prompt="${
      escapeXml(rule.inputMessage)}"` : ''} showErrorMessage="1"${rule.message ? ` error="${escapeXml(rule.message)}"` :
      ''} sqref="${refs.join(' ')}"><formula1>${escapeXml(formula1)}</formula1>${formula2}</dataValidation>`;
  });

  return `<dataValidations count="${rules.length}">${rules.join('')}</dataValidations>`;
};
/** The cells of a sheet that have a hyperlink, in reading order (their relationships are `rIdLink1`, `rIdLink2`, …). */
const linksOf = (sheet: BookSheet): { row: number; column: number; link: string }[] => sheet.cells.flatMap((cells, row) =>
  (cells || []).map((cell, column) => (cell && cell.link ? { row, column, link: cell.link } : null))
    .filter((link): link is { row: number; column: number; link: string } => !!link));

const sheetXml = (sheet: BookSheet, index: number, active: boolean, styles: StyleSheet, hasComments: boolean): string => {
  const rows = sheet.cells.length;
  const columns = Math.max(0, ...sheet.cells.map(row => (row ? row.length : 0)), sheet.columnWidths.length);
  const hiddenRows = new Set(sheet.hiddenRows);
  const hiddenColumns = new Set(sheet.hiddenColumns);
  const frozen = sheet.frozenRows || sheet.frozenColumns;
  const pane = frozen ? `<pane${sheet.frozenColumns ? ` xSplit="${sheet.frozenColumns}"` : ''}${sheet.frozenRows ?
    ` ySplit="${sheet.frozenRows}"` : ''} topLeftCell="${cellRef(sheet.frozenRows, sheet.frozenColumns)}" activePane="${
    sheet.frozenRows && sheet.frozenColumns ? 'bottomRight' : sheet.frozenRows ? 'bottomLeft' : 'topRight'}" state="frozen"/>` : '';
  const cols = Array.from({ length: columns }, (_, column) => {
    const width = sheet.columnWidths[column];
    const hidden = hiddenColumns.has(column);

    return width || hidden ? `<col min="${column + 1}" max="${column + 1}" width="${pixelsToWidth(width || 64)}"${
      width ? ' customWidth="1"' : ''}${hidden ? ' hidden="1"' : ''}/>` : '';
  }).join('');
  const groups = sheet.rowGroups || [];
  const levelOf = (row: number) => groups.filter(group => group.from <= row && group.to >= row).length;
  const outlineLevel = groups.reduce((deepest, group) => Math.max(deepest, levelOf(group.from)), 0);
  // A collapsed group hides its rows; the row after it (its summary) is marked collapsed.
  const groupHidden = new Set(groups.filter(group => group.collapsed).flatMap(group => Array.from(
    { length: group.to - group.from + 1 }, (_, i) => group.from + i)));
  const summaries = new Set(groups.filter(group => group.collapsed).map(group => group.to + 1));
  const rowCount = Math.max(rows, sheet.rowHeights.length, ...sheet.hiddenRows.map(row => row + 1),
    ...groups.map(group => group.to + 2));
  const sheetData = Array.from({ length: rowCount }, (_, row) => {
    const cells = (sheet.cells[row] || []).map((cell, column) => (cell ? cellXml(cell, cellRef(row, column), styles) :
      '')).join('');
    const height = sheet.rowHeights[row];
    const hidden = hiddenRows.has(row) || groupHidden.has(row);
    const level = levelOf(row);
    const outline = `${level ? ` outlineLevel="${level}"` : ''}${summaries.has(row) ? ' collapsed="1"' : ''}`;

    return cells || height || hidden || outline ? `<row r="${row + 1}"${height ? ` ht="${pixelsToPoints(height)}" ` +
      'customHeight="1"' : ''}${hidden ? ' hidden="1"' : ''}${outline}>${cells}</row>` : '';
  }).join('');
  const merges = sheet.merges.length ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map(rect =>
    `<mergeCell ref="${formatRange(rect)}"/>`).join('')}</mergeCells>` : '';
  let priority = 1;
  const formatting = sheet.conditionalFormatting.map((rule) => {
    const xml = ruleXml(rule, priority, style => styles.dxf(style));

    if (!xml) {
      return '';
    }
    priority += 1;
    const ranges = Array.isArray(rule.range) ? rule.range : [rule.range || 'A1'];

    return `<conditionalFormatting sqref="${escapeXml(ranges.join(' '))}">${xml}</conditionalFormatting>`;
  }).join('');
  const links = linksOf(sheet);
  const hyperlinks = links.length ? `<hyperlinks>${links.map((link, i) => `<hyperlink ref="${
    cellRef(link.row, link.column)}" r:id="rIdLink${i + 1}"/>`).join('')}</hyperlinks>` : '';
  const dimension = rows && columns ? formatRange({ r1: 0, c1: 0, r2: Math.max(0, rows - 1), c2: Math.max(0, columns - 1) }) :
    'A1';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${NS}" xmlns:r="${REL_NS}"><dimension ref="${dimension}"/><sheetViews><sheetView${active ?
    ' tabSelected="1"' : ''} workbookViewId="0">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"${
    outlineLevel ? ` outlineLevelRow="${outlineLevel}"` : ''}/>${
    cols ? `<cols>${cols}</cols>` : ''}<sheetData>${sheetData}</sheetData>${merges}${formatting}${validationsXml(sheet)}${hasComments ?
    cols ? `<cols>${cols}</cols>` : ''}<sheetData>${sheetData}</sheetData>${merges}${formatting}${hyperlinks}${hasComments ?
    `<legacyDrawing r:id="rIdVml${index}"/>` : ''}</worksheet>`;
};

const commentsXml = (comments: BookComment[]): string => {
  const authors = Array.from(new Set(comments.map(comment => comment.author || '')));

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<comments xmlns="${NS}"><authors>${authors.map(author => `<author>${escapeXml(author)}</author>`).join('')}</authors>`
    + `<commentList>${comments.map(comment => `<comment ref="${cellRef(comment.row, comment.column)}" authorId="${
      authors.indexOf(comment.author || '')}"><text><r><t xml:space="preserve">${escapeXml(comment.text)}</t></r></text>`
      + '</comment>').join('')}</commentList></comments>`;
};

/** The VML shapes Excel needs to show notes. */
const vmlXml = (comments: BookComment[]): string => `<xml xmlns:v="urn:schemas-microsoft-com:vml"
 xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="1"/></o:shapelayout>
<v:shapetype id="_x0000_t202" coordsize="21600,21600" o:spt="202" path="m,l,21600r21600,l21600,xe">
<v:stroke joinstyle="miter"/><v:path gradientshapeok="t" o:connecttype="rect"/></v:shapetype>
${comments.map((comment, i) => `<v:shape id="_x0000_s${1025 + i}" type="#_x0000_t202"
 style="position:absolute;margin-left:59.25pt;margin-top:1.5pt;width:108pt;height:59.25pt;z-index:${i + 1};visibility:hidden"
 fillcolor="#ffffe1" o:insetmode="auto"><v:fill color2="#ffffe1"/><v:shadow on="t" color="black" obscured="t"/>
<v:path o:connecttype="none"/><v:textbox style="mso-direction-alt:auto"><div style="text-align:left"></div></v:textbox>
<x:ClientData ObjectType="Note"><x:MoveWithCells/><x:SizeWithCells/><x:AutoFill>False</x:AutoFill>
<x:Row>${comment.row}</x:Row><x:Column>${comment.column}</x:Column></x:ClientData></v:shape>`).join('\n')}
</xml>`;

const encoder = new TextEncoder();

/** A workbook as the bytes of an .xlsx file. */
export const writeXlsx = async(book: Book): Promise<Uint8Array> => {
  const styles = new StyleSheet();
  const files: { name: string; content: string }[] = [];
  const overrides: string[] = [];
  const sheetEntries = book.sheets.map((sheet, index) => {
    const number = index + 1;
    const hasComments = sheet.comments.length > 0;
    const xml = sheetXml(sheet, number, index === book.active, styles, hasComments);

    files.push({ name: `xl/worksheets/sheet${number}.xml`, content: xml });
    overrides.push(`<Override PartName="/xl/worksheets/sheet${number}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
    const relationshipsXml: string[] = linksOf(sheet).map((link, i) => `<Relationship Id="rIdLink${i + 1}" Type="${
      REL_TYPE}/hyperlink" Target="${escapeXml(link.link)}" TargetMode="External"/>`);

    if (hasComments) {
      files.push({ name: `xl/comments${number}.xml`, content: commentsXml(sheet.comments) });
      files.push({ name: `xl/drawings/vmlDrawing${number}.vml`, content: vmlXml(sheet.comments) });
      relationshipsXml.push(`<Relationship Id="rIdComments${number}" Type="${REL_TYPE}/comments" Target="../comments${
        number}.xml"/>`, `<Relationship Id="rIdVml${number}" Type="${REL_TYPE}/vmlDrawing" Target="../drawings/vmlDrawing${
        number}.vml"/>`);
      overrides.push(`<Override PartName="/xl/comments${number}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"/>`);
    }
    if (relationshipsXml.length) {
      files.push({ name: `xl/worksheets/_rels/sheet${number}.xml.rels`, content: `<?xml version="1.0" encoding="UTF-8" ${
        ''}standalone="yes"?>\n<Relationships xmlns="${PKG_REL_NS}">${relationshipsXml.join('')}</Relationships>` });
    }

    return `<sheet name="${escapeXml(sheet.name)}" sheetId="${number}" r:id="rIdSheet${number}"/>`;
  });

  files.unshift(
    { name: '[Content_Types].xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
      + '<Default Extension="xml" ContentType="application/xml"/><Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
      + `${overrides.join('')}</Types>` },
    { name: '_rels/.rels', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PKG_REL_NS}"><Relationship Id="rId1" Type="${REL_TYPE}/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${NS}" xmlns:r="${REL_NS}"><bookViews><workbookView activeTab="${book.active}"/></bookViews><sheets>${
  sheetEntries.join('')}</sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PKG_REL_NS}">${book.sheets.map((_, index) => `<Relationship Id="rIdSheet${index + 1}" Type="${
  REL_TYPE}/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}<Relationship Id="rIdStyles" Type="${
  REL_TYPE}/styles" Target="styles.xml"/></Relationships>` },
  );
  // After the sheets: they collect the styles.
  files.push({ name: 'xl/styles.xml', content: styles.xml() });

  return writeZip(files.map(({ name, content }) => ({ name, data: encoder.encode(content) })));
};

// -- Reading ------------------------------------------------------------------------------------------------------

const decoder = new TextDecoder();

const parseXml = (bytes: Uint8Array | undefined): Document | null => (bytes ?
  new DOMParser().parseFromString(decoder.decode(bytes), 'application/xml') : null);

/** The child elements of a node with a local name (namespaces ignored). */
const children = (node: Element | Document | null | undefined, name: string): Element[] => (node ?
  Array.from((node as Element).children || (node as Document).documentElement?.children || [])
    .filter(child => child.localName === name) : []);
const child = (node: Element | Document | null | undefined, name: string): Element | undefined =>
  children(node, name)[0];
const all = (node: Element | Document | null | undefined, name: string): Element[] => (node ?
  Array.from(node.getElementsByTagNameNS('*', name)) : []);
const attr = (node: Element | undefined, name: string): string | null => (node ? node.getAttribute(name) : null);

/** The path a relationship target points to, from the part that has the relationship. */
const resolve = (from: string, target: string): string => {
  if (target.charAt(0) === '/') {
    return target.slice(1);
  }
  const parts = from.split('/').slice(0, -1);

  target.split('/').forEach((part) => {
    if (part === '..') {
      parts.pop();
    } else if (part !== '.') {
      parts.push(part);
    }
  });

  return parts.join('/');
};

const relationships = (files: Map<string, Uint8Array>, part: string):
  Map<string, { type: string; target: string; external: boolean; href: string }> => {
  const folder = part.split('/').slice(0, -1).join('/');
  const name = part.split('/').pop();
  const xml = parseXml(files.get(`${folder ? `${folder}/` : ''}_rels/${name}.rels`));
  const map = new Map<string, { type: string; target: string; external: boolean; href: string }>();

  all(xml, 'Relationship').forEach((relationship) => {
    const href = attr(relationship, 'Target') || '';

    map.set(attr(relationship, 'Id') || '', { type: attr(relationship, 'Type') || '', target: resolve(part, href),
      external: attr(relationship, 'TargetMode') === 'External', href });
  });

  return map;
};

const colorOf = (node: Element | undefined): string | undefined => {
  if (!node) {
    return void 0;
  }
  const rgb = attr(node, 'rgb');

  if (rgb) {
    return fromArgb(rgb);
  }
  const theme = attr(node, 'theme');

  return theme !== null && THEME_COLORS[Number(theme)] ? `#${THEME_COLORS[Number(theme)].toLowerCase()}` : void 0;
};

const fontStyle = (font: Element | undefined): CellStyle => {
  const style: CellStyle = {};

  if (!font) {
    return style;
  }
  if (child(font, 'b') && attr(child(font, 'b'), 'val') !== '0') {
    style.fontWeight = 'bold';
  }
  if (child(font, 'i') && attr(child(font, 'i'), 'val') !== '0') {
    style.fontStyle = 'italic';
  }
  const decorations = [child(font, 'u') && attr(child(font, 'u'), 'val') !== 'none' ? 'underline' : '',
    child(font, 'strike') && attr(child(font, 'strike'), 'val') !== '0' ? 'line-through' : ''].filter(Boolean);

  if (decorations.length) {
    style.textDecoration = decorations.join(' ');
  }
  const color = colorOf(child(font, 'color'));

  // Black text is the default.
  if (color && color !== '#000000') {
    style.color = color;
  }

  return style;
};

const fillStyle = (fill: Element | undefined, dxf = false): CellStyle => {
  const pattern = child(fill, 'patternFill');
  const type = attr(pattern, 'patternType');

  if (!pattern || (type && type !== 'solid')) {
    return {};
  }
  const color = colorOf(child(pattern, dxf ? 'bgColor' : 'fgColor')) || colorOf(child(pattern, dxf ? 'fgColor' : 'bgColor'));

  return color ? { background: color } : {};
};

const BORDER_WIDTHS: Record<string, number> = { thin: 1, hair: 1, dotted: 1, dashed: 1, medium: 2, mediumDashed: 2,
  thick: 3, double: 3 };

/** A cell's borders: `border` when every side has the same line, otherwise each side's own. */
const borderStyle = (border: Element | undefined): CellStyle => {
  const keys = { top: 'borderTop', right: 'borderRight', bottom: 'borderBottom', left: 'borderLeft' } as const;
  const lines = (Object.keys(keys) as (keyof typeof keys)[]).map((name) => {
    const element = child(border, name);
    const weight = element && attr(element, 'style');

    return [name, weight ? `${BORDER_WIDTHS[weight] || 1}px solid ${colorOf(child(element, 'color')) || '#000000'}` :
      null] as const;
  });
  const drawn = lines.filter(([, line]) => line);

  if (!drawn.length) {
    return {};
  }
  if (drawn.length === 4 && drawn.every(([, line]) => line === drawn[0][1])) {
    return { border: drawn[0][1]! };
  }

  return Object.fromEntries(drawn.map(([name, line]) => [keys[name], line])) as CellStyle;
};

/**
 * The row groups of an outline: for each level, every run of rows at that level or deeper is a group. A group is
 * collapsed when the row after it (its summary row) is marked collapsed, or when all its rows are hidden.
 */
const groupsFromLevels = (levels: number[], collapsedRows: Set<number>, hiddenRows: Set<number>):
  NonNullable<BookSheet['rowGroups']> => {
  const groups: NonNullable<BookSheet['rowGroups']> = [];
  const deepest = Math.max(0, ...levels.filter(Boolean));

  for (let level = 1; level <= deepest; level += 1) {
    let from = -1;

    for (let row = 0; row <= levels.length; row += 1) {
      const inside = (levels[row] || 0) >= level;

      if (inside && from < 0) {
        from = row;
      } else if (!inside && from >= 0) {
        const to = row - 1;
        const allHidden = Array.from({ length: to - from + 1 }, (_, i) => from + i).every(index => hiddenRows.has(index));

        groups.push({ from, to, ...(collapsedRows.has(row) || allHidden ? { collapsed: true } : {}) });
        from = -1;
      }
    }
  }

  return groups.sort((a, b) => a.from - b.from || b.to - a.to);
};

const RULE_FROM_CELL_IS = Object.fromEntries(Object.entries(CELL_IS).map(([key, value]) => [value, key]));
const RULE_FROM_PERIOD = Object.fromEntries(Object.entries(TIME_PERIODS).map(([key, value]) => [value, key]));
const RULE_FROM_ICONS: Record<string, ConditionalRule['iconSet']> = { '3Arrows': 'arrows', '3ArrowsGray': 'arrows',
  '3TrafficLights1': 'trafficLights', '3TrafficLights2': 'trafficLights', '3Signs': 'trafficLights',
  '3Symbols': 'signs', '3Symbols2': 'signs', '3Flags': 'trafficLights' };

/** A `cfRule` as a FreeSheet rule, or `null` when FreeSheet has no such rule. */
const ruleFromXml = (element: Element, range: string[], dxfs: CellStyle[]): ConditionalRule | null => {
  const type = attr(element, 'type');
  const dxfId = attr(element, 'dxfId');
  const style = dxfId !== null ? dxfs[Number(dxfId)] : void 0;
  const formulas = children(element, 'formula').map(formula => formula.textContent || '');
  const base: ConditionalRule = { range: range.length === 1 ? range[0] : range };

  if (style && Object.keys(style).length) {
    base.style = style;
  }
  if (attr(element, 'stopIfTrue') === '1') {
    base.stopIfTrue = true;
  }
  const text = attr(element, 'text') ?? '';

  switch (type) {
    case 'cellIs': {
      const when = RULE_FROM_CELL_IS[attr(element, 'operator') || ''];

      if (!when) {
        return null;
      }

      return { ...base, when, value: when === 'between' || when === 'not_between' ?
        [fromFormulaValue(formulas[0]), fromFormulaValue(formulas[1])] : fromFormulaValue(formulas[0]) };
    }
    case 'expression':
      return formulas[0] ? { ...base, when: `=${formulas[0]}` } : null;
    case 'containsText':
      return { ...base, when: 'contains', value: text };
    case 'notContainsText':
      return { ...base, when: 'not_contains', value: text };
    case 'beginsWith':
      return { ...base, when: 'begins_with', value: text };
    case 'endsWith':
      return { ...base, when: 'ends_with', value: text };
    case 'containsBlanks':
      return { ...base, when: 'empty' };
    case 'notContainsBlanks':
      return { ...base, when: 'not_empty' };
    case 'duplicateValues':
      return { ...base, when: 'duplicate' };
    case 'uniqueValues':
      return { ...base, when: 'unique' };
    case 'timePeriod': {
      const when = RULE_FROM_PERIOD[attr(element, 'timePeriod') || ''];

      return when ? { ...base, when } : null;
    }
    case 'top10':
      return { ...base, when: attr(element, 'bottom') === '1' ? 'bottom' : 'top',
        value: Number(attr(element, 'rank') || 10), ...(attr(element, 'percent') === '1' ? { percent: true } : {}) };
    case 'aboveAverage':
      return { ...base, when: attr(element, 'aboveAverage') === '0' ? 'belowAverage' : 'aboveAverage' };
    case 'colorScale': {
      const colors = children(child(element, 'colorScale'), 'color').map(color => colorOf(color) || '#ffffff');

      return colors.length >= 2 ? { range: base.range, colorScale: colors } : null;
    }
    case 'dataBar':
      return { range: base.range, dataBar: colorOf(child(child(element, 'dataBar'), 'color')) || '#638ec6' };
    case 'iconSet': {
      const set = RULE_FROM_ICONS[attr(child(element, 'iconSet'), 'iconSet') || '3TrafficLights1'];

      return set ? { range: base.range, iconSet: set } : null;
    }
    default:
      return null;
  }
};

const ALIGN_VERTICAL: Record<string, string> = { top: 'top', center: 'middle', bottom: 'bottom' };

/** The workbook of an .xlsx file. */
export const readXlsx = async(bytes: Uint8Array): Promise<Book> => {
  const files = await readZip(bytes);
  const workbookPath = Array.from(relationships(files, '').values())
    .find(relationship => /officeDocument$/.test(relationship.type))?.target || 'xl/workbook.xml';
  const workbook = parseXml(files.get(workbookPath));

  if (!workbook) {
    throw new Error('Not an Excel workbook (no workbook part).');
  }
  const workbookRels = relationships(files, workbookPath);
  const target = (type: RegExp) => Array.from(workbookRels.values()).find(relationship =>
    type.test(relationship.type))?.target;
  const shared = all(parseXml(files.get(target(/sharedStrings$/) || '')), 'si')
    .map(item => all(item, 't').map(text => text.textContent || '').join(''));

  // Styles: number formats, fonts, fills, borders, cell formats and the styles of conditional formatting.
  const styles = parseXml(files.get(target(/styles$/) || ''));
  const numFmts = new Map<number, string>(Object.entries(BUILT_IN_FORMATS).map(([id, code]) => [Number(id), code]));

  all(styles, 'numFmt').forEach(numFmt => numFmts.set(Number(attr(numFmt, 'numFmtId')), attr(numFmt, 'formatCode') || ''));
  const fonts = children(child(styles?.documentElement, 'fonts'), 'font');
  const fills = children(child(styles?.documentElement, 'fills'), 'fill');
  const borders = children(child(styles?.documentElement, 'borders'), 'border');
  const xfs = children(child(styles?.documentElement, 'cellXfs'), 'xf').map((xf) => {
    const alignment = child(xf, 'alignment');
    const style = { ...fontStyle(fonts[Number(attr(xf, 'fontId') || 0)]),
      ...fillStyle(fills[Number(attr(xf, 'fillId') || 0)]), ...borderStyle(borders[Number(attr(xf, 'borderId') || 0)]) };
    const horizontal = attr(alignment, 'horizontal');
    const vertical = attr(alignment, 'vertical');
    const align = { ...(horizontal && horizontal !== 'general' ? { horizontal } : {}),
      ...(vertical && ALIGN_VERTICAL[vertical] ? { vertical: ALIGN_VERTICAL[vertical] } : {}),
      ...(attr(alignment, 'wrapText') === '1' ? { wrap: true } : {}) };

    return { numFmt: numFmts.get(Number(attr(xf, 'numFmtId') || 0)), style, align };
  });
  const dxfs = children(child(styles?.documentElement, 'dxfs'), 'dxf').map(dxf => ({
    ...fontStyle(child(dxf, 'font')), ...fillStyle(child(dxf, 'fill'), true), ...borderStyle(child(dxf, 'border')) }));

  const sheetElements = all(workbook, 'sheet');
  const activeTab = Number(attr(all(workbook, 'workbookView')[0], 'activeTab') || 0);
  const sheets: BookSheet[] = sheetElements.map((sheetElement) => {
    const id = sheetElement.getAttributeNS(REL_NS, 'id') || attr(sheetElement, 'r:id') || '';
    const path = workbookRels.get(id)?.target || '';
    const xml = parseXml(files.get(path));
    const sheet: BookSheet = { name: attr(sheetElement, 'name') || 'Sheet', cells: [], columnWidths: [],
      rowHeights: [], hiddenRows: [], hiddenColumns: [], merges: [], frozenRows: 0, frozenColumns: 0, comments: [],
      conditionalFormatting: [] };
    const sharedFormulas = new Map<string, { formula: string; row: number; column: number }>();
    let nextRow = 0;
    const levels: number[] = [];
    const collapsedRows = new Set<number>();

    all(xml, 'row').forEach((rowElement) => {
      const row = attr(rowElement, 'r') ? Number(attr(rowElement, 'r')) - 1 : nextRow;
      let nextColumn = 0;

      nextRow = row + 1;
      if (attr(rowElement, 'customHeight') === '1' && attr(rowElement, 'ht')) {
        sheet.rowHeights[row] = pointsToPixels(Number(attr(rowElement, 'ht')));
      }
      if (attr(rowElement, 'hidden') === '1') {
        sheet.hiddenRows.push(row);
      }
      if (Number(attr(rowElement, 'outlineLevel')) > 0) {
        levels[row] = Number(attr(rowElement, 'outlineLevel'));
      }
      if (attr(rowElement, 'collapsed') === '1') {
        collapsedRows.add(row);
      }
      children(rowElement, 'c').forEach((cellElement) => {
        const ref = parseRange(attr(cellElement, 'r') || '');
        const column = ref ? ref.c1 : nextColumn;

        nextColumn = column + 1;
        const type = attr(cellElement, 't');
        const v = child(cellElement, 'v')?.textContent ?? null;
        const f = child(cellElement, 'f');
        const xf = xfs[Number(attr(cellElement, 's') || 0)];
        const cell: BookCell = {};

        if (type === 's') {
          cell.value = shared[Number(v)] ?? '';
        } else if (type === 'inlineStr') {
          cell.value = all(child(cellElement, 'is'), 't').map(text => text.textContent || '').join('');
        } else if (type === 'b') {
          cell.value = v === '1';
        } else if (type === 'e') {
          cell.error = v || '#N/A';
        } else if (type === 'str') {
          cell.value = v ?? '';
        } else if (v !== null && v !== '') {
          cell.value = Number(v);
        }
        if (f) {
          const si = attr(f, 'si');
          const text = f.textContent || '';

          if (attr(f, 't') === 'shared' && si !== null) {
            if (text) {
              sharedFormulas.set(si, { formula: text, row, column });
              cell.formula = `=${text}`;
            } else if (sharedFormulas.has(si)) {
              const master = sharedFormulas.get(si)!;

              cell.formula = `=${shiftFormula(master.formula, row - master.row, column - master.column)}`;
            }
          } else if (text) {
            cell.formula = `=${text}`;
          }
        }
        if (xf) {
          if (xf.numFmt && xf.numFmt !== 'General') {
            cell.numFmt = xf.numFmt;
          }
          if (Object.keys(xf.style).length) {
            cell.style = xf.style;
          }
          if (Object.keys(xf.align).length) {
            cell.align = xf.align;
          }
        }
        if (Object.keys(cell).length) {
          (sheet.cells[row] = sheet.cells[row] || [])[column] = cell;
        }
      });
    });
    const groups = groupsFromLevels(levels, collapsedRows, new Set(sheet.hiddenRows));

    if (groups.length) {
      sheet.rowGroups = groups;
      // The rows a collapsed group hides are the group's, not hidden rows of their own.
      const inCollapsed = (row: number) => groups.some(group => group.collapsed && row >= group.from && row <= group.to);

      sheet.hiddenRows = sheet.hiddenRows.filter(row => !inCollapsed(row));
    }
    all(xml, 'col').forEach((col) => {
      const min = Number(attr(col, 'min')) - 1;
      const max = Math.min(Number(attr(col, 'max')) - 1, min + 16383);

      for (let column = min; column <= max; column += 1) {
        if (attr(col, 'customWidth') === '1' && attr(col, 'width')) {
          sheet.columnWidths[column] = widthToPixels(Number(attr(col, 'width')));
        }
        if (attr(col, 'hidden') === '1') {
          sheet.hiddenColumns.push(column);
        }
      }
    });
    // Columns hidden at the end of a sheet (Excel writes up to XFD) only count within the data.
    const columnCount = Math.max(0, ...sheet.cells.map(row => (row ? row.length : 0)));

    sheet.hiddenColumns = sheet.hiddenColumns.filter(column => column < Math.max(columnCount, sheet.columnWidths.length));
    sheet.columnWidths.length = Math.min(sheet.columnWidths.length, Math.max(columnCount, 1));
    all(xml, 'mergeCell').forEach((merge) => {
      const rect = parseRange(attr(merge, 'ref') || '');

      if (rect) {
        sheet.merges.push(rect);
      }
    });
    const pane = all(xml, 'pane')[0];

    if (pane && /frozen/.test(attr(pane, 'state') || '')) {
      sheet.frozenRows = Number(attr(pane, 'ySplit') || 0);
      sheet.frozenColumns = Number(attr(pane, 'xSplit') || 0);
    }
    const rules: { priority: number; rule: ConditionalRule }[] = [];

    all(xml, 'conditionalFormatting').forEach((formatting) => {
      const ranges = (attr(formatting, 'sqref') || '').split(/\s+/).filter(Boolean);

      children(formatting, 'cfRule').forEach((element) => {
        const rule = ruleFromXml(element, ranges, dxfs);

        if (rule) {
          rules.push({ priority: Number(attr(element, 'priority') || 0), rule });
        }
      });
    });
    sheet.conditionalFormatting = rules.sort((a, b) => a.priority - b.priority).map(({ rule }) => rule);

    // Data validation: each rule on the cells of its ranges (whole columns only as far as the data goes).
    const TYPES = Object.fromEntries(Object.entries(VALIDATION_TYPES).map(([key, value]) => [value, key]));
    const OPERATORS = Object.fromEntries(Object.entries(VALIDATION_OPERATORS).map(([key, value]) => [value, key]));

    all(xml, 'dataValidation').forEach((element) => {
      const type = TYPES[attr(element, 'type') || ''] as Validation['type'] | undefined;
      const formula1 = child(element, 'formula1')?.textContent ?? '';
      const formula2 = child(element, 'formula2')?.textContent;

      if (!type) {
        return;
      }
      const value = (text: string) => (type === 'date' ? formatDate(serialToDate(Number(text)), 'YYYY-MM-DD') :
        Number(text));
      const rule: Validation = { type };

      if (type === 'list') {
        rule.source = /^".*"$/s.test(formula1) ? formula1.slice(1, -1).split(',').map(item => item.replace(/""/g, '"')) :
          formula1.replace(/\$/g, '');
      } else {
        rule.operator = (OPERATORS[attr(element, 'operator') || 'between'] || 'between') as Validation['operator'];
        rule.value = value(formula1);
        if (formula2 !== void 0 && (rule.operator === 'between' || rule.operator === 'notBetween')) {
          rule.value2 = value(formula2);
        }
      }
      if (attr(element, 'allowBlank') !== '1') {
        rule.allowBlank = false;
      }
      if (attr(element, 'errorStyle') === 'warning' || attr(element, 'errorStyle') === 'information') {
        rule.strict = false;
      }
      if (attr(element, 'error')) {
        rule.message = attr(element, 'error')!;
      }
      if (attr(element, 'prompt')) {
        rule.inputMessage = attr(element, 'prompt')!;
      }
      (attr(element, 'sqref') || '').split(/\s+/).forEach((ref) => {
        const rect = parseRange(ref);

        if (!rect) {
          return;
        }
        const lastRow = Math.min(rect.r2, Math.max(sheet.cells.length - 1, rect.r1 + 999));
        const lastColumn = Math.min(rect.c2, rect.c1 + 255);

        for (let row = rect.r1; row <= lastRow; row += 1) {
          for (let column = rect.c1; column <= lastColumn; column += 1) {
            const cells = (sheet.cells[row] = sheet.cells[row] || []);

            cells[column] = { ...cells[column], validation: rule };
          }
        }
      });
    });

    // Notes: the comments part of the sheet.
    const sheetRels = relationships(files, path);

    // Hyperlinks to web pages and mail addresses (links inside the workbook are left out).
    all(xml, 'hyperlink').forEach((hyperlink) => {
      const ref = parseRange(attr(hyperlink, 'ref') || '');
      const id = hyperlink.getAttributeNS(REL_NS, 'id') || attr(hyperlink, 'r:id') || '';
      const target = sheetRels.get(id);

      if (ref && target?.external && /^(https?:|mailto:)/i.test(target.href)) {
        const cells = (sheet.cells[ref.r1] = sheet.cells[ref.r1] || []);

        cells[ref.c1] = { ...cells[ref.c1], link: target.href };
      }
    });

    // Notes: the comments part of the sheet.
    const commentsPath = Array.from(sheetRels.values()).find(relationship => /\/comments$/.test(relationship.type))
      ?.target;
    const comments = parseXml(files.get(commentsPath || ''));
    const authors = all(comments, 'author').map(author => author.textContent || '');

    all(comments, 'comment').forEach((comment) => {
      const ref = parseRange(attr(comment, 'ref') || '');
      const author = authors[Number(attr(comment, 'authorId') || 0)];

      if (ref) {
        sheet.comments.push({ row: ref.r1, column: ref.c1,
          text: all(child(comment, 'text'), 't').map(text => text.textContent || '').join(''),
          ...(author ? { author } : {}) });
      }
    });

    return sheet;
  });

  return { sheets, active: Math.min(activeTab, Math.max(0, sheets.length - 1)) };
};
