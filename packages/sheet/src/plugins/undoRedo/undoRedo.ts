/**
 * FreeSheet UndoRedo class
 */
import Hooks from './../../pluginHooks';
import { rangeEach } from './../../helpers/number';
import { deepClone } from './../../helpers/object';
import { stopImmediatePropagation } from './../../helpers/dom/event';
import { align } from './../contextMenu/utils';
import type { PluginHost } from './../_base';
import type { CellRange } from './../../3rdparty/walkontable/src';


/** What undo expects from a filters plugin (FreeSheet has none yet; see the roadmap). */
type FiltersPlugin = { conditionCollection: { importAllConditions(conditions: unknown[]): void }; filter(): void };

/** What undo expects from a formulas plugin (FreeSheet has none). */
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

  undo(_instance: PluginHost, _undoneCallback: Done): void {}

  redo(_instance: PluginHost, _redoneCallback: Done): void {}
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

    // Removing the row would shrink the frozen rows, but inserting it did not grow them: they stay as they were.
    const { fixedRowsTop, fixedRowsBottom } = instance.getSettings();

    instance.addHookOnce('afterRemoveRow', undoneCallback);
    instance.alter('remove_row', this.index, this.amount, 'UndoRedo.undo');

    Object.assign(instance.getSettings(), { fixedRowsTop, fixedRowsBottom });
    instance.render();
  }

  redo(instance: PluginHost, redoneCallback: Done): void {
    instance.addHookOnce('afterCreateRow', redoneCallback);
    instance.alter('insert_row', this.index, this.amount, 'UndoRedo.redo');
  }
}

/** Removed rows (with their data and cell meta). */
class RemoveRowAction extends Action {
  index: number;

  data: unknown[][];

  /**
   * The cell meta of each removed row (`undefined` for a row that had none yet). Private: the undo hooks get the action
   * as a JSON copy, and cell meta refers to the grid.
   */
  #cellsMeta: (Record<string, unknown>[] | undefined)[];

  constructor(index: number, data: unknown[][], cellsMeta: (Record<string, unknown>[] | undefined)[] = []) {
    super();
    this.index = index;
    this.data = data;
    this.#cellsMeta = cellsMeta;
    this.actionType = 'remove_row';
  }

  undo(instance: PluginHost, undoneCallback: Done): void {
    instance.alter('insert_row', this.index, this.data.length, 'UndoRedo.undo');

    if (this.#cellsMeta.length) {
      instance.spliceCellsMeta(this.index, this.data.length, ...this.#cellsMeta.map(rowMeta => rowMeta || []));
    }
    instance.addHookOnce('afterRender', undoneCallback);
    // setDataAtCell, not populateFromArray: read-only cells get their values back too.
    instance.setDataAtCell(this.data.flatMap((rowData, row) => rowData
      .map((value, column): [number, number, unknown] => [this.index + row, column, value])), null, null, 'UndoRedo.undo');
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
    // Removing the column would shrink the frozen columns, but inserting it did not grow them.
    const { fixedColumnsLeft } = instance.getSettings();

    instance.addHookOnce('afterRemoveCol', undoneCallback);
    instance.alter('remove_col', this.index, this.amount, 'UndoRedo.undo');

    instance.getSettings().fixedColumnsLeft = fixedColumnsLeft;
    instance.render();
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
    // The columns go back in ascending physical order (compared as numbers: 10 after 3).
    const ascendingIndexes = this.indexes.slice(0).sort((a, b) => a - b);
    const sortByIndexes = (elem: unknown, j: number, arr: unknown[]) => arr[this.indexes.indexOf(ascendingIndexes[j])];
    const sortedData = this.data.map(row => row.map(sortByIndexes));
    const sortedHeaders = this.headers.map(sortByIndexes);
    const changes: Change[] = [];

    // A temporary hook from upstream (see #67)
    instance.runHooks('beforeCreateCol', this.indexes[0], this.indexes.length, 'UndoRedo.undo');

    rangeEach(this.data.length - 1, (i) => {
      const row = instance.getSourceDataAtRow(i);

      rangeEach(ascendingIndexes.length - 1, (j) => {
        row.splice(ascendingIndexes[j], 0, sortedData[i][j]);
        changes.push([i, ascendingIndexes[j], null, sortedData[i][j]]);
      });
    });

    // A temporary hook from upstream (see #67)
    (instance.getPlugin('formulas') as FormulasPlugin | undefined)?.onAfterSetDataAtCell(changes);

    if (this.headers !== undefined) {
      rangeEach(sortedHeaders.length - 1, (j) => {
        instance.getSettings().colHeaders.splice(ascendingIndexes[j], 0, sortedHeaders[j]);
      });
    }

    instance.addHookOnce('afterRender', undoneCallback);

    // A temporary hook from upstream (see #67)
    instance.runHooks('afterCreateCol', this.indexes[0], this.indexes.length, 'UndoRedo.undo');

    // The column order of manualColumnMove from before the removal (after afterCreateCol, which moves it).
    if (this.columnPositions.length) {
      instance.getPlugin('manualColumnMove').columnsMapper._arrayMap = this.columnPositions.slice(0);
    }

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
          instance.setCellMeta(row, col, 'className', this.stateBefore[row][col] || ' fs-left');
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

/** A change of cells' `style` meta (`setCellStyle`, the Format menu, Ctrl+B and the like). */
class CellStyleAction extends Action {
  changes: unknown[][];

  constructor(changes: unknown[][]) {
    super();
    this.changes = changes;
    this.actionType = 'style';
  }

  #apply(instance: PluginHost, done: Done, index: 2 | 3): void {
    this.changes.forEach((change) => {
      instance.setCellMeta(change[0] as number, change[1] as number, 'style', change[index]);
      // A paste also changes the alignment class: `[…, classNameBefore, classNameAfter]`.
      if (change.length > 4) {
        instance.setCellMeta(change[0] as number, change[1] as number, 'className', change[index + 2]);
      }
    });
    instance.addHookOnce('afterRender', done);
    instance.render();
  }

  undo(instance: PluginHost, undoneCallback: Done): void {
    this.#apply(instance, undoneCallback, 2);
  }

  redo(instance: PluginHost, redoneCallback: Done): void {
    this.#apply(instance, redoneCallback, 3);
  }
}

/** Several actions undone and redone as one (a paste of values with their formatting). */
class GroupAction extends Action {
  actions: Action[];

  constructor(actions: Action[]) {
    super();
    this.actions = actions;
    this.actionType = 'group';
  }

  /** Runs the actions in order; done when all of them are (not from inside one's render, which would render again). */
  #run(instance: PluginHost, actions: Action[], step: 'undo' | 'redo', done: Done): void {
    let pending = actions.length;

    actions.forEach(action => action[step](instance, () => {
      pending -= 1;
      if (pending === 0) {
        done();
      }
    }));
  }

  undo(instance: PluginHost, undoneCallback: Done): void {
    this.#run(instance, [...this.actions].reverse(), 'undo', undoneCallback);
  }

  redo(instance: PluginHost, redoneCallback: Done): void {
    this.#run(instance, this.actions, 'redo', redoneCallback);
/** A change of cells' settings (format painter, number formats, borders): `[row, col, before, after]`. */
class CellFormatAction extends Action {
  changes: [number, number, Record<string, unknown>, Record<string, unknown>][];

  constructor(changes: [number, number, Record<string, unknown>, Record<string, unknown>][]) {
    super();
    this.changes = changes;
    this.actionType = 'format';
  }

  #apply(instance: PluginHost, done: Done, index: 2 | 3): void {
    this.changes.forEach((change) => {
      Object.entries(change[index]).forEach(([key, value]) => {
        if (value === void 0) {
          instance.removeCellMeta(change[0], change[1], key);
        } else {
          instance.setCellMeta(change[0], change[1], key, value);
        }
      });
    });
    instance.addHookOnce('afterRender', done);
    instance.render();
  }

  undo(instance: PluginHost, undoneCallback: Done): void {
    this.#apply(instance, undoneCallback, 2);
  }

  redo(instance: PluginHost, redoneCallback: Done): void {
    this.#apply(instance, redoneCallback, 3);
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
 * Undo should work on logical (physical) indexes (see #67).
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

type HiddenIndexesPlugin = { getHidden(): number[]; restore(hidden: number[]): void };

/** Hidden rows or columns (the plugin's whole set before and after). */
class HiddenIndexesAction extends Action {
  pluginName: 'hiddenRows' | 'hiddenColumns';
  previous: number[];
  hidden: number[];

  constructor(pluginName: 'hiddenRows' | 'hiddenColumns', previous: number[], hidden: number[]) {
    super();
    this.pluginName = pluginName;
    this.previous = previous.slice();
    this.hidden = hidden.slice();
    this.actionType = pluginName;
  }

  undo(instance: PluginHost, undoneCallback: Done): void {
    instance.addHookOnce('afterRender', undoneCallback);
    (instance.getPlugin(this.pluginName) as unknown as HiddenIndexesPlugin).restore(this.previous);
  }

  redo(instance: PluginHost, redoneCallback: Done): void {
    instance.addHookOnce('afterRender', redoneCallback);
    (instance.getPlugin(this.pluginName) as unknown as HiddenIndexesPlugin).restore(this.hidden);
  }
}

/** Whether a change comes from undoing or redoing (or is automatic): it is not recorded. */
const isUndoRedoSource = (source: string): boolean => (
  source === 'UndoRedo.undo' || source === 'UndoRedo.redo' || source === 'auto');

/**
 * @description
 * FreeSheet UndoRedo plugin allows to undo and redo certain actions done in the table.
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
      // Only the changes that change something are an undo step.
      const realChanges = (changes || []).filter(change => change && change[2] !== change[3]);

      if (realChanges.length && source !== 'UndoRedo.undo' && source !== 'UndoRedo.redo' && source !== 'MergeCells') {
        this.done(new ChangeAction(realChanges));
      }
    });

    (['hiddenRows', 'hiddenColumns'] as const).forEach((pluginName) => {
      const noun = pluginName === 'hiddenRows' ? 'Rows' : 'Columns';
      const record = (_changed: number[], previous: number[]) => this.done(new HiddenIndexesAction(pluginName,
        previous, (instance.getPlugin(pluginName) as unknown as HiddenIndexesPlugin).getHidden()));

      instance.addHook(`afterHide${noun}`, record);
      instance.addHook(`afterUnhide${noun}`, record);
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
      const removedMeta = Array.from({ length: removedData.length },
        (_, offset) => instance.getCellMetaAtRow(physicalRowIndex + offset) as Record<string, unknown>[] | undefined);

      this.done(new RemoveRowAction(rowIndex, removedData, removedMeta));
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
        (_, i): number => instance.toPhysicalColumn(columnIndex + i));
      const removedData = originalData.map(row => physicalColumns.map(column => row[column]));
      const { colHeaders } = instance.getSettings();
      const headers = Array.isArray(colHeaders) ? physicalColumns.map(column => colHeaders[column] || null) : [];
      const manualColumnMovePlugin = instance.getPlugin('manualColumnMove');
      const columnsMap = manualColumnMovePlugin.isEnabled() ? manualColumnMovePlugin.columnsMapper._arrayMap.slice(0) : [];

      this.done(new RemoveColumnAction(columnIndex, physicalColumns, removedData, headers, columnsMap));
    });

    instance.addHook('beforeCellAlignment',
      (stateBefore: Record<number, Record<number, string>>, range: CellRange[], type: string, alignment: string) => {
        this.done(new CellAlignmentAction(stateBefore, range, type, alignment));
      });

    instance.addHook('afterSetCellStyle', (changes: unknown[][]) => {
      this.done(new CellStyleAction(changes));
    });

    instance.addHook('afterSetCellFormat',
      (changes: [number, number, Record<string, unknown>, Record<string, unknown>][]) => {
        this.done(new CellFormatAction(changes));
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
    if (this.ignoreNewActions) {
      return;
    }
    if (this.#group) {
      this.#group.push(action);
    } else {
      this.doneActions.push(action);
    }
    this.undoneActions.length = 0;
  }

  /** The actions done since `beginGroup`, which become one undo step. */
  #group: Action[] | null = null;

  /** Starts a group: the actions until `endGroup` are undone and redone as one. */
  beginGroup(): void {
    this.#group = this.#group || [];
  }

  /** Ends the group started by `beginGroup`. */
  endGroup(): void {
    const actions = this.#group;

    this.#group = null;
    if (actions && actions.length) {
      this.doneActions.push(actions.length === 1 ? actions[0] : new GroupAction(actions));
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
