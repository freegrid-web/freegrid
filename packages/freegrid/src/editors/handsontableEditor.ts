import { withLegacyClassNames } from './../helpers/classNames';
import { KEY_CODES } from './../helpers/unicode';
import { extend } from './../helpers/object';
import { setCaretPosition } from './../helpers/dom/element';
import { stopImmediatePropagation, isImmediatePropagationStopped } from './../helpers/dom/event';
import TextEditor from './textEditor';
import type { EditorGrid } from './_baseEditor';
import type { CellProperties } from '../cellTypes/types';

// A grid hook: `this` is the grid. The arrow keys move the selection in the list while the focus stays in the
// editor's textarea.
const onBeforeKeyDown = function onBeforeKeyDown(this: EditorGrid, event: KeyboardEvent) {
  if (isImmediatePropagationStopped(event)) {
    return;
  }
  const editor = this.getActiveEditor() as HandsontableEditor;
  const innerHOT = editor.htEditor.getInstance();
  const selectedRow: number | undefined = innerHOT.getSelectedLast()?.[0];
  let rowToSelect: number | undefined;

  if (event.keyCode === KEY_CODES.ARROW_DOWN) {
    if (selectedRow === undefined) {
      rowToSelect = innerHOT.flipped ? undefined : 0;
    } else if (innerHOT.flipped) {
      rowToSelect = selectedRow + 1;
    } else {
      rowToSelect = Math.min(innerHOT.countRows() - 1, selectedRow + 1);
    }
  } else if (event.keyCode === KEY_CODES.ARROW_UP) {
    if (selectedRow === undefined) {
      rowToSelect = innerHOT.flipped ? innerHOT.countRows() - 1 : undefined;
    } else if (innerHOT.flipped) {
      rowToSelect = Math.max(0, selectedRow - 1);
    } else {
      rowToSelect = selectedRow - 1;
    }
  }

  if (rowToSelect !== undefined) {
    if (rowToSelect < 0 || (innerHOT.flipped && rowToSelect > innerHOT.countRows() - 1)) {
      innerHOT.deselectCell();
    } else {
      innerHOT.selectCell(rowToSelect, 0);
    }
    if (innerHOT.getData().length) {
      event.preventDefault();
      stopImmediatePropagation(event);

      editor.instance.listen();
      editor.TEXTAREA.focus();
    }
  }
};

/**
 * A text editor with a read-only grid under it (the list of the autocomplete and dropdown editors). The cell's
 * `handsontable` setting holds the inner grid's settings; clicking a row (or Enter on a selected row) takes its value.
 */
class HandsontableEditor extends TextEditor {
  // Set by createElements() (inside the base constructor) and prepare().
  declare htContainer: HTMLDivElement;

  declare htOptions: Record<string, unknown>;

  /** The inner grid, while the editor is open. */
  declare htEditor: EditorGrid;

  createElements(): void {
    super.createElements();

    const DIV = document.createElement('DIV') as HTMLDivElement;

    DIV.className = withLegacyClassNames('fg-editor-grid');
    this.TEXTAREA_PARENT.appendChild(DIV);

    this.htContainer = DIV;
    this.instance.addHook('afterDestroy', () => {
      this.htEditor?.destroy();
    });
  }

  prepare(row: number, col: number, prop: string | number, td: HTMLTableCellElement, originalValue: unknown,
    cellProperties: CellProperties): void {
    super.prepare(row, col, prop, td, originalValue, cellProperties);

    // The inner grid calls it with itself as `this`.
    const onCellMouseDown = (innerGrid: EditorGrid, coords: { row: number; col: number }) => {
      const sourceValue = innerGrid.getSourceData(coords.row, coords.col);

      // An undefined value means: don't set the value.
      if (sourceValue !== undefined) {
        this.setValue(sourceValue);
      }
      this.instance.destroyEditor();
    };
    const options: Record<string, unknown> = {
      startRows: 0,
      startCols: 0,
      minRows: 0,
      minCols: 0,
      className: 'listbox',
      copyPaste: false,
      autoColumnSize: false,
      autoRowSize: false,
      readOnly: true,
      fillHandle: false,
      autoWrapCol: false,
      autoWrapRow: false,
      afterOnCellMouseDown(this: EditorGrid, _event: MouseEvent, coords: { row: number; col: number }) {
        onCellMouseDown(this, coords);
      },
    };

    if (this.cellProperties.handsontable) {
      extend(options, cellProperties.handsontable as Record<string, unknown>);
    }
    this.htOptions = options;
  }

  open(): void {
    this.instance.addHook('beforeKeyDown', onBeforeKeyDown);

    super.open();

    this.htEditor?.destroy();

    if (this.htContainer.style.display === 'none') {
      this.htContainer.style.display = '';
    }

    this.htEditor = new this.instance.constructor(this.htContainer, this.htOptions);
    this.htEditor.init();
    this.htEditor.rootElement.style.display = '';

    if (this.cellProperties.strict) {
      this.htEditor.selectCell(0, 0);
    } else {
      this.htEditor.deselectCell();
    }

    setCaretPosition(this.TEXTAREA, 0, this.TEXTAREA.value.length);
  }

  close(): void {
    this.htEditor.rootElement.style.display = 'none';
    this.instance.removeHook('beforeKeyDown', onBeforeKeyDown);
    super.close();
  }

  /** Does nothing when the grid's `onBeginEditing` setting returns false. */
  beginEditing(newInitialValue?: string, event?: Event | null): void {
    const { onBeginEditing } = this.instance.getSettings();

    if (onBeginEditing && onBeginEditing() === false) {
      return;
    }
    super.beginEditing(newInitialValue, event);
  }

  /** Takes the value of the row selected in the list, if any. */
  finishEditing(restoreOriginalValue?: boolean, ctrlDown?: boolean, callback?: (result: boolean) => void): void {
    if (this.htEditor?.isListening()) {
      // The focus returns to the outer grid.
      this.instance.listen();
    }

    if (this.htEditor?.getSelectedLast()) {
      const value = this.htEditor.getInstance().getValue();

      // An undefined value means: don't set the value.
      if (value !== undefined) {
        this.setValue(value);
      }
    }

    super.finishEditing(restoreOriginalValue, ctrlDown, callback);
  }
}

export default HandsontableEditor;
