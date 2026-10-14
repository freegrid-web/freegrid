import {
  addClass,
  getCaretPosition,
  getComputedStyle,
  getCssTransform,
  getScrollbarWidth,
  innerWidth,
  offset,
  resetCssTransform,
  setCaretPosition,
  hasVerticalScrollbar,
  hasHorizontalScrollbar
} from './../helpers/dom/element';
import autoResize from './../../lib/autoResize/autoResize';
import { isMobileBrowser } from './../helpers/browser';
import EditorBase, { EditorState } from './editorBase';
import type { EditorHost } from './editorBase';
import type { CellProperties } from '../cellTypes/types';
import EventManager from './../eventManager';
import { KEY_CODES } from './../helpers/unicode';
import { stopPropagation, stopImmediatePropagation, isImmediatePropagationStopped } from './../helpers/dom/event';

// A grid hook: `this` is the grid.
const onBeforeKeyDown = function onBeforeKeyDown(this: EditorHost, event: KeyboardEvent) {
  const that = this.getActiveEditor() as EditorText;

  // catch CTRL but not right ALT (which in some systems triggers ALT+CTRL)
  const ctrlDown = (event.ctrlKey || event.metaKey) && !event.altKey;

  // Process only events that have been fired in the editor
  if (event.target !== that.TEXTAREA || isImmediatePropagationStopped(event)) {
    return;
  }

  switch (event.keyCode) {
    case KEY_CODES.ARROW_RIGHT:
    case KEY_CODES.ARROW_LEFT:
    case KEY_CODES.ARROW_UP:
    case KEY_CODES.ARROW_DOWN:
      // In full edit mode the arrow keys move the caret.
      if (that.isInFullEditMode() && !that.isWaiting() && !that.allowKeyEventPropagation(event.keyCode)) {
        stopImmediatePropagation(event);
      }
      break;

    case KEY_CODES.ENTER: {
      const isMultipleSelection = this.selection.isMultiple();

      if ((ctrlDown && !isMultipleSelection) || event.altKey) { // if ctrl+enter or alt+enter, add new line
        if (that.isOpened()) {
          const caretPosition = getCaretPosition(that.TEXTAREA);
          const value = that.getValue();
          const newValue = `${value.slice(0, caretPosition)}\n${value.slice(caretPosition)}`;

          that.setValue(newValue);

          setCaretPosition(that.TEXTAREA, caretPosition + 1);

        } else {
          that.beginEditing(`${that.originalValue}\n`);
        }
        stopImmediatePropagation(event);
      }
      event.preventDefault(); // don't add newline to field
      break;
    }

    case KEY_CODES.BACKSPACE:
    case KEY_CODES.DELETE:
    case KEY_CODES.HOME:
    case KEY_CODES.END:
      stopImmediatePropagation(event); // backspace, delete, home, end should only work locally when cell is edited (not in table context)
      break;

    default:
      break;
  }

  if ([KEY_CODES.ARROW_UP, KEY_CODES.ARROW_RIGHT, KEY_CODES.ARROW_DOWN, KEY_CODES.ARROW_LEFT].indexOf(event.keyCode) === -1) {
    that.autoResize.resize(String.fromCharCode(event.keyCode));
  }
};

/**
 * The default editor: a textarea over the cell, sized to its content. It is moved off screen while the cell is only
 * selected (so that typing goes into it, also with IME), and over the cell while editing.
 */
class EditorText extends EditorBase {
  // Set by init() and createElements(), which run inside the base constructor: `declare` keeps these field
  // definitions from resetting them afterwards.
  declare TEXTAREA: HTMLTextAreaElement;

  declare textareaStyle: CSSStyleDeclaration;

  declare TEXTAREA_PARENT: HTMLDivElement;

  declare textareaParentStyle: CSSStyleDeclaration;

  declare eventManager: EventManager;

  declare autoResize: ReturnType<typeof autoResize>;

  declare holderZIndex: number;

  /**
   * @private
   * @editor EditorText
   * @class EditorText
   * @dependencies autoResize
   */
  init(): void {
    this.createElements();
    this.eventManager = new EventManager(this);
    this.bindEvents();
    this.autoResize = autoResize();
    this.holderZIndex = -1;

    this.instance.addHook('afterDestroy', () => {
      this.destroy();
    });
  }

  prepare(row: number, col: number, prop: string | number, td: HTMLTableCellElement, originalValue: unknown,
    cellProperties: CellProperties): void {
    const previousState = this.state;

    super.prepare(row, col, prop, td, originalValue, cellProperties);

    if (!cellProperties.readOnly) {
      this.refreshDimensions(true);

      const {
        allowInvalid,
        fragmentSelection,
      } = cellProperties;

      if (allowInvalid) {
        this.TEXTAREA.value = ''; // Remove an empty space from texarea (added by copyPaste plugin to make copy/paste functionality work with IME)
      }

      if (previousState !== EditorState.FINISHED) {
        this.hideEditableElement();
      }

      // fragmentSelection conflicts with IME: refocusing the editor breaks IME input, so it is off then.
      const restoreFocus = !fragmentSelection;

      if (restoreFocus && !isMobileBrowser()) {
        this.instance._registerImmediate(() => this.focus());
      }
    }
  }

  /** Whether an arrow key reaches the grid in full edit mode (instead of moving the caret). */
  allowKeyEventPropagation(_keyCode: number): boolean {
    return false;
  }

  hideEditableElement(): void {
    this.textareaParentStyle.top = '-9999px';
    this.textareaParentStyle.left = '-9999px';
    this.textareaParentStyle.zIndex = '-1';
    this.textareaParentStyle.position = 'fixed';
  }

  showEditableElement(): void {
    this.textareaParentStyle.zIndex = this.holderZIndex >= 0 ? String(this.holderZIndex) : '';
    this.textareaParentStyle.position = '';
  }

  getValue(): string {
    return this.TEXTAREA.value;
  }

  setValue(newValue?: unknown): void {
    this.TEXTAREA.value = newValue as string;
  }

  beginEditing(newInitialValue?: string, event?: Event | null): void {
    if (this.state !== EditorState.VIRGIN) {
      return;
    }

    this.TEXTAREA.value = ''; // Remove an empty space from texarea (added by copyPaste plugin to make copy/paste functionality work with IME).
    super.beginEditing(newInitialValue, event);
  }

  open(): void {
    this.refreshDimensions(); // need it instantly, to prevent https://github.com/handsontable/handsontable/issues/348
    this.showEditableElement();

    this.instance.addHook('beforeKeyDown', onBeforeKeyDown);
  }

  close(): void {
    this.autoResize.unObserve();

    if (document.activeElement === this.TEXTAREA) {
      this.instance.listen(); // don't refocus the table if user focused some cell outside of HT on purpose
    }

    this.hideEditableElement();
    this.instance.removeHook('beforeKeyDown', onBeforeKeyDown);
  }

  focus(): void {
    // For IME editor textarea element must be focused using ".select" method. Using ".focus" browser automatically scroll into
    // the focused element which is undesire effect.
    this.TEXTAREA.select();
    setCaretPosition(this.TEXTAREA, this.TEXTAREA.value.length);
  }

  createElements(): void {
    this.TEXTAREA = document.createElement('textarea');
    this.TEXTAREA.tabIndex = -1;

    addClass(this.TEXTAREA, 'fg-editor-input');

    this.textareaStyle = this.TEXTAREA.style;
    this.textareaStyle.width = '0';
    this.textareaStyle.height = '0';

    this.TEXTAREA_PARENT = document.createElement('div');
    addClass(this.TEXTAREA_PARENT, 'fg-editor-holder');

    this.textareaParentStyle = this.TEXTAREA_PARENT.style;
    this.textareaParentStyle.zIndex = '-1';

    this.TEXTAREA_PARENT.appendChild(this.TEXTAREA);

    this.instance.rootElement.appendChild(this.TEXTAREA_PARENT);
  }

  getEditedCell(): HTMLTableCellElement | undefined {
    const editorSection = this.checkEditorSection();
    let editedCell;

    switch (editorSection) {
      case 'top':
        editedCell = this.instance.view.wt.wtOverlays.topOverlay.clone.wtTable.getCell({
          row: this.row,
          col: this.col
        });
        this.holderZIndex = 101;
        break;
      case 'top-left-corner':
        editedCell = this.instance.view.wt.wtOverlays.topLeftCornerOverlay.clone.wtTable.getCell({
          row: this.row,
          col: this.col
        });
        this.holderZIndex = 103;
        break;
      case 'bottom-left-corner':
        editedCell = this.instance.view.wt.wtOverlays.bottomLeftCornerOverlay.clone.wtTable.getCell({
          row: this.row,
          col: this.col
        });
        this.holderZIndex = 103;
        break;
      case 'left':
        editedCell = this.instance.view.wt.wtOverlays.leftOverlay.clone.wtTable.getCell({
          row: this.row,
          col: this.col
        });
        this.holderZIndex = 102;
        break;
      case 'bottom':
        editedCell = this.instance.view.wt.wtOverlays.bottomOverlay.clone.wtTable.getCell({
          row: this.row,
          col: this.col
        });
        this.holderZIndex = 102;
        break;
      default:
        editedCell = this.instance.getCell(this.row, this.col);
        this.holderZIndex = -1;
        break;
    }

    return editedCell !== -1 && editedCell !== -2 ? editedCell : void 0;
  }

  refreshValue(): void {
    const physicalRow = this.instance.toPhysicalRow(this.row);
    const sourceData = this.instance.getSourceDataAtCell(physicalRow, this.col);
    this.originalValue = sourceData;

    this.setValue(sourceData);
    this.refreshDimensions();
  }

  refreshDimensions(force = false): void {
    if (this.state !== EditorState.EDITING && !force) {
      return;
    }
    this.TD = this.getEditedCell() as HTMLTableCellElement;

    // TD is outside of the viewport.
    if (!this.TD) {
      if (!force) {
        this.close();
      }

      return;
    }

    const currentOffset = offset(this.TD);
    const containerOffset = offset(this.instance.rootElement);
    const scrollableContainerTop = this.instance.view.wt.wtOverlays.topOverlay.mainTableScrollableElement;
    const scrollableContainerLeft = this.instance.view.wt.wtOverlays.leftOverlay.mainTableScrollableElement;
    const totalRowsCount = this.instance.countRows();
    const containerScrollTop = scrollableContainerTop !== window ? scrollableContainerTop.scrollTop : 0;
    const containerScrollLeft = scrollableContainerLeft !== window ? scrollableContainerLeft.scrollLeft : 0;
    const editorSection = this.checkEditorSection();

    const scrollTop = ['', 'left'].includes(editorSection) ? containerScrollTop : 0;
    const scrollLeft = ['', 'top', 'bottom'].includes(editorSection) ? containerScrollLeft : 0;

    // If colHeaders is disabled, cells in the first row have border-top
    const editTopModifier = currentOffset.top === containerOffset.top ? 0 : 1;

    const settings = this.instance.getSettings();
    const colHeadersCount = this.instance.hasColHeaders();
    const backgroundColor = this.TD.style.backgroundColor;

    let editTop = currentOffset.top - containerOffset.top - editTopModifier - scrollTop;
    let editLeft = currentOffset.left - containerOffset.left - 1 - scrollLeft;
    let cssTransformOffset;

    // Reads the overlays' clones (Walkontable internals; see #71).
    switch (editorSection) {
      case 'top':
        cssTransformOffset = getCssTransform(this.instance.view.wt.wtOverlays.topOverlay.clone.wtTable.holder.parentNode);
        break;
      case 'left':
        cssTransformOffset = getCssTransform(this.instance.view.wt.wtOverlays.leftOverlay.clone.wtTable.holder.parentNode);
        break;
      case 'top-left-corner':
        cssTransformOffset = getCssTransform(this.instance.view.wt.wtOverlays.topLeftCornerOverlay.clone.wtTable.holder.parentNode);
        break;
      case 'bottom-left-corner':
        cssTransformOffset = getCssTransform(this.instance.view.wt.wtOverlays.bottomLeftCornerOverlay.clone.wtTable.holder.parentNode);
        break;
      case 'bottom':
        cssTransformOffset = getCssTransform(this.instance.view.wt.wtOverlays.bottomOverlay.clone.wtTable.holder.parentNode);
        break;
      default:
        break;
    }

    if (colHeadersCount && this.instance.getSelectedLast()![0] === 0 ||
        (settings.fixedRowsBottom && this.instance.getSelectedLast()![0] === totalRowsCount - settings.fixedRowsBottom)) {
      editTop += 1;
    }

    if (this.instance.getSelectedLast()![1] === 0) {
      editLeft += 1;
    }

    if (cssTransformOffset && cssTransformOffset !== -1) {
      (this.textareaParentStyle as unknown as Record<string, string>)[cssTransformOffset[0]] = cssTransformOffset[1];
    } else {
      resetCssTransform(this.TEXTAREA_PARENT);
    }

    this.textareaParentStyle.top = `${editTop}px`;
    this.textareaParentStyle.left = `${editLeft}px`;
    this.showEditableElement();

    const firstRowOffset = this.instance.view.wt.wtViewport.rowsRenderCalculator.startPosition;
    const firstColumnOffset = this.instance.view.wt.wtViewport.columnsRenderCalculator.startPosition;
    const horizontalScrollPosition = this.instance.view.wt.wtOverlays.leftOverlay.getScrollPosition();
    const verticalScrollPosition = this.instance.view.wt.wtOverlays.topOverlay.getScrollPosition();
    const scrollbarWidth = getScrollbarWidth();

    const cellTopOffset = this.TD.offsetTop + firstRowOffset - verticalScrollPosition;
    const cellLeftOffset = this.TD.offsetLeft + firstColumnOffset - horizontalScrollPosition;

    const width = innerWidth(this.TD) - 8;
    const actualVerticalScrollbarWidth = hasVerticalScrollbar(scrollableContainerTop) ? scrollbarWidth : 0;
    const actualHorizontalScrollbarWidth = hasHorizontalScrollbar(scrollableContainerLeft) ? scrollbarWidth : 0;
    const maxWidth = this.instance.view.maximumVisibleElementWidth(cellLeftOffset) - 9 - actualVerticalScrollbarWidth;
    const height = this.TD.scrollHeight + 1;
    const maxHeight = Math.max(this.instance.view.maximumVisibleElementHeight(cellTopOffset) - actualHorizontalScrollbarWidth,
      this.instance.view.wt.wtSettings.settings.defaultRowHeight);

    const cellComputedStyle = getComputedStyle(this.TD);

    this.TEXTAREA.style.fontSize = cellComputedStyle.fontSize;
    this.TEXTAREA.style.fontFamily = cellComputedStyle.fontFamily;
    this.TEXTAREA.style.backgroundColor = backgroundColor;

    this.autoResize.init(this.TEXTAREA, {
      minHeight: Math.min(height, maxHeight),
      maxHeight, // TEXTAREA should never be higher than visible part of the viewport (should not cover the scrollbar)
      minWidth: Math.min(width, maxWidth),
      maxWidth // TEXTAREA should never be wider than visible part of the viewport (should not cover the scrollbar)
    }, true);
  }

  bindEvents(): void {
    this.eventManager.addEventListener(this.TEXTAREA, 'cut', (event: Event) => {
      stopPropagation(event);
    });
    this.eventManager.addEventListener(this.TEXTAREA, 'paste', (event: Event) => {
      stopPropagation(event);
    });

    this.instance.addHook('afterScrollHorizontally', () => {
      this.refreshDimensions();
    });

    this.instance.addHook('afterScrollVertically', () => {
      this.refreshDimensions();
    });

    this.instance.addHook('afterColumnResize', () => {
      this.refreshDimensions();
      this.focus();
    });

    this.instance.addHook('afterRowResize', () => {
      this.refreshDimensions();
      this.focus();
    });

    this.instance.addHook('afterDestroy', () => {
      this.eventManager.destroy();
    });
  }

  destroy(): void {
    this.eventManager.destroy();
  }
}

export default EditorText;
