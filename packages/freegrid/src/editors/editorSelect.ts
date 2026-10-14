import {
  addClass,
  empty,
  fastInnerHTML,
  getComputedStyle,
  getCssTransform,
  getScrollableElement,
  offset,
  outerHeight,
  outerWidth,
  resetCssTransform,
} from './../helpers/dom/element';
import { stopImmediatePropagation } from './../helpers/dom/event';
import { KEY_CODES } from './../helpers/unicode';
import EditorBase, { EditorState } from './editorBase';
import type { EditorHost } from './editorBase';
import type { CellProperties } from '../cellTypes/types';

/** The cell's `selectOptions`: values, `{ value: label }`, or a function of the cell that gives either. */
type SelectOptions = unknown[] | Record<string, unknown>;

// A grid hook: `this` is the grid. The arrow keys change the selected option.
const onBeforeKeyDown = function onBeforeKeyDown(this: EditorHost, event: KeyboardEvent) {
  const editor = this.getActiveEditor() as EditorSelect;
  const { select } = editor;
  let optionIndex: number;

  if (event.keyCode === KEY_CODES.ARROW_UP) {
    optionIndex = select.selectedIndex - 1;
  } else if (event.keyCode === KEY_CODES.ARROW_DOWN) {
    optionIndex = select.selectedIndex + 1;
  } else {
    return;
  }
  if (optionIndex >= 0 && optionIndex < select.length) {
    select.options[optionIndex].selected = true;
  }
  stopImmediatePropagation(event);
  event.preventDefault();
};

/** A native `<select>` over the cell, with the cell's `selectOptions`. */
class EditorSelect extends EditorBase {
  // Set by init(), inside the base constructor.
  declare select: HTMLSelectElement;

  init(): void {
    this.select = document.createElement('SELECT') as HTMLSelectElement;
    addClass(this.select, 'fg-select-editor');
    this.select.style.display = 'none';
    this.instance.rootElement.appendChild(this.select);
    this.registerHooks();
  }

  /** Keeps the select over the cell while the grid scrolls or resizes. */
  registerHooks(): void {
    ['afterScrollHorizontally', 'afterScrollVertically', 'afterColumnResize', 'afterRowResize'].forEach((hook) => {
      this.instance.addHook(hook, () => this.refreshDimensions());
    });
  }

  prepare(row: number, col: number, prop: string | number, td: HTMLTableCellElement, originalValue: unknown,
    cellProperties: CellProperties): void {
    super.prepare(row, col, prop, td, originalValue, cellProperties);

    const { selectOptions } = this.cellProperties;
    const rawOptions = typeof selectOptions === 'function' ?
      selectOptions(this.row, this.col, this.prop) : selectOptions as SelectOptions;
    // An array keeps its order (as an object, integer keys would come out sorted).
    const options: [string, unknown][] = Array.isArray(rawOptions)
      ? rawOptions.map(option => [String(option), option])
      : Object.entries(this.prepareOptions(rawOptions));

    empty(this.select);

    options.forEach(([key, value]) => {
      const optionElement = document.createElement('OPTION') as HTMLOptionElement;

      optionElement.value = key;
      fastInnerHTML(optionElement, value as string);
      this.select.appendChild(optionElement);
    });
  }

  /** The options as `{ value: label }` (an array's values are both). */
  prepareOptions(optionsToPrepare: SelectOptions | undefined): Record<string, unknown> {
    if (Array.isArray(optionsToPrepare)) {
      return Object.fromEntries(optionsToPrepare.map(option => [option, option]));
    }
    if (typeof optionsToPrepare === 'object' && optionsToPrepare !== null) {
      return optionsToPrepare;
    }

    return {};
  }

  getValue(): string {
    return this.select.value;
  }

  setValue(value?: unknown): void {
    this.select.value = value as string;
  }

  open(): void {
    this._opened = true;
    this.refreshDimensions();
    this.select.style.display = '';
    this.instance.addHook('beforeKeyDown', onBeforeKeyDown);
  }

  close(): void {
    this._opened = false;
    this.select.style.display = 'none';
    this.instance.removeHook('beforeKeyDown', onBeforeKeyDown);
  }

  focus(): void {
    this.select.focus();
  }

  /** Takes the cell's value again (it was changed while the editor was open). */
  refreshValue(): void {
    // A property name works as the column too (colToProp passes it through).
    const sourceData = this.instance.getSourceDataAtCell(this.row, this.prop as number);

    this.originalValue = sourceData;
    this.setValue(sourceData);
    this.refreshDimensions();
  }

  /** Puts the select over the cell (closes it when the cell is scrolled out of view). */
  refreshDimensions(): void {
    if (this.state !== EditorState.EDITING) {
      return;
    }
    const editedCell = this.getEditedCell();

    if (!editedCell) {
      this.close();

      return;
    }
    this.TD = editedCell;

    const currentOffset = offset(this.TD);
    const containerOffset = offset(this.instance.rootElement);
    const scrollableContainer = getScrollableElement(this.TD) as HTMLElement;
    const overlay = ({
      top: 'topOverlay',
      left: 'leftOverlay',
      'top-left-corner': 'topLeftCornerOverlay',
      'bottom-left-corner': 'bottomLeftCornerOverlay',
      bottom: 'bottomOverlay',
    } as const)[this.checkEditorSection()];
    const cssTransformOffset = overlay ?
      getCssTransform(this.instance.view.wt.wtOverlays[overlay].clone.wtTable.holder.parentNode) : undefined;
    let width = outerWidth(this.TD) + 1;
    let height = outerHeight(this.TD) + 1;
    let editTop = currentOffset.top - containerOffset.top - 1 - (scrollableContainer.scrollTop || 0);
    let editLeft = currentOffset.left - containerOffset.left - 1 - (scrollableContainer.scrollLeft || 0);
    const [selectedRow, selectedColumn] = this.instance.getSelectedLast() as number[];

    if (selectedRow === 0) {
      editTop += 1;
    }
    if (selectedColumn === 0) {
      editLeft += 1;
    }

    const selectStyle = this.select.style;

    if (cssTransformOffset && cssTransformOffset !== -1) {
      selectStyle.setProperty(cssTransformOffset[0], cssTransformOffset[1]);
    } else {
      resetCssTransform(this.select);
    }
    const cellComputedStyle = getComputedStyle(this.TD);

    if (parseInt(cellComputedStyle.borderTopWidth, 10) > 0) {
      height -= 1;
    }
    if (parseInt(cellComputedStyle.borderLeftWidth, 10) > 0) {
      width -= 1;
    }

    selectStyle.height = `${height}px`;
    selectStyle.minWidth = `${width}px`;
    selectStyle.top = `${editTop}px`;
    selectStyle.left = `${editLeft}px`;
    selectStyle.margin = '0px';
  }

  /** The cell being edited, in the overlay it is drawn in (the select goes over that overlay). */
  getEditedCell(): HTMLTableCellElement | undefined {
    const { wtOverlays } = this.instance.view.wt;
    const coords = { row: this.row, col: this.col };
    let editedCell;

    switch (this.checkEditorSection()) {
      case 'top':
        editedCell = wtOverlays.topOverlay.clone.wtTable.getCell(coords);
        this.select.style.zIndex = '101';
        break;
      case 'top-left-corner':
        editedCell = wtOverlays.topLeftCornerOverlay.clone.wtTable.getCell(coords);
        this.select.style.zIndex = '103';
        break;
      case 'left':
        editedCell = wtOverlays.leftOverlay.clone.wtTable.getCell(coords);
        this.select.style.zIndex = '102';
        break;
      default:
        editedCell = this.instance.getCell(this.row, this.col);
        this.select.style.zIndex = '';
        break;
    }

    // Walkontable gives -1 and -2 for cells outside the rendered range.
    return editedCell !== -1 && editedCell !== -2 && editedCell ? editedCell : undefined;
  }
}

export default EditorSelect;
