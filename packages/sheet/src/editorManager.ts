import { CellCoords } from './3rdparty/walkontable/src';
import { KEY_CODES, isMetaKey, isCtrlMetaKey } from './helpers/unicode';
import { stopPropagation, stopImmediatePropagation, isImmediatePropagationStopped } from './helpers/dom/event';
import { getEditorInstance } from './editors';
import EventManager from './eventManager';
import { EditorState } from './editors/editorBase';
import type EditorBase from './editors/editorBase';
import type { EditorHost } from './editors/editorBase';
import type Selection from './selection/selection';
import type { GridPrivate } from './core';

/** How far Enter or Tab moves the selection: rows and columns, or a function of the key event. */
type Moves = { row: number; col: number } | ((event?: KeyboardEvent) => { row: number; col: number });

/** The grid's private state that the editor manager reads (its settings) and writes (the last key). */

/** The editor manager of each grid. */
const instances = new WeakMap<EditorHost, EditorManager>();

/**
 * Opens, closes and prepares the cell editors of a grid, and handles the keyboard: arrow keys, Tab, Enter, Home,
 * End, Page Up and Down move the selection; typing, Enter and F2 open the editor.
 */
class EditorManager {
  /** The grid's editor manager (created on first use). */
  static getInstance(hotInstance: EditorHost, hotSettings: GridPrivate, selection: Selection): EditorManager {
    let editorManager = instances.get(hotInstance);

    if (!editorManager) {
      editorManager = new EditorManager(hotInstance, hotSettings, selection);
      instances.set(hotInstance, editorManager);
    }

    return editorManager;
  }

  #instance: EditorHost;

  #priv: GridPrivate;

  #selection: Selection;

  #eventManager: EventManager;

  #destroyed = false;

  /** Whether preparing and closing editors is blocked (see `lockEditor`). */
  #lock = false;

  #activeEditor: EditorBase | undefined;

  constructor(instance: EditorHost, priv: GridPrivate, selection: Selection) {
    this.#instance = instance;
    this.#priv = priv;
    this.#selection = selection;
    this.#eventManager = new EventManager(instance);
    this.#init();
  }

  /**
   * Lock the editor from being prepared and closed. Locking the editor prevents its closing and
   * reinitialized after selecting the new cell. This feature is necessary for a mobile editor.
   */
  lockEditor(): void {
    this.#lock = true;
  }

  /**
   * Unlock the editor from being prepared and closed. This method restores the original behavior of
   * the editors where for every new selection its instances are closed.
   */
  unlockEditor(): void {
    this.#lock = false;
  }

  /**
   * Destroy current editor, if exists.
   *
   * @param [revertOriginal] Whether the cell gets its original value back.
   */
  destroyEditor(revertOriginal?: boolean): void {
    if (!this.#lock) {
      this.closeEditor(revertOriginal);
    }
  }

  /**
   * Get active editor.
   */
  getActiveEditor(): EditorBase | undefined {
    return this.#activeEditor;
  }

  /**
   * Prepare text input to be displayed at given grid cell.
   */
  prepareEditor(): void {
    if (this.#lock) {
      return;
    }
    const instance = this.#instance;

    if (this.#activeEditor && this.#activeEditor.isWaiting()) {
      this.closeEditor(false, false, (dataSaved) => {
        if (dataSaved) {
          this.prepareEditor();
        }
      });

      return;
    }
    const { row, col } = instance.selection.selectedRange.current()!.highlight;
    const prop = instance.colToProp(col);
    const td = instance.getCell(row, col);
    const originalValue = instance.getSourceDataAtCell(instance.toPhysicalRow(row), col);
    const cellProperties = instance.getCellMeta(row, col);
    const editorClass = instance.getCellEditor(cellProperties);

    if (editorClass) {
      this.#activeEditor = getEditorInstance(editorClass, instance);
      // `td` is null for a cell that is not rendered (as before; the editors handle it).
      this.#activeEditor.prepare(row, col, prop as string | number, td as HTMLTableCellElement, originalValue, cellProperties);

    } else {
      this.#activeEditor = undefined;
    }
  }

  /**
   * Check is editor is opened/showed.
   */
  isEditorOpened(): boolean | undefined {
    return this.#activeEditor && this.#activeEditor.isOpened();
  }

  /**
   * Open editor with initial value.
   *
   * @param newInitialValue new value from which editor will start if handled property it's not the `null`.
   * @param [event] The event that opens it.
   */
  openEditor(newInitialValue: string | null, event?: Event | null): void {
    if (!this.#activeEditor) {
      return;
    }

    if (this.#activeEditor.cellProperties.readOnly) {
      // A read-only cell: Enter moves the selection instead.
      if (event && (event as KeyboardEvent).keyCode === KEY_CODES.ENTER) {
        this.#moveSelectionAfterEnter(false, event as KeyboardEvent);
      }
    } else {
      this.#activeEditor.beginEditing(newInitialValue ?? undefined, event);
    }
  }

  /**
   * Close editor, finish editing cell.
   *
   * @param [restoreOriginalValue] Whether the cell gets its original value back.
   * @param [ctrlDown] Whether Ctrl is down (the value goes to every selected cell).
   * @param [callback] Called when the editor has closed (`false`: the value was invalid).
   */
  closeEditor(restoreOriginalValue?: boolean, ctrlDown?: boolean, callback?: (result: boolean) => void): void {
    if (this.#activeEditor) {
      this.#activeEditor.finishEditing(restoreOriginalValue, ctrlDown, callback);

    } else if (callback) {
      callback(false);
    }
  }

  /**
   * Close editor and save changes.
   *
   * @param [ctrlDown] Whether Ctrl is down (the value goes to every selected cell).
   */
  closeEditorAndSaveChanges(ctrlDown?: boolean): void {
    this.closeEditor(false, ctrlDown);
  }

  /**
   * Close editor and restore original value.
   *
   * @param [ctrlDown] Whether Ctrl is down.
   */
  closeEditorAndRestoreOriginalValue(ctrlDown?: boolean): void {
    this.closeEditor(true, ctrlDown);
  }

  /**
   * Destroy the instance.
   */
  destroy(): void {
    this.#destroyed = true;
  }

  #init(): void {
    const instance = this.#instance;

    instance.addHook('afterDocumentKeyDown', (event: KeyboardEvent) => this.#onKeyDown(event));

    this.#eventManager.addEventListener(document.documentElement, 'keydown', (event: KeyboardEvent) => {
      if (!this.#destroyed) {
        instance.runHooks('afterDocumentKeyDown', event);
      }
    });

    // Open editor when text composition is started (IME editor)
    this.#eventManager.addEventListener(document.documentElement, 'compositionstart', (event: CompositionEvent) => {
      if (!this.#destroyed && this.#activeEditor && !this.#activeEditor.isOpened() && instance.isListening()) {
        this.openEditor('', event);
      }
    });

    // A double click on a cell (not a header) opens the editor in full edit mode.
    instance.view.wt.update('onCellDblClick', (event: MouseEvent, coords: CellCoords, elem: HTMLElement) => {
      if (elem.nodeName === 'TD') {
        this.#activeEditor?.enableFullEditMode();
        this.openEditor(null, event);
      }
    });
  }

  /** Moves the selection after Enter (by `enterMoves`; up with Shift). */
  #moveSelectionAfterEnter(shiftKey: boolean, event: KeyboardEvent): void {
    const enterMoves: Moves = this.#priv.settings.enterMoves;
    const moves = typeof enterMoves === 'function' ? enterMoves(event) : enterMoves;

    if (shiftKey) {
      this.#selection.transformStart(-moves.row, -moves.col);
    } else {
      // A new row is added if needed.
      this.#selection.transformStart(moves.row, moves.col, true);
    }
  }

  /** Moves the selection by an arrow key: the range's end with Shift, the selection itself otherwise. */
  #moveSelection(shiftKey: boolean, rowDelta: number, colDelta: number): void {
    if (shiftKey) {
      this.#selection.transformEnd(rowDelta, colDelta);
    } else {
      this.#selection.transformStart(rowDelta, colDelta);
    }
  }

  #onKeyDown(event: KeyboardEvent): void {
    const instance = this.#instance;
    const selection = this.#selection;

    if (!instance.isListening()) {
      return;
    }
    instance.runHooks('beforeKeyDown', event);

    // keyCode 229 ('uninitialized') comes while a character is being composed (IME); editors ignore it.
    if (this.#destroyed || event.keyCode === 229 || isImmediatePropagationStopped(event)) {
      return;
    }
    this.#priv.lastKeyCode = event.keyCode;

    if (!selection.isSelected()) {
      return;
    }
    // catch CTRL but not right ALT (which in some systems triggers ALT+CTRL)
    const ctrlDown = (event.ctrlKey || event.metaKey) && !event.altKey;
    const activeEditor = this.#activeEditor;

    // Typing opens the editor.
    if (activeEditor && !activeEditor.isWaiting() && !isMetaKey(event.keyCode) && !isCtrlMetaKey(event.keyCode) &&
      !ctrlDown && !this.isEditorOpened()) {
      this.openEditor('', event);

      return;
    }
    const rangeModifier = event.shiftKey ? selection.setRangeEnd : selection.setRangeStart;
    const arrows: Record<number, [number, number]> = {
      [KEY_CODES.ARROW_UP]: [-1, 0],
      [KEY_CODES.ARROW_DOWN]: [1, 0],
      [KEY_CODES.ARROW_RIGHT]: [0, 1],
      [KEY_CODES.ARROW_LEFT]: [0, -1],
    };

    if (arrows[event.keyCode]) {
      if (this.isEditorOpened() && !activeEditor!.isWaiting()) {
        this.closeEditorAndSaveChanges(ctrlDown);
      }
      this.#moveSelection(event.shiftKey, ...arrows[event.keyCode]);

      event.preventDefault();
      stopPropagation(event);

      return;
    }

    switch (event.keyCode) {
      case KEY_CODES.A:
        if (!this.isEditorOpened() && ctrlDown) {
          instance.selectAll();

          event.preventDefault();
          stopPropagation(event);
        }
        break;

      case KEY_CODES.TAB: {
        const tabMoves: Moves = this.#priv.settings.tabMoves;
        const moves = typeof tabMoves === 'function' ? tabMoves(event) : tabMoves;

        if (event.shiftKey) {
          selection.transformStart(-moves.row, -moves.col);
        } else {
          // A new column is added if needed.
          selection.transformStart(moves.row, moves.col, true);
        }
        event.preventDefault();
        stopPropagation(event);
        break;
      }

      case KEY_CODES.BACKSPACE:
      case KEY_CODES.DELETE:
        instance.emptySelectedCells();
        this.prepareEditor();
        event.preventDefault();
        break;

      case KEY_CODES.F2:
        activeEditor?.enableFullEditMode();
        this.openEditor(null, event);

        event.preventDefault(); // prevent Opera from opening 'Go to Page dialog'
        break;

      case KEY_CODES.ENTER:
        if (this.isEditorOpened()) {
          if (activeEditor && activeEditor.state !== EditorState.WAITING) {
            this.closeEditorAndSaveChanges(ctrlDown);
          }
          this.#moveSelectionAfterEnter(event.shiftKey, event);

        } else if (instance.getSettings().enterBeginsEditing) {
          activeEditor?.enableFullEditMode();
          this.openEditor(null, event);

        } else {
          this.#moveSelectionAfterEnter(event.shiftKey, event);
        }
        event.preventDefault(); // don't add newline to field
        stopImmediatePropagation(event); // required by EditorHandsontable
        break;

      case KEY_CODES.ESCAPE:
        if (this.isEditorOpened()) {
          this.closeEditorAndRestoreOriginalValue(ctrlDown);

          activeEditor!.focus();
        }
        event.preventDefault();
        break;

      case KEY_CODES.HOME: {
        const { from } = selection.selectedRange.current()!;

        rangeModifier.call(selection, event.ctrlKey || event.metaKey ? new CellCoords(0, from.col) : new CellCoords(from.row, 0));
        event.preventDefault(); // don't scroll the window
        stopPropagation(event);
        break;
      }

      case KEY_CODES.END: {
        const { from } = selection.selectedRange.current()!;

        rangeModifier.call(selection, event.ctrlKey || event.metaKey ?
          new CellCoords(instance.countRows() - 1, from.col) : new CellCoords(from.row, instance.countCols() - 1));
        event.preventDefault(); // don't scroll the window
        stopPropagation(event);
        break;
      }

      case KEY_CODES.PAGE_UP:
        selection.transformStart(-instance.countVisibleRows(), 0);
        event.preventDefault(); // don't page up the window
        stopPropagation(event);
        break;

      case KEY_CODES.PAGE_DOWN:
        selection.transformStart(instance.countVisibleRows(), 0);
        event.preventDefault(); // don't page down the window
        stopPropagation(event);
        break;

      default:
        break;
    }
  }
}

export default EditorManager;
