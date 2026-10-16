import BasePlugin from './../_base';
import { registerPlugin } from './../../plugins';
import { addClass } from './../../helpers/dom/element';

/**
 * The part of a formula engine model the plugin uses. IronCalc's `Model` (`@ironcalc/wasm`) has it: rows and columns
 * are 1-based, sheet 0 is the only sheet.
 */
export type FormulaModel = {
  setUserInput(sheet: number, row: number, column: number, input: string): void;
  getCellContent(sheet: number, row: number, column: number): string;
  getFormattedCellValue(sheet: number, row: number, column: number): string;
  getCellType(sheet: number, row: number, column: number): number;
  insertRows(sheet: number, row: number, count: number): void;
  deleteRows(sheet: number, row: number, count: number): void;
  insertColumns(sheet: number, column: number, count: number): void;
  deleteColumns(sheet: number, column: number, count: number): void;
  pauseEvaluation(): void;
  resumeEvaluation(): void;
  evaluate(): void;
  free?(): void;
};

/** The `formulas` setting: the engine's model class, and optionally its locale and time zone. */
export type FormulasSettings = {
  engine: new (name: string, locale: string, timezone: string, language: string) => FormulaModel;
  locale?: string;
  timezone?: string;
  language?: string;
};

/** The cell types of the engine (`getCellType`). */
const CELL_TYPE = { NUMBER: 1, TEXT: 2, BOOLEAN: 4, ERROR: 16 };
const SHEET = 0;
/** The class of a formula cell whose result is an error (`#DIV/0!`, `#REF!`, …). */
export const ERROR_CLASS_NAME = 'fs-formula-error';

const isFormula = (value: unknown): value is string => typeof value === 'string' && value.charAt(0) === '=';

/** The text the engine gets for a cell value. */
const toInput = (value: unknown): string => {
  if (value === null || value === void 0) {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }

  return String(value);
};

/**
 * Formulas: a cell whose value starts with `=` shows the result of the formula. The grid keeps the formula as the
 * cell's source value (the editor shows it); `getDataAtCell` and the renderers get the result. The calculation is done
 * by a formula engine passed in the settings, for example IronCalc:
 *
 * ```js
 * import init, { Model } from '@ironcalc/wasm';
 *
 * await init();
 * new FreeSheet(container, { data, formulas: { engine: Model } });
 * ```
 *
 * References follow the data rows and columns: sorting or moving rows only changes how they are shown. Inserting and
 * removing rows and columns moves the references, and the grid's formulas are updated to match.
 */
class Formulas extends BasePlugin {
  /** The engine's model of the sheet, while the plugin is enabled. */
  model: FormulaModel | null = null;

  isEnabled(): boolean {
    const settings = this.hot.getSettings().formulas as FormulasSettings | undefined;

    return !!settings && typeof settings.engine === 'function';
  }

  enablePlugin(): void {
    if (this.enabled) {
      return;
    }
    this.addHook('afterLoadData', () => this.recalculateFull());
    // Before the grid renders the change (afterChange runs after the render).
    this.addHook('beforeChangeRender', (changes: [number, string | number, unknown, unknown][] | null, source: string) =>
      this.onBeforeChangeRender(changes, source));
    this.addHook('modifyData', (row: number, column: number, valueHolder: { value: unknown }, ioMode: string) =>
      this.onModifyData(row, column, valueHolder, ioMode));
    this.addHook('afterCreateRow', (index: number, amount: number) => this.onStructureChange(() =>
      this.model!.insertRows(SHEET, index + 1, amount)));
    this.addHook('afterRemoveRow', (_index: number, _amount: number, physicalRows: number[] = []) =>
      this.onStructureChange(() => [...physicalRows].sort((a, b) => b - a)
        .forEach(row => this.model!.deleteRows(SHEET, row + 1, 1))));
    this.addHook('afterCreateCol', (index: number, amount: number) => this.onStructureChange(() =>
      this.model!.insertColumns(SHEET, index + 1, amount)));
    this.addHook('afterRemoveCol', (_index: number, _amount: number, physicalColumns: number[] = []) =>
      this.onStructureChange(() => [...physicalColumns].sort((a, b) => b - a)
        .forEach(column => this.model!.deleteColumns(SHEET, column + 1, 1))));
    this.addHook('afterRenderer', (TD: HTMLTableCellElement, row: number, column: number) =>
      this.onAfterRenderer(TD, row, column));

    super.enablePlugin();

    // At start-up the data is not loaded yet: `afterLoadData` builds the model. Enabled later, build it now.
    if (this.hot.view) {
      this.recalculateFull();
    }
  }

  disablePlugin(): void {
    this.freeModel();
    super.disablePlugin();
  }

  updatePlugin(): void {
    this.disablePlugin();
    this.enablePlugin();
    super.updatePlugin();
  }

  destroy(): void {
    this.freeModel();
    super.destroy();
  }

  /**
   * The formula of a cell (its source value), or `null` when the cell has none.
   *
   * @param row Visual row index.
   * @param column Visual column index.
   */
  getFormula(row: number, column: number): string | null {
    const value = this.hot.getSourceDataAtCell(this.hot.toPhysicalRow(row), column);

    return isFormula(value) ? value : null;
  }

  /** Builds the engine's model again from the whole source data. */
  recalculateFull(): void {
    if (!this.enabled && !this.isEnabled()) {
      return;
    }
    const settings = this.hot.getSettings().formulas as FormulasSettings;

    this.freeModel();
    this.model = new settings.engine('FreeSheet', settings.locale || 'en', settings.timezone || 'UTC',
      settings.language || 'en');
    this.model.pauseEvaluation();

    const rows = this.hot.countSourceRows();
    const columns = this.hot.countSourceCols();

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const input = toInput(this.readSource(row, column));

        if (input !== '') {
          this.model.setUserInput(SHEET, row + 1, column + 1, input);
        }
      }
    }
    this.model.resumeEvaluation();
    this.model.evaluate();
  }

  /** Kept for undo, which reports restored cells; the full recalculation that follows covers them. */
  onAfterSetDataAtCell(): void {}

  /** The source value at a physical row and column. */
  readSource(row: number, column: number): unknown {
    return this.hot.getSourceDataAtCell(row, this.hot.toVisualColumn(column));
  }

  /** Writes a source value without running the change hooks (the engine already has the change). */
  writeSource(row: number, column: number, value: string): void {
    const sourceRow = this.hot.getSourceDataAtRow(row) as unknown;

    if (Array.isArray(sourceRow)) {
      sourceRow[column] = value;

      return;
    }
    const prop = this.hot.colToProp(this.hot.toVisualColumn(column));

    if (sourceRow && typeof sourceRow === 'object' && typeof prop === 'string' && prop.indexOf('.') === -1) {
      (sourceRow as Record<string, unknown>)[prop] = value;
    }
  }

  onBeforeChangeRender(changes: [number, string | number, unknown, unknown][] | null, source: string): void {
    if (!this.model || !changes || source === 'loadData') {
      return;
    }
    changes.forEach(([row, prop, , value]) => {
      const physicalRow = this.hot.toPhysicalRow(row);
      const physicalColumn = this.hot.toPhysicalColumn(this.hot.propToCol(prop) as number);

      if (physicalRow !== null && physicalRow >= 0 && physicalColumn !== null && physicalColumn >= 0) {
        this.model!.setUserInput(SHEET, physicalRow + 1, physicalColumn + 1, toInput(value));
      }
    });
    this.model.evaluate();
  }

  /** For a formula cell, `getDataAtCell` and the renderers get the result instead of the formula. */
  onModifyData(row: number, column: number, valueHolder: { value: unknown }, ioMode: string): void {
    if (ioMode !== 'get' || !this.model || !isFormula(valueHolder.value)) {
      return;
    }
    const physicalColumn = this.hot.toPhysicalColumn(column);

    valueHolder.value = this.getResult(row + 1, physicalColumn + 1);
  }

  /** The result of a cell in the engine (1-based row and column). */
  getResult(row: number, column: number): unknown {
    const model = this.model!;
    const text = model.getFormattedCellValue(SHEET, row, column);
    const type = model.getCellType(SHEET, row, column);

    if (type === CELL_TYPE.BOOLEAN) {
      return text === 'TRUE';
    }
    if (type === CELL_TYPE.NUMBER && text !== '' && Number.isFinite(Number(text))) {
      return Number(text);
    }

    return text;
  }

  /**
   * After rows or columns are inserted or removed, the engine moves the references; the grid's formulas are updated
   * to the engine's.
   */
  onStructureChange(change: () => void): void {
    if (!this.model) {
      return;
    }
    change();
    this.model.evaluate();

    const rows = this.hot.countSourceRows();
    const columns = this.hot.countSourceCols();

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        if (isFormula(this.readSource(row, column))) {
          this.writeSource(row, column, this.model.getCellContent(SHEET, row + 1, column + 1));
        }
      }
    }
  }

  onAfterRenderer(TD: HTMLTableCellElement, row: number, column: number): void {
    if (!this.model || this.getFormula(row, column) === null) {
      return;
    }
    const physicalRow = this.hot.toPhysicalRow(row);
    const physicalColumn = this.hot.toPhysicalColumn(column);

    if (this.model.getCellType(SHEET, physicalRow + 1, physicalColumn + 1) === CELL_TYPE.ERROR) {
      addClass(TD, ERROR_CLASS_NAME);
    }
  }

  freeModel(): void {
    if (this.model && typeof this.model.free === 'function') {
      this.model.free();
    }
    this.model = null;
  }
}

registerPlugin('formulas', Formulas);

export default Formulas;
