/**
 * FreeGrid UndoRedo class
 */
import Hooks from './../../pluginHooks';
import { rangeEach } from './../../helpers/number';
import { deepClone } from './../../helpers/object';
import { stopImmediatePropagation } from './../../helpers/dom/event';
import { align } from './../contextMenu/utils';
import type { PluginHost } from './../_base';
import type { CellRange } from './../../3rdparty/walkontable/src';

/** The column mapper as upstream's undo code addresses it (`__arrayMap`, which the mapper does not have). */
type LegacyMapper = { __arrayMap: number[] };

/** What undo expects from a filters plugin (FreeGrid has none yet; see the roadmap). */
type FiltersPlugin = { conditionCollection: { importAllConditions(conditions: unknown[]): void }; filter(): void };

/** What undo expects from a formulas plugin (FreeGrid has none). */
type FormulasPlugin = { onAfterSetDataAtCell(changes: unknown[]): void; recalculateFull(): void };

declare module '../../core' {
  interface Core {
    /** The undo history (while the `undo` setting is not `false`). */
    undoRedo?: UndoRedo;
    undo?: () => void;
    redo?: () => void;
    isUndoAvailable?: () => boolean;
    isRedoAvailable?: () => boolean;
    clearUndo?: () => void;
  }
}

/** Called when an action was undone or redone (its hook ran). */
type Done = () => void;

/** A change as `afterChange` gives it: `[row, prop, oldValue, newValue]`. */
type Change = [number, string | number, unknown, unknown];

/** Undo and redo for anything that does not revert itself: they use the grid's API with `UndoRedo.*` sources. */
class Action {
  actionType?: string;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  undo(instance: PluginHost, undoneCallback: Done): void {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  redo(instance: PluginHost, redoneCallback: Done): void {}
}

/** Changed cell values. */
class ChangeAction extends Action {
  changes: Change[];

  constructor(changes: Change[]) {
    super();
    this.changes = changes;
    this.actionType = 'change';
  }

  undo(instance: PluginHost, undoneCallback: Done): void {
    // `[row, prop, oldValue]`: back to the old values.
    const data = deepClone(this.changes).map(change => change.slice(0, 3)) as [number, string | number, unknown][];
    const emptyRowsAtTheEnd = instance.countEmptyRows(true);
    const emptyColsAtTheEnd = instance.countEmptyCols(true);
    const { minSpareRows, minSpareCols } = instance.getSettings();

    instance.addHookOnce('afterChange', undoneCallback);
    instance.setDataAtRowProp(data, null, null, 'UndoRedo.undo');

    // The change added spare rows or columns: they go too (and so do their actions).
    data.forEach(([row, col]) => {
      if (minSpareRows && row + 1 + minSpareRows === instance.countRows() && emptyRowsAtTheEnd === minSpareRows) {
        instance.alter('remove_row', parseInt(String(row + 1), 10), minSpareRows);
        instance.undoRedo!.doneActions.pop();
      }
      if (minSpareCols && (col as number) + 1 + minSpareCols === instance.countCols() &&
        emptyColsAtTheEnd === minSpareCols) {
        instance.alter('remove_col', parseInt(String((col as number) + 1), 10), minSpareCols);
        instance.undoRedo!.doneActions.pop();
      }
    });
  }

  redo(instance: PluginHost, onFinishCallback: Done): void {
    // `[row, prop, newValue]`.
    const data = deepClone(this.changes).map(([row, prop, , newValue]) => [row, prop, newValue]);

    instance.addHookOnce('afterChange', onFinishCallback);
    instance.setDataAtRowProp(data, null, null, 'UndoRedo.redo');
  }
}

/** Inserted rows. */
class CreateRowAction extends Action {
  index: number;

  amount: number;

  constructor(index: number, amount: number) {
    super();
    this.index = index;
    this.amount = amount;
    this.actionType = 'insert_row';
  }

  undo(instance: PluginHost, undoneCallback: Done): void {
    const rowCount = instance.countRows();
    const { minSpareRows } = instance.getSettings();

    // The row may be gone already: undoing a change removed the spare rows it had added.
    if (this.index >= rowCount && this.index - minSpareRows < rowCount) {
      this.index -= minSpareRows;
    }

    instance.addHookOnce('afterRemoveRow', undoneCallback);
    instance.alter('remove_row', this.index, this.amount, 'UndoRedo.undo');
  }

  redo(instance: PluginHost, redoneCallback: Done): void {
    instance.addHookOnce('afterCreateRow', redoneCallback);
    instance.alter('insert_row', this.index, this.amount, 'UndoRedo.redo');
  }
}

/** Removed rows (with their data). */
class RemoveRowAction extends Action {
  index: number;

  data: unknown[][];

  constructor(index: number, data: unknown[][]) {
    super();
    this.index = index;
    this.data = data;
    this.actionType = 'remove_row';
  }

  undo(instance: PluginHost, undoneCallback: Done): void {
    instance.alter('insert_row', this.index, this.data.length, 'UndoRedo.undo');
    instance.addHookOnce('afterRender', undoneCallback);
    instance.populateFromArray(this.index, 0, this.data, undefined, undefined, 'UndoRedo.undo');
  }

  redo(instance: PluginHost, redoneCallback: Done): void {
    instance.addHookOnce('afterRemoveRow', redoneCallback);
    instance.alter('remove_row', this.index, this.data.length, 'UndoRedo.redo');
  }
}

/** Inserted columns. */
class CreateColumnAction extends Action {
  index: number;

  amount: number;

  constructor(index: number, amount: number) {
    super();
    this.index = index;
    this.amount = amount;
    this.actionType = 'insert_col';
  }

  undo(instance: PluginHost, undoneCallback: Done): void {
    instance.addHookOnce('afterRemoveCol', undoneCallback);
    instance.alter('remove_col', this.index, this.amount, 'UndoRedo.undo');
  }

  redo(instance: PluginHost, redoneCallback: Done): void {
    instance.addHookOnce('afterCreateCol', redoneCallback);
    instance.alter('insert_col', this.index, this.amount, 'UndoRedo.redo');
  }
}

/** Removed columns (with their data, headers and the column order of manualColumnMove). */
class RemoveColumnAction extends Action {
  index: number;

  indexes: number[];

  data: unknown[][];

  amount: number;

  headers: unknown[];

  columnPositions: number[];

  constructor(index: number, indexes: number[], data: unknown[][], headers: unknown[], columnPositions: number[]) {
    super();
    this.index = index;
    this.indexes = indexes;
    this.data = data;
    this.amount = this.data[0].length;
    this.headers = headers;
    this.columnPositions = columnPositions.slice(0);
    this.actionType = 'remove_col';
  }

  undo(instance: PluginHost, undoneCallback: Done): void {
    // The columns go back in ascending order (as default sort compares strings, like before).
    const ascendingIndexes = this.indexes.slice(0).sort();
    const sortByIndexes = (elem: unknown, j: number, arr: unknown[]) => arr[this.indexes.indexOf(ascendingIndexes[j])];
    const sortedData = this.data.map(row => row.map(sortByIndexes));
    const sortedHeaders = this.headers.map(sortByIndexes);
    const changes: Change[] = [];

    // TODO: Temporary hook for undo/redo mess
    instance.runHooks('beforeCreateCol', this.indexes[0], this.indexes.length, 'UndoRedo.undo');

    rangeEach(this.data.length - 1, (i) => {
      const row = instance.getSourceDataAtRow(i);

      rangeEach(ascendingIndexes.length - 1, (j) => {
        row.splice(ascendingIndexes[j], 0, sortedData[i][j]);
        changes.push([i, ascendingIndexes[j], null, sortedData[i][j]]);
      });
    });

    // TODO: Temporary hook for undo/redo mess
    (instance.getPlugin('formulas') as FormulasPlugin | undefined)?.onAfterSetDataAtCell(changes);

    if (this.headers !== undefined) {
      rangeEach(sortedHeaders.length - 1, (j) => {
        instance.getSettings().colHeaders.splice(ascendingIndexes[j], 0, sortedHeaders[j]);
      });
    }

    if (instance.getPlugin('manualColumnMove')) {
      // Upstream bug (kept until it is fixed with tests): the mapper's field is `_arrayMap`, so this restores nothing.
      (instance.getPlugin('manualColumnMove').columnsMapper as unknown as LegacyMapper).__arrayMap = this.columnPositions;
    }

    instance.addHookOnce('afterRender', undoneCallback);

    // TODO: Temporary hook for undo/redo mess
    instance.runHooks('afterCreateCol', this.indexes[0], this.indexes.length, 'UndoRedo.undo');

    (instance.getPlugin('formulas') as FormulasPlugin | undefined)?.recalculateFull();

    instance.render();
  }

  redo(instance: PluginHost, redoneCallback: Done): void {
    instance.addHookOnce('afterRemoveCol', redoneCallback);
    instance.alter('remove_col', this.index, this.amount, 'UndoRedo.redo');
  }
}

/** An alignment set from the context menu. */
class CellAlignmentAction extends Action {
  stateBefore: Record<number, Record<number, string>>;

  range: CellRange[];

  type: string;

  alignment: string;

  constructor(stateBefore: Record<number, Record<number, string>>, range: CellRange[], type: string, alignment: string) {
    super();
    this.stateBefore = stateBefore;
    this.range = range;
    this.type = type;
    this.alignment = alignment;
  }

  undo(instance: PluginHost, undoneCallback: Done): void {
    this.range.forEach(({ from, to }) => {
      for (let row = from.row; row <= to.row; row += 1) {
        for (let col = from.col; col <= to.col; col += 1) {
          instance.setCellMeta(row, col, 'className', this.stateBefore[row][col] || ' fg-left');
        }
      }
    });

    instance.addHookOnce('afterRender', undoneCallback);
    instance.render();
  }

  redo(instance: PluginHost, undoneCallback: Done): void {
    align(this.range, this.type, this.alignment, (row: number, col: number) => instance.getCellMeta(row, col),
      (row: number, col: number, key: string, value: unknown) => instance.setCellMeta(row, col, key, value));

    instance.addHookOnce('afterRender', undoneCallback);
    instance.render();
  }
}

/** Filtering (for a filters plugin). */
class FiltersAction extends Action {
  conditionsStack: unknown[];

  constructor(conditionsStack: unknown[]) {
    super();
    this.conditionsStack = conditionsStack;
    this.actionType = 'filter';
  }

  undo(instance: PluginHost, undoneCallback: Done): void {
    const filters = instance.getPlugin('filters') as unknown as FiltersPlugin;

    instance.addHookOnce('afterRender', undoneCallback);

    filters.conditionCollection.importAllConditions(this.conditionsStack.slice(0, this.conditionsStack.length - 1));
    filters.filter();
  }

  redo(instance: PluginHost, redoneCallback: Done): void {
    const filters = instance.getPlugin('filters') as unknown as FiltersPlugin;

    instance.addHookOnce('afterRender', redoneCallback);

    filters.conditionCollection.importAllConditions(this.conditionsStack);
    filters.filter();
  }
}

/**
 * Merge Cells action.
 * @util
 */
class MergeCellsAction extends Action {
  cellRange: CellRange;

  rangeData: unknown[][];

  constructor(instance: PluginHost, cellRange: CellRange) {
    super();
    this.cellRange = cellRange;
    this.rangeData = instance.getData(cellRange.from.row, cellRange.from.col, cellRange.to.row, cellRange.to.col);
  }

  undo(instance: PluginHost, undoneCallback: Done): void {
    const mergeCellsPlugin = instance.getPlugin('mergeCells');

    instance.addHookOnce('afterRender', undoneCallback);

    mergeCellsPlugin.unmergeRange(this.cellRange, true);
    instance.populateFromArray(this.cellRange.from.row, this.cellRange.from.col, this.rangeData, undefined, undefined,
      'MergeCells');
  }

  redo(instance: PluginHost, redoneCallback: Done): void {
    const mergeCellsPlugin = instance.getPlugin('mergeCells');

    instance.addHookOnce('afterRender', redoneCallback);

    mergeCellsPlugin.mergeRange(this.cellRange);
  }
}

/**
 * Unmerge Cells action.
 * @util
 */
class UnmergeCellsAction extends Action {
  cellRange: CellRange;

  constructor(instance: PluginHost, cellRange: CellRange) {
    super();
    this.cellRange = cellRange;
  }

  undo(instance: PluginHost, undoneCallback: Done): void {
    const mergeCellsPlugin = instance.getPlugin('mergeCells');

    instance.addHookOnce('afterRender', undoneCallback);

    mergeCellsPlugin.mergeRange(this.cellRange, true);
  }

  redo(instance: PluginHost, redoneCallback: Done): void {
    const mergeCellsPlugin = instance.getPlugin('mergeCells');

    instance.addHookOnce('afterRender', redoneCallback);

    mergeCellsPlugin.unmergeRange(this.cellRange, true);
    instance.render();
  }
}

/**
 * ManualRowMove action.
 *
 * @TODO: removeRow undo should works on logical index
 */
class RowMoveAction extends Action {
  rows: number[];

  target: number;

  constructor(movedRows: number[], target: number) {
    super();
    this.rows = movedRows.slice();
    this.target = target;
  }

  undo(instance: PluginHost, undoneCallback: Done): void {
    const manualRowMove = instance.getPlugin('manualRowMove');
    const mod = this.rows[0] < this.target ? -1 * this.rows.length : 0;
    const newTarget = this.rows[0] > this.target ? this.rows[0] + this.rows.length : this.rows[0];
    const newRows = Array.from({ length: this.rows.length }, (_, i) => this.target + mod + i);

    instance.addHookOnce('afterRender', undoneCallback);

    manualRowMove.moveRows(newRows, newTarget);
    instance.render();

    instance.selectCell(this.rows[0], 0, this.rows[this.rows.length - 1], instance.countCols() - 1, false, false);
  }

  redo(instance: PluginHost, redoneCallback: Done): void {
    const manualRowMove = instance.getPlugin('manualRowMove');

    instance.addHookOnce('afterRender', redoneCallback);
    manualRowMove.moveRows(this.rows.slice(), this.target);
    instance.render();
    const startSelection = this.rows[0] < this.target ? this.target - this.rows.length : this.target;

    instance.selectCell(startSelection, 0, startSelection + this.rows.length - 1, instance.countCols() - 1, false, false);
  }
}

/** Whether a change comes from undoing or redoing (or is automatic): it is not recorded. */
const isUndoRedoSource = (source: string): boolean => (
  source === 'UndoRedo.undo' || source === 'UndoRedo.redo' || source === 'auto');

/**
 * @description
 * FreeGrid UndoRedo plugin allows to undo and redo certain actions done in the table.
 *
 * __Note__, that not all actions are currently undo-able. The UndoRedo plugin is enabled by default.
 *
 * @example
 * ```js
 * undo: true
 * ```
 * @class UndoRedo
 * @plugin UndoRedo
 */
class UndoRedo {
  static Action = Action;

  static ChangeAction = ChangeAction;

  static CreateRowAction = CreateRowAction;

  static RemoveRowAction = RemoveRowAction;

  static CreateColumnAction = CreateColumnAction;

  static RemoveColumnAction = RemoveColumnAction;

  static CellAlignmentAction = CellAlignmentAction;

  static FiltersAction = FiltersAction;

  static MergeCellsAction = MergeCellsAction;

  static UnmergeCellsAction = UnmergeCellsAction;

  static RowMoveAction = RowMoveAction;

  instance: PluginHost;

  /** The actions that can be undone, the last one last. */
  doneActions: Action[] = [];

  /** The actions that can be redone, the last undone one last. */
  undoneActions: Action[] = [];

  /** Whether actions are not recorded (while undoing or redoing). */
  ignoreNewActions = false;

  constructor(instance: PluginHost) {
    this.instance = instance;

    instance.addHook('afterChange', (changes: Change[] | null, source: string) => {
      if (changes && source !== 'UndoRedo.undo' && source !== 'UndoRedo.redo' && source !== 'MergeCells') {
        this.done(new ChangeAction(changes));
      }
    });

    instance.addHook('afterCreateRow', (index: number, amount: number, source: string) => {
      if (!isUndoRedoSource(source)) {
        this.done(new CreateRowAction(index, amount));
      }
    });

    instance.addHook('beforeRemoveRow', (index: number, amount: number, logicRows: unknown, source: string) => {
      if (isUndoRedoSource(source)) {
        return;
      }
      const originalData: unknown[][] = instance.getSourceDataArray();
      const rowIndex = (originalData.length + index) % originalData.length;
      const physicalRowIndex = instance.toPhysicalRow(rowIndex);
      const removedData = deepClone(originalData.slice(physicalRowIndex, physicalRowIndex + amount));

      this.done(new RemoveRowAction(rowIndex, removedData));
    });

    instance.addHook('afterCreateCol', (index: number, amount: number, source: string) => {
      if (!isUndoRedoSource(source)) {
        this.done(new CreateColumnAction(index, amount));
      }
    });

    instance.addHook('beforeRemoveCol', (index: number, amount: number, logicColumns: unknown, source: string) => {
      if (isUndoRedoSource(source)) {
        return;
      }
      const originalData: unknown[][] = instance.getSourceDataArray();
      const columnIndex = (instance.countCols() + index) % instance.countCols();
      const physicalColumns = Array.from({ length: amount },
        (_, i): number => instance.runHooks('modifyCol', columnIndex + i));
      const removedData = originalData.map(row => physicalColumns.map(column => row[column]));
      const { colHeaders } = instance.getSettings();
      const headers = Array.isArray(colHeaders) ? physicalColumns.map(column => colHeaders[column] || null) : [];
      const manualColumnMovePlugin = instance.getPlugin('manualColumnMove');
      // See RemoveColumnAction.undo: `__arrayMap` is not the mapper's field (an upstream bug, kept for now).
      const columnsMap = manualColumnMovePlugin.isEnabled()
        ? (manualColumnMovePlugin.columnsMapper as unknown as LegacyMapper).__arrayMap : [];

      this.done(new RemoveColumnAction(columnIndex, physicalColumns, removedData, headers, columnsMap));
    });

    instance.addHook('beforeCellAlignment',
      (stateBefore: Record<number, Record<number, string>>, range: CellRange[], type: string, alignment: string) => {
        this.done(new CellAlignmentAction(stateBefore, range, type, alignment));
      });

    instance.addHook('beforeFilter', (conditionsStack: unknown[]) => {
      this.done(new FiltersAction(conditionsStack));
    });

    instance.addHook('beforeRowMove', (movedRows: number[] | false, target: number) => {
      if (movedRows !== false) {
        this.done(new RowMoveAction(movedRows, target));
      }
    });

    instance.addHook('beforeMergeCells', (cellRange: CellRange, auto: boolean) => {
      if (!auto) {
        this.done(new MergeCellsAction(instance, cellRange));
      }
    });

    instance.addHook('afterUnmergeCells', (cellRange: CellRange, auto: boolean) => {
      if (!auto) {
        this.done(new UnmergeCellsAction(instance, cellRange));
      }
    });
  }

  /**
   * Records an action (unless undoing or redoing); the actions to redo are dropped.
   *
   * @private
   */
  done(action: Action): void {
    if (!this.ignoreNewActions) {
      this.doneActions.push(action);
      this.undoneActions.length = 0;
    }
  }

  /**
   * Undo the last action performed to the table.
   *
   * @fires Hooks#beforeUndo
   * @fires Hooks#afterUndo
   */
  undo(): void {
    if (!this.isUndoAvailable()) {
      return;
    }
    const action = this.doneActions.pop()!;
    const actionClone = deepClone(action);

    if (this.instance.runHooks('beforeUndo', actionClone) === false) {
      return;
    }

    this.ignoreNewActions = true;
    action.undo(this.instance, () => {
      this.ignoreNewActions = false;
      this.undoneActions.push(action);
    });

    this.instance.runHooks('afterUndo', actionClone);
  }

  /**
   * Redo the previous action performed to the table (used to reverse an undo).
   *
   * @fires Hooks#beforeRedo
   * @fires Hooks#afterRedo
   */
  redo(): void {
    if (!this.isRedoAvailable()) {
      return;
    }
    const action = this.undoneActions.pop()!;
    const actionClone = deepClone(action);

    if (this.instance.runHooks('beforeRedo', actionClone) === false) {
      return;
    }

    this.ignoreNewActions = true;
    action.redo(this.instance, () => {
      this.ignoreNewActions = false;
      this.doneActions.push(action);
    });

    this.instance.runHooks('afterRedo', actionClone);
  }

  /**
   * Checks if undo action is available.
   *
   * @returns Return `true` if undo can be performed, `false` otherwise.
   */
  isUndoAvailable(): boolean {
    return this.doneActions.length > 0;
  }

  /**
   * Checks if redo action is available.
   *
   * @returns Return `true` if redo can be performed, `false` otherwise.
   */
  isRedoAvailable(): boolean {
    return this.undoneActions.length > 0;
  }

  /**
   * Clears undo history.
   */
  clear(): void {
    this.doneActions.length = 0;
    this.undoneActions.length = 0;
  }
}

// A grid hook: `this` is the grid. Ctrl+Z undoes, Ctrl+Y and Ctrl+Shift+Z redo.
const onBeforeKeyDown = function onBeforeKeyDown(this: PluginHost, event: KeyboardEvent) {
  const ctrlDown = (event.ctrlKey || event.metaKey) && !event.altKey;

  if (!ctrlDown) {
    return;
  }
  if (event.keyCode === 89 || (event.shiftKey && event.keyCode === 90)) {
    this.undoRedo!.redo();
    stopImmediatePropagation(event);
  } else if (event.keyCode === 90) {
    this.undoRedo!.undo();
    stopImmediatePropagation(event);
  }
};

// A grid hook: loading data clears the history.
const onAfterChange = function onAfterChange(this: PluginHost, changes: unknown, source: string) {
  if (source === 'loadData') {
    this.undoRedo!.clear();
  }
};

/** Adds `undo()`, `redo()`, `isUndoAvailable()`, `isRedoAvailable()` and `clearUndo()` to the grid. */
const exposeUndoRedoMethods = (instance: PluginHost): void => {
  instance.undo = () => instance.undoRedo!.undo();
  instance.redo = () => instance.undoRedo!.redo();
  instance.isUndoAvailable = () => instance.undoRedo!.isUndoAvailable();
  instance.isRedoAvailable = () => instance.undoRedo!.isRedoAvailable();
  instance.clearUndo = () => instance.undoRedo!.clear();
};

const removeExposedUndoRedoMethods = (instance: PluginHost): void => {
  delete instance.undo;
  delete instance.redo;
  delete instance.isUndoAvailable;
  delete instance.isRedoAvailable;
  delete instance.clearUndo;
};

// A grid hook (after init and after updateSettings): `undo` (on unless `false`) adds or removes the plugin.
const init = function init(this: PluginHost) {
  const { undo } = this.getSettings();

  if (undo === undefined || undo) {
    if (!this.undoRedo) {
      this.undoRedo = new UndoRedo(this);
      exposeUndoRedoMethods(this);
      this.addHook('beforeKeyDown', onBeforeKeyDown);
      this.addHook('afterChange', onAfterChange);
    }
  } else if (this.undoRedo) {
    delete this.undoRedo;
    removeExposedUndoRedoMethods(this);
    this.removeHook('beforeKeyDown', onBeforeKeyDown);
    this.removeHook('afterChange', onAfterChange);
  }
};

const hook = Hooks.getSingleton();

hook.add('afterInit', init);
hook.add('afterUpdateSettings', init);

hook.register('beforeUndo');
hook.register('afterUndo');
hook.register('beforeRedo');
hook.register('afterRedo');

export default UndoRedo;
