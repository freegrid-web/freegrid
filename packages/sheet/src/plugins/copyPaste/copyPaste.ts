import BasePlugin from './../_base';
import Hooks from './../../pluginHooks';
import SheetClip from './../../../lib/SheetClip/SheetClip';
import { getSelectionText } from './../../helpers/dom/element';
import { registerPlugin } from './../../plugins';
import copyItem from './contextMenuItem/copy';
import cutItem from './contextMenuItem/cut';
import PasteEvent from './pasteEvent';
import type { MenuItem } from './../contextMenu/menuItem';
import { createElement, destroyElement } from './focusableElement';
import type { FocusableWrapper } from './focusableElement';
import { arrayToTable, parseTable, tableToArray } from './utils';
import { tableToFormats, type CellFormat } from './formats';
import { setCellFormats } from './../../formatting/formatting';
import type { CellStyle } from './../../utils/cellStyle';

import './copyPaste.css';

Hooks.getSingleton().register('afterCopyLimit');
Hooks.getSingleton().register('modifyCopyableRange');
Hooks.getSingleton().register('beforeCut');
Hooks.getSingleton().register('afterCut');
Hooks.getSingleton().register('beforePaste');
Hooks.getSingleton().register('afterPaste');
Hooks.getSingleton().register('beforeCopy');
Hooks.getSingleton().register('afterCopy');

const ROWS_LIMIT = 1000;
const COLUMNS_LIMIT = 1000;

/** Cells to copy, cut or paste over. */
export type CopyableRange = { startRow: number; startCol: number; endRow: number; endCol: number };

/**
 * @description
 * This plugin enables the copy/paste functionality in the FreeSheet. The functionality works for API, Context Menu,
 * using keyboard shortcuts and menu bar from the browser.
 * Possible values:
 * * `true` (to enable default options),
 * * `false` (to disable completely)
 *
 * or an object with values:
 * * `'columnsLimit'` (see {@link CopyPaste#columnsLimit})
 * * `'rowsLimit'` (see {@link CopyPaste#rowsLimit})
 * * `'pasteMode'` (see {@link CopyPaste#pasteMode})
 *
 * See [the copy/paste demo](https://github.com/freegrid-web/sheet) for examples.
 *
 * @example
 * ```js
 * // Enables the plugin with default values
 * copyPaste: true,
 * // Enables the plugin with custom values
 * copyPaste: {
 *   columnsLimit: 25,
 *   rowsLimit: 50,
 *   pasteMode: 'shift_down',
 * },
 * ```
 * @class CopyPaste
 * @plugin CopyPaste
 */
class CopyPaste extends BasePlugin {
  /**
   * Maximum number of columns than can be copied to clipboard using <kbd>CTRL</kbd> + <kbd>C</kbd>.
   *
   * @default 1000
   */
  columnsLimit = COLUMNS_LIMIT;

  /**
   * Ranges of the cells coordinates, which should be used to copy/cut/paste actions.
   *
   * @private
   */
  copyableRanges: CopyableRange[] = [];

  /**
   * Defines paste (<kbd>CTRL</kbd> + <kbd>V</kbd>) behavior.
   * * Default value `"overwrite"` will paste clipboard value over current selection.
   * * When set to `"shift_down"`, clipboard data will be pasted in place of current selection, while all selected cells are moved down.
   * * When set to `"shift_right"`, clipboard data will be pasted in place of current selection, while all selected cells are moved right.
   *
   * @default 'overwrite'
   */
  pasteMode = 'overwrite';

  /**
   * Whether copy and paste carry the cells' formatting (bold, italic, underline, colors, alignment): a copy writes it
   * in the clipboard's HTML (so it reaches spreadsheets), a paste of an HTML table (from FreeSheet, Excel, Google
   * Sheets) takes it. `copyPaste: { formats: false }` turns it off.
   */
  formats = true;

  /**
   * Maximum number of rows than can be copied to clipboard using <kbd>CTRL</kbd> + <kbd>C</kbd>.
   *
   * @default 1000
   */
  rowsLimit = ROWS_LIMIT;

  /** The element that gets the focus for the browser's copy, cut and paste events. */
  focusableElement?: FocusableWrapper | null;

  /** Whether `copy()` started the copy event (the grid need not be listening then). */
  #isTriggeredByCopy = false;

  /** Whether `cut()` started the cut event. */
  #isTriggeredByCut = false;

  /** The `fragmentSelection` setting: selected text in cells may be copied as it is. */
  #isFragmentSelectionEnabled = false;

  /**
   * Checks if the plugin is enabled in the FreeSheet settings. This method is executed in {@link Hooks#beforeInit}
   * hook and if it returns `true` than the {@link CopyPaste#enablePlugin} method is called.
   */
  isEnabled(): boolean {
    return !!this.hot.getSettings().copyPaste;
  }

  /**
   * Enables the plugin functionality for this FreeSheet instance.
   */
  enablePlugin(): void {
    if (this.enabled) {
      return;
    }
    const settings = this.hot.getSettings();

    this.#isFragmentSelectionEnabled = settings.fragmentSelection;

    if (typeof settings.copyPaste === 'object') {
      this.pasteMode = settings.copyPaste.pasteMode || this.pasteMode;
      this.rowsLimit = settings.copyPaste.rowsLimit || this.rowsLimit;
      this.columnsLimit = settings.copyPaste.columnsLimit || this.columnsLimit;
      this.formats = settings.copyPaste.formats !== false;
    }

    this.addHook('afterContextMenuDefaultOptions',
      (options: { items: MenuItem[] }) => this.onAfterContextMenuDefaultOptions(options));
    this.addHook('afterOnCellMouseUp', () => this.onAfterOnCellMouseUp());
    this.addHook('afterSelectionEnd', () => this.onAfterSelectionEnd());
    this.addHook('beforeKeyDown', () => this.onBeforeKeyDown());

    this.focusableElement = createElement();
    this.focusableElement
      .addLocalHook('copy', (event: ClipboardEvent) => this.onCopy(event))
      .addLocalHook('cut', (event: ClipboardEvent) => this.onCut(event))
      .addLocalHook('paste', (event: ClipboardEvent) => this.onPaste(event));

    super.enablePlugin();
  }

  /**
   * Updates the plugin state. This method is executed when {@link Core#updateSettings} is invoked.
   */
  updatePlugin(): void {
    this.disablePlugin();
    this.enablePlugin();
    this.getOrCreateFocusableElement();

    super.updatePlugin();
  }

  /**
   * Disables the plugin functionality for this FreeSheet instance.
   */
  disablePlugin(): void {
    if (this.focusableElement) {
      destroyElement(this.focusableElement);
    }

    super.disablePlugin();
  }

  /**
   * Copies the selected cell into the clipboard.
   */
  copy(): void {
    this.#isTriggeredByCopy = true;

    this.getOrCreateFocusableElement();
    this.focusableElement!.focus();
    document.execCommand('copy');
  }

  /**
   * Cuts the selected cell into the clipboard.
   */
  cut(): void {
    this.#isTriggeredByCut = true;

    this.getOrCreateFocusableElement();
    this.focusableElement!.focus();
    document.execCommand('cut');
  }

  /**
   * Creates copyable text releated to range objects.
   *
   * @param ranges Array of objects with properties `startRow`, `endRow`, `startCol` and `endCol`.
   * @returns Returns string which will be copied into clipboard.
   */
  getRangedCopyableData(ranges: CopyableRange[]): string {
    return SheetClip.stringify(this.getRangedData(ranges));
  }

  /**
   * Creates copyable text releated to range objects.
   *
   * @param ranges Array of objects with properties `startRow`, `startCol`, `endRow` and `endCol`.
   * @returns Returns array of arrays which will be copied into clipboard.
   */
  /** The formatting of the cells `getRangedData` reads, in the same rows and columns. */
  getRangedFormats(ranges: CopyableRange[]): CellFormat[][] {
    const rows = new Set<number>();
    const columns = new Set<number>();

    ranges.forEach(({ startRow, endRow, startCol, endCol }) => {
      for (let row = startRow; row <= endRow; row += 1) {
        rows.add(row);
      }
      for (let column = startCol; column <= endCol; column += 1) {
        columns.add(column);
      }
    });

    return [...rows].map(row => [...columns].map((column) => {
      const { style, className } = this.hot.getCellMeta(row, column) as { style?: CellStyle; className?: unknown };
      const classes = Array.isArray(className) ? className : String(className || '').split(/\s+/);
      const align = ['left', 'center', 'right', 'justify'].find(name => classes.includes(`fs-${name}`) ||
        classes.includes(`ht${name[0].toUpperCase()}${name.slice(1)}`)) as CellFormat['align'];

      return { style, align };
    }));
  }

  getRangedData(ranges: CopyableRange[]): unknown[][] {
    const copyableRows = new Set<number>();
    const copyableColumns = new Set<number>();

    // The rows and columns of every range, each once, in the order they come.
    ranges.forEach(({ startRow, endRow, startCol, endCol }) => {
      for (let row = startRow; row <= endRow; row += 1) {
        copyableRows.add(row);
      }
      for (let column = startCol; column <= endCol; column += 1) {
        copyableColumns.add(column);
      }
    });

    return [...copyableRows].map(row => [...copyableColumns].map(column => this.hot.getCopyableData(row, column)));
  }

  /**
   * Simulates the paste action.
   *
   * @param [pastableText] Value to paste.
   * @param [pastableHtml] The value as HTML (a `<table>` is pasted cell by cell).
   */
  paste(pastableText = '', pastableHtml: string = pastableText): void {
    if (!pastableText && !pastableHtml) {
      return;
    }
    const pasteData = new PasteEvent();

    if (pastableText) {
      pasteData.clipboardData.setData('text/plain', pastableText);
    }
    if (pastableHtml) {
      pasteData.clipboardData.setData('text/html', pastableHtml);
    }

    this.getOrCreateFocusableElement();
    this.onPaste(pasteData);
  }

  /**
   * Prepares copyable text from the cells selection in the invisible textarea.
   */
  setCopyableText(): void {
    const selRange = this.hot.getSelectedRangeLast();

    if (!selRange) {
      return;
    }
    const { row: startRow, col: startCol } = selRange.getTopLeftCorner();
    const { row: endRow, col: endCol } = selRange.getBottomRightCorner();
    const finalEndRow = Math.min(endRow, startRow + this.rowsLimit - 1);
    const finalEndCol = Math.min(endCol, startCol + this.columnsLimit - 1);

    this.copyableRanges.length = 0;
    this.copyableRanges.push({ startRow, startCol, endRow: finalEndRow, endCol: finalEndCol });
    this.copyableRanges = this.hot.runHooks('modifyCopyableRange', this.copyableRanges);

    if (endRow !== finalEndRow || endCol !== finalEndCol) {
      this.hot.runHooks('afterCopyLimit', endRow - startRow + 1, endCol - startCol + 1, this.rowsLimit, this.columnsLimit);
    }
  }

  /**
   * Force focus on editable element.
   *
   * @private
   */
  getOrCreateFocusableElement(): void {
    // The text editor's textarea (other editors have none).
    const editableElement = (this.hot.getActiveEditor() as { TEXTAREA?: HTMLTextAreaElement } | undefined)?.TEXTAREA;

    if (editableElement) {
      this.focusableElement!.setFocusableElement(editableElement);
    } else {
      this.focusableElement!.useSecondaryElement();
    }
  }

  /**
   * Verifies if editor exists and is open.
   *
   * @private
   */
  isEditorOpened(): boolean {
    return !!this.hot.getActiveEditor()?.isOpened();
  }

  /**
   * Prepares new values to populate them into datasource.
   *
   * @private
   * @param inputArray The pasted values.
   * @param [selection] Where they are pasted: `[row, column, row2, column2]`.
   * @returns Range coordinates after populate data
   */
  populateValues(inputArray: unknown[][], selection: number[] = this.hot.getSelectedLast()!): number[] | undefined {
    if (!inputArray.length) {
      return undefined;
    }
    const valuesRows = inputArray.length;
    const valuesColumns = inputArray[0].length;
    const startRow = Math.min(selection[0], selection[2]);
    const endRow = Math.max(selection[0], selection[2], valuesRows - 1 + startRow);
    const startColumn = Math.min(selection[1], selection[3]);
    const endColumn = Math.max(selection[1], selection[3], valuesColumns - 1 + startColumn);
    // The values repeat over a selection bigger than them.
    const newValues = Array.from({ length: endRow - startRow + 1 }, (_, row) => Array.from(
      { length: endColumn - startColumn + 1 }, (__, column) => inputArray[row % valuesRows][column % valuesColumns]));

    this.hot.populateFromArray(startRow, startColumn, newValues, undefined, undefined, 'CopyPaste.paste', this.pasteMode);

    return [startRow, startColumn, endRow, endColumn];
  }

  /**
   * Gives the pasted cells the pasted formatting (repeated as the values are over a bigger selection).
   *
   * @private
   */
  pasteFormats(formats: CellFormat[][], startRow: number, startColumn: number, endRow: number,
    endColumn: number): void {
    const cells = [];

    for (let row = startRow; row <= Math.min(endRow, this.hot.countRows() - 1); row += 1) {
      for (let col = startColumn; col <= Math.min(endColumn, this.hot.countCols() - 1); col += 1) {
        const rowFormats = formats[(row - startRow) % formats.length];
        const format = rowFormats[(col - startColumn) % rowFormats.length] || {};

        cells.push({ row, col, style: format.style, align: format.align });
      }
    }
    setCellFormats(this.hot as unknown as Parameters<typeof setCellFormats>[0], cells);
  }

  /**
   * `copy` event callback on textarea element.
   *
   * @param event ClipboardEvent.
   * @private
   */
  onCopy(event: ClipboardEvent): void {
    if ((!this.hot.isListening() && !this.#isTriggeredByCopy) || this.isEditorOpened()) {
      return;
    }
    this.setCopyableText();
    this.#isTriggeredByCopy = false;

    const rangedData = this.getRangedData(this.copyableRanges);

    if (this.hot.runHooks('beforeCopy', rangedData, this.copyableRanges)) {
      this.#putOnClipboard(event, rangedData, this.formats ? this.getRangedFormats(this.copyableRanges) : void 0);
      this.hot.runHooks('afterCopy', rangedData, this.copyableRanges);
    }

    event.preventDefault();
  }

  /**
   * `cut` event callback on textarea element.
   *
   * @param event ClipboardEvent.
   * @private
   */
  onCut(event: ClipboardEvent): void {
    if ((!this.hot.isListening() && !this.#isTriggeredByCut) || this.isEditorOpened()) {
      return;
    }
    this.setCopyableText();
    this.#isTriggeredByCut = false;

    const rangedData = this.getRangedData(this.copyableRanges);

    if (this.hot.runHooks('beforeCut', rangedData, this.copyableRanges)) {
      this.#putOnClipboard(event, rangedData, this.formats ? this.getRangedFormats(this.copyableRanges) : void 0);
      this.hot.emptySelectedCells();
      this.hot.runHooks('afterCut', rangedData, this.copyableRanges);
    }

    event.preventDefault();
  }

  /**
   * `paste` event callback on textarea element.
   *
   * @param event ClipboardEvent or pseudo ClipboardEvent, if paste was called manually.
   * @private
   */
  onPaste(event: ClipboardEvent | PasteEvent): void {
    if (!this.hot.isListening() || this.isEditorOpened()) {
      return;
    }
    if ('preventDefault' in event) {
      event.preventDefault();
    }

    let pastedData: string | unknown[][] | undefined;
    let formats: CellFormat[][] | null = null;

    if (event?.clipboardData) {
      const textHTML = event.clipboardData.getData('text/html');
      const table = textHTML && /(<table)|(<TABLE)/.test(textHTML) ? parseTable(textHTML) : null;

      // An HTML table is pasted cell by cell, with its formatting.
      pastedData = table ? tableToArray(table) : event.clipboardData.getData('text/plain');
      formats = table && this.formats ? tableToFormats(table) : null;
    }

    const inputArray: unknown[][] = typeof pastedData === 'string' ? SheetClip.parse(pastedData) : pastedData ?? [];

    if (inputArray.length === 0) {
      return;
    }
    if (this.hot.runHooks('beforePaste', inputArray, this.copyableRanges) === false) {
      return;
    }

    // The values and their formatting are one undo step.
    const undoRedo = (this.hot as unknown as { undoRedo?: { beginGroup(): void; endGroup(): void } }).undoRedo;

    undoRedo?.beginGroup();
    const [startRow, startColumn, endRow, endColumn] = this.populateValues(inputArray)!;

    if (formats) {
      this.pasteFormats(formats, startRow, startColumn, endRow, endColumn);
    }
    undoRedo?.endGroup();

    this.hot.selectCell(
      startRow,
      startColumn,
      Math.min(this.hot.countRows() - 1, endRow),
      Math.min(this.hot.countCols() - 1, endColumn),
    );

    this.hot.runHooks('afterPaste', inputArray, this.copyableRanges);
  }

  /**
   * Add copy, cut and paste options to the Context Menu.
   *
   * @private
   * @param options Contains default added options of the Context Menu.
   */
  onAfterContextMenuDefaultOptions(options: { items: MenuItem[] }): void {
    options.items.push({ name: '---------' }, copyItem(this), cutItem(this));
  }

  /**
   * Force focus on focusableElement.
   *
   * @private
   */
  onAfterOnCellMouseUp(): void {
    if (!this.hot.isListening() || this.isEditorOpened()) {
      return;
    }

    this.getOrCreateFocusableElement();
    this.focusableElement!.focus();
  }

  /**
   * Force focus on focusableElement after end of the selection.
   *
   * @private
   */
  onAfterSelectionEnd(): void {
    if (this.isEditorOpened()) {
      return;
    }
    this.getOrCreateFocusableElement();

    // Text selected in a cell (fragmentSelection) stays selected.
    if (this.#isFragmentSelectionEnabled && this.focusableElement!.getFocusableElement() !== document.activeElement &&
      getSelectionText()) {
      return;
    }

    this.setCopyableText();
    this.focusableElement!.focus();
  }

  /**
   * `beforeKeyDown` listener to force focus of focusableElement.
   *
   * @private
   */
  onBeforeKeyDown(): void {
    if (!this.hot.isListening() || this.isEditorOpened()) {
      return;
    }
    const { activeElement } = document;
    const activeEditor = this.hot.getActiveEditor();

    if (!activeEditor ||
      (activeElement !== this.focusableElement!.getFocusableElement() && activeElement !== (activeEditor as { select?: HTMLElement }).select)) {
      return;
    }

    this.getOrCreateFocusableElement();
    this.focusableElement!.focus();
  }

  /**
   * Destroys the plugin instance.
   */
  destroy(): void {
    if (this.focusableElement) {
      destroyElement(this.focusableElement);
      this.focusableElement = null;
    }

    super.destroy();
  }

  /** Puts the values on the clipboard as text (tab separated) and as an HTML table. */
  #putOnClipboard(event: ClipboardEvent, rangedData: unknown[][], formats?: CellFormat[][]): void {
    if (event?.clipboardData) {
      event.clipboardData.setData('text/plain', SheetClip.stringify(rangedData));
      event.clipboardData.setData('text/html', arrayToTable(rangedData, formats));
    }
  }
}

registerPlugin('CopyPaste', CopyPaste);

export default CopyPaste;
