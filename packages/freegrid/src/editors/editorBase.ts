import { CellCoords } from './../3rdparty/walkontable/src';
import { stringify } from './../helpers/mixed';
import type { CellProperties } from '../cellTypes/types';

export const EditorState = {
  VIRGIN: 'STATE_VIRGIN', // before editing
  EDITING: 'STATE_EDITING',
  WAITING: 'STATE_WAITING', // waiting for async validation
  FINISHED: 'STATE_FINISHED',
} as const;

export type EditorStateValue = typeof EditorState[keyof typeof EditorState];

/**
 * The grid, as editors use it. src/core.js is not typed yet, and editors reach deep into it (the view, Walkontable's
 * overlays).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- core.js is not typed yet
export type EditorHost = any;

/**
 * The base of every editor. An editor edits one cell at a time: the grid calls `prepare()` for the selected cell,
 * `beginEditing()` to open it and `finishEditing()` to save (or cancel) and close it. Subclasses implement `init()`,
 * `getValue()`, `setValue()`, `open()`, `close()` and `focus()`.
 *
 * The constructor calls `init()`: fields that `init()` sets must be declared with `declare` in subclasses, or the
 * subclass's field definitions would reset them after the constructor.
 */
class EditorBase {
  instance: EditorHost;

  state: EditorStateValue = EditorState.VIRGIN;

  _opened = false;

  _fullEditMode = false;

  _closeCallback: ((result: boolean) => void) | null = null;

  // Set by `prepare()` for the cell being edited.
  declare TD: HTMLTableCellElement;

  declare row: number;

  declare col: number;

  declare prop: string | number;

  declare originalValue: unknown;

  declare cellProperties: CellProperties;

  constructor(instance: EditorHost) {
    this.instance = instance;
    this.init();
  }

  _fireCallbacks(result: boolean): void {
    if (this._closeCallback) {
      this._closeCallback(result);
      this._closeCallback = null;
    }
  }

  /** Creates the editor's elements and listeners (once per grid). */
  init(): void {}

  getValue(): unknown {
    throw Error('Editor getValue() method unimplemented');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setValue(newValue?: unknown): void {
    throw Error('Editor setValue() method unimplemented');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  open(event?: Event | null): void {
    throw Error('Editor open() method unimplemented');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  close(force?: boolean): void {
    throw Error('Editor close() method unimplemented');
  }

  focus(): void {}

  /** Points the editor at a cell (before it is opened). */
  prepare(row: number, col: number, prop: string | number, td: HTMLTableCellElement, originalValue: unknown,
    cellProperties: CellProperties): void {
    this.TD = td;
    this.row = row;
    this.col = col;
    this.prop = prop;
    this.originalValue = originalValue;
    this.cellProperties = cellProperties;
    this.state = EditorState.VIRGIN;
  }

  /**
   * A subclass of this editor's class, for editors written in the style of older versions:
   * `const MyEditor = FreeGrid.editors.EditorText.prototype.extend(); MyEditor.prototype.open = function() { … }`.
   * (`class MyEditor extends FreeGrid.editors.EditorText {}` does the same.)
   */
  extend(): typeof EditorBase {
    const Base = this.constructor as typeof EditorBase;

    return class Editor extends Base {};
  }

  /** Writes `value` to the cell, or with `ctrlDown` (Ctrl+Enter) to every selected cell. */
  saveValue(value: unknown[][], ctrlDown?: boolean): void {
    let selection: (number | null)[];

    if (ctrlDown) {
      const [rowStart, colStart, rowEnd, colEnd] = this.instance.getSelectedLast() as number[];

      selection = [Math.min(rowStart, rowEnd), Math.min(colStart, colEnd), Math.max(rowStart, rowEnd),
        Math.max(colStart, colEnd)];
    } else {
      selection = [this.row, this.col, null, null];
    }
    this.instance.populateFromArray(selection[0], selection[1], value, selection[2], selection[3], 'edit');
  }

  /**
   * Opens the editor. In full edit mode (Enter, F2, double click) it starts with `newInitialValue` or the cell's
   * value; otherwise empty, so that typing (and IME) replaces the value.
   */
  beginEditing(newInitialValue?: string, event?: Event | null): void {
    if (this.state !== EditorState.VIRGIN) {
      return;
    }
    this.instance.view.scrollViewport(new CellCoords(this.row, this.col));
    this.state = EditorState.EDITING;

    if (this.isInFullEditMode()) {
      this.setValue(typeof newInitialValue === 'string' ? newInitialValue : stringify(this.originalValue));
    }
    this.open(event);
    this._opened = true;
    this.focus();
    // Only re-renders the selection (the fill handle disappears while editing).
    this.instance.view.render();
    this.instance.runHooks('afterBeginEditing', this.row, this.col);
  }

  /**
   * Saves the value (after validation, if the cell has a validator) and closes the editor, or with
   * `restoreOriginalValue` cancels the changes. `callback(result)` runs when the editor has closed (`false`: the value
   * was invalid and the editor stays open).
   */
  finishEditing(restoreOriginalValue?: boolean, ctrlDown?: boolean, callback?: (result: boolean) => void): void {
    if (callback) {
      const previousCloseCallback = this._closeCallback;

      this._closeCallback = (result) => {
        previousCloseCallback?.(result);
        callback(result);
        this.instance.view.render();
      };
    }
    if (this.isWaiting()) {
      return;
    }
    if (this.state === EditorState.VIRGIN) {
      this.instance._registerTimeout(() => {
        this._fireCallbacks(true);
      });

      return;
    }
    if (this.state !== EditorState.EDITING) {
      return;
    }
    if (restoreOriginalValue) {
      this.cancelChanges();
      this.instance.view.render();

      return;
    }
    const value = this.getValue();
    // Only strings are trimmed.
    const val = [[this.instance.getSettings().trimWhitespace && typeof value === 'string' ? value.trim() : value]];

    this.state = EditorState.WAITING;
    this.saveValue(val, ctrlDown);

    if (this.instance.getCellValidator(this.cellProperties)) {
      this.instance.addHookOnce('postAfterValidate', (result: boolean) => {
        this.state = EditorState.FINISHED;
        this.discardEditor(result);
      });
    } else {
      this.state = EditorState.FINISHED;
      this.discardEditor(true);
    }
  }

  cancelChanges(): void {
    this.state = EditorState.FINISHED;
    this.discardEditor();
  }

  /**
   * Closes the editor after saving; an invalid value (`result` false) keeps it open unless the cell allows invalid
   * values.
   */
  discardEditor(result?: boolean): void {
    if (this.state !== EditorState.FINISHED) {
      return;
    }
    if (result === false && this.cellProperties.allowInvalid !== true) {
      this.instance.selectCell(this.row, this.col);
      this.focus();
      this.state = EditorState.EDITING;
      this._fireCallbacks(false);
    } else {
      this.close();
      this._opened = false;
      this._fullEditMode = false;
      this.state = EditorState.VIRGIN;
      this._fireCallbacks(true);
    }
  }

  /** Full edit mode (Enter, F2): the arrow keys move within the editor instead of closing it. */
  enableFullEditMode(): void {
    this._fullEditMode = true;
  }

  isInFullEditMode(): boolean {
    return this._fullEditMode;
  }

  isOpened(): boolean {
    return this._opened;
  }

  isWaiting(): boolean {
    return this.state === EditorState.WAITING;
  }

  /** The fixed part of the grid the cell is in: `top`, `left`, `bottom`, the corners, or `''` for the main part. */
  checkEditorSection(): string {
    const totalRows = this.instance.countRows();
    const { fixedRowsTop, fixedRowsBottom, fixedColumnsLeft } = this.instance.getSettings();
    const isLeft = this.col < fixedColumnsLeft;

    if (this.row < fixedRowsTop) {
      return isLeft ? 'top-left-corner' : 'top';
    }
    if (fixedRowsBottom && this.row >= totalRows - fixedRowsBottom) {
      return isLeft ? 'bottom-left-corner' : 'bottom';
    }

    return isLeft ? 'left' : '';
  }
}

export default EditorBase;
