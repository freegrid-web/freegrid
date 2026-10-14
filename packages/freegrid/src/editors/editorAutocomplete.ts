import { KEY_CODES, isPrintableChar } from './../helpers/unicode';
import { stringify, isDefined } from './../helpers/mixed';
import { stripTags } from './../helpers/string';
import { pivot } from './../helpers/array';
import {
  addClass,
  getCaretPosition,
  getScrollbarWidth,
  getSelectionEndPosition,
  outerWidth,
  outerHeight,
  offset,
  getTrimmingContainer,
  setCaretPosition,
} from './../helpers/dom/element';
import EditorHandsontable from './editorHandsontable';
import type { EditorHost } from './editorBase';

// A grid hook: `this` is the grid. Typing (or deleting) filters the list again.
const onBeforeKeyDown = function onBeforeKeyDown(this: EditorHost, event: KeyboardEvent) {
  const editor = this.getActiveEditor() as EditorAutocomplete;

  if (isPrintableChar(event.keyCode) || event.keyCode === KEY_CODES.BACKSPACE ||
    event.keyCode === KEY_CODES.DELETE || event.keyCode === KEY_CODES.INSERT) {
    // Ctrl+C / Cmd+C doesn't change the list.
    if (event.keyCode === KEY_CODES.C && (event.ctrlKey || event.metaKey)) {
      return;
    }
    if (editor.htEditor) {
      editor.instance._registerTimeout(() => {
        editor.queryChoices(editor.TEXTAREA.value);
      }, editor.isOpened() ? 0 : 10);
    }
  }
};

type Relevance = { baseIndex: number; index: number; charsLeft: number };

/**
 * A text editor with a list of choices (the cell's `source`: an array, or a function that gives them for the typed
 * text), filtered (`filter`) and sorted (`sortByRelevance`) by what is typed. With `strict`, the best matching choice
 * is selected.
 */
class EditorAutocomplete extends EditorHandsontable {
  // Set by init() (inside the base constructor) and by queryChoices().
  declare query: string | null;

  /** The choices as given by `source`. */
  declare rawChoices: unknown[];

  /** The choices in the list (as strings, without HTML unless `allowHtml`). */
  declare strippedChoices: string[];

  init(): void {
    super.init();
    this.query = null;
    this.strippedChoices = [];
    this.rawChoices = [];
  }

  /** The choice whose text is in the editor (so that a choice that isn't a string keeps its type), or the text. */
  getValue(): string {
    const selectedValue = this.rawChoices.find(value => this.stripValueIfNeeded(value) === this.TEXTAREA.value);

    // The cell gets the choice itself: it need not be a string.
    return (isDefined(selectedValue) ? selectedValue : this.TEXTAREA.value) as string;
  }

  createElements(): void {
    super.createElements();

    addClass(this.htContainer, 'autocompleteEditor');
    addClass(this.htContainer, window.navigator.platform.indexOf('Mac') === -1 ? '' : 'fg-mac-scroll');
  }

  open(): void {
    this.instance.addHook('beforeKeyDown', onBeforeKeyDown);
    // The inner grid would take the window as its scrollable container, not the editor.
    this.TEXTAREA_PARENT.style.overflow = 'auto';
    super.open();
    this.TEXTAREA_PARENT.style.overflow = '';

    const choicesListHot = this.htEditor.getInstance();
    const trimDropdown = this.cellProperties.trimDropdown === undefined ? true : this.cellProperties.trimDropdown;

    this.showEditableElement();
    this.focus();

    choicesListHot.updateSettings({
      colWidths: trimDropdown ? [outerWidth(this.TEXTAREA) - 2] : undefined,
      width: trimDropdown ? outerWidth(this.TEXTAREA) + getScrollbarWidth() + 2 : undefined,
      // Bolds the typed text in each choice.
      afterRenderer: (TD: HTMLTableCellElement, row: number, col: number, prop: string | number, value: unknown) => {
        const { filteringCaseSensitive, allowHtml } = this.cellProperties;
        const query = this.query ?? '';
        let cellValue = stringify(value);

        if (cellValue && !allowHtml) {
          const indexOfMatch = filteringCaseSensitive === true ? cellValue.indexOf(query) :
            cellValue.toLowerCase().indexOf(query.toLowerCase());

          if (indexOfMatch !== -1) {
            const match = cellValue.substr(indexOfMatch, query.length);

            cellValue = cellValue.replace(match, `<strong>${match}</strong>`);
          }
        }
        TD.innerHTML = cellValue;
      },
      autoColumnSize: true,
      modifyColWidth: (width: number, col: number) => {
        // Room for the <strong> text, roughly.
        const autoWidths = choicesListHot.getPlugin('autoColumnSize').widths;
        const columnWidth = autoWidths[col] || width;

        return trimDropdown ? columnWidth : columnWidth + 15;
      },
    });

    // Room for the list's scrollbar.
    this.htEditor.view.wt.wtTable.holder.parentNode.style['padding-right'] = `${getScrollbarWidth() + 2}px`;

    this.instance._registerTimeout(() => {
      this.queryChoices(this.TEXTAREA.value);
    });
  }

  /** Fills the list with the choices for `query` (from the cell's `source`). */
  queryChoices(query: string): void {
    this.query = query;
    const { source } = this.cellProperties;

    if (typeof source === 'function') {
      source.call(this.cellProperties, query, (choices: unknown[]) => {
        this.rawChoices = choices;
        this.updateChoicesList(this.stripValuesIfNeeded(choices));
      });

    } else if (Array.isArray(source)) {
      this.rawChoices = source;
      this.updateChoicesList(this.stripValuesIfNeeded(source));

    } else {
      this.updateChoicesList([]);
    }
  }

  /** Shows `choicesList` (filtered and sorted by the settings), sized and flipped to fit. */
  updateChoicesList(choicesList: string[]): void {
    const pos = getCaretPosition(this.TEXTAREA);
    const endPos = getSelectionEndPosition(this.TEXTAREA);
    const { sortByRelevance, filter } = this.cellProperties;
    let orderByRelevance: number[] = [];
    let highlightIndex: number | null = null;
    let choices = choicesList;

    if (sortByRelevance) {
      orderByRelevance = EditorAutocomplete.sortByRelevance(this.stripValueIfNeeded(this.getValue()), choices,
        this.cellProperties.filteringCaseSensitive as boolean | undefined);
    }

    if (filter === false) {
      if (orderByRelevance.length) {
        [highlightIndex] = orderByRelevance;
      }
    } else {
      // Sorted by relevance; with sortByRelevance, only the choices that contain the text.
      choices = orderByRelevance.length || sortByRelevance ? orderByRelevance.map(index => choices[index]) : choices;
      highlightIndex = 0;
    }

    this.strippedChoices = choices;
    this.htEditor.loadData(pivot([choices]));

    this.updateDropdownHeight();
    this.flipDropdownIfNeeded();

    if (this.cellProperties.strict === true) {
      this.highlightBestMatchingChoice(highlightIndex);
    }

    this.instance.listen(false);

    setCaretPosition(this.TEXTAREA, pos, pos === endPos ? undefined : endPos);
  }

  /** Shows the list above the cell when there is more room there than below. Returns whether it is flipped. */
  flipDropdownIfNeeded(): boolean {
    const textareaOffset = offset(this.TEXTAREA);
    const textareaHeight = outerHeight(this.TEXTAREA);
    const dropdownHeight = this.getDropdownHeight();
    const trimmingContainer = getTrimmingContainer(this.instance.view.wt.wtTable.TABLE) as HTMLElement;
    const trimmingContainerScrollTop = trimmingContainer.scrollTop;
    const headersHeight = outerHeight(this.instance.view.wt.wtTable.THEAD);
    let containerOffset = { top: 0, left: 0 };

    if ((trimmingContainer as unknown) !== window) {
      containerOffset = offset(trimmingContainer);
    }

    const spaceAbove = textareaOffset.top - containerOffset.top - headersHeight + trimmingContainerScrollTop;
    const spaceBelow = trimmingContainer.scrollHeight - spaceAbove - headersHeight - textareaHeight;
    const flipNeeded = dropdownHeight > spaceBelow && spaceAbove > spaceBelow;

    if (flipNeeded) {
      this.flipDropdown(dropdownHeight);
    } else {
      this.unflipDropdown();
    }

    this.limitDropdownIfNeeded(flipNeeded ? spaceAbove : spaceBelow, dropdownHeight);

    return flipNeeded;
  }

  /** Shortens the list to whole rows that fit in `spaceAvailable`. */
  limitDropdownIfNeeded(spaceAvailable: number, dropdownHeight: number): void {
    if (dropdownHeight <= spaceAvailable) {
      return;
    }
    let tempHeight = 0;
    let i = 0;
    let lastRowHeight: number;

    do {
      lastRowHeight = this.htEditor.getRowHeight(i) || this.htEditor.view.wt.wtSettings.settings.defaultRowHeight;
      tempHeight += lastRowHeight;
      i += 1;
    } while (tempHeight < spaceAvailable);

    const height = tempHeight - lastRowHeight;

    if (this.htEditor.flipped) {
      const { style } = this.htEditor.rootElement;

      style.top = `${parseInt(style.top, 10) + dropdownHeight - height}px`;
    }

    this.setDropdownHeight(height);
  }

  flipDropdown(dropdownHeight: number): void {
    const dropdownStyle = this.htEditor.rootElement.style;

    dropdownStyle.position = 'absolute';
    dropdownStyle.top = `${-dropdownHeight}px`;

    this.htEditor.flipped = true;
  }

  unflipDropdown(): void {
    const dropdownStyle = this.htEditor.rootElement.style;

    if (dropdownStyle.position === 'absolute') {
      dropdownStyle.position = '';
      dropdownStyle.top = '';
    }

    this.htEditor.flipped = undefined;
  }

  updateDropdownHeight(): void {
    const currentDropdownWidth = this.htEditor.getColWidth(0) + getScrollbarWidth() + 2;

    this.htEditor.updateSettings({
      height: this.getDropdownHeight(),
      width: this.cellProperties.trimDropdown ? undefined : currentDropdownWidth,
    });

    this.htEditor.view.wt.wtTable.alignOverlaysWithTrimmingContainer();
  }

  setDropdownHeight(height: number): void {
    this.htEditor.updateSettings({ height });
  }

  /** Selects the choice at `index` in the list (or nothing). */
  highlightBestMatchingChoice(index: number | null): void {
    if (typeof index === 'number') {
      this.htEditor.selectCell(index, 0, undefined, undefined, undefined, false);
    } else {
      this.htEditor.deselectCell();
    }
  }

  /**
   * The indexes of the `choices` that contain `value`, best first: where the text starts earlier, then where less
   * text is left after it. An empty `value` keeps every choice in order.
   */
  static sortByRelevance(value: string, choices: unknown[], caseSensitive?: boolean): number[] {
    if (value.length === 0) {
      return choices.map((_, index) => index);
    }
    const search = caseSensitive ? value : value.toLowerCase();
    const relevance: Relevance[] = [];

    choices.forEach((choice, baseIndex) => {
      const text = stripTags(stringify(choice));
      const index = (caseSensitive ? text : text.toLowerCase()).indexOf(search);

      if (index !== -1) {
        relevance.push({ baseIndex, index, charsLeft: text.length - index - value.length });
      }
    });

    return relevance
      .sort((a, b) => a.index - b.index || a.charsLeft - b.charsLeft)
      .map(({ baseIndex }) => baseIndex);
  }

  /** The list's height: `visibleRows` rows at most. */
  getDropdownHeight(): number {
    const firstRowHeight = this.htEditor.getInstance().getRowHeight(0) ||
      this.htEditor.view.wt.wtSettings.settings.defaultRowHeight;
    const visibleRows = this.cellProperties.visibleRows as number;

    return this.strippedChoices.length >= visibleRows ? visibleRows * firstRowHeight :
      (this.strippedChoices.length * firstRowHeight) + 8;
  }

  stripValueIfNeeded(value: unknown): string {
    return this.stripValuesIfNeeded([value])[0];
  }

  /** The values as strings, without HTML tags unless the cell has `allowHtml`. */
  stripValuesIfNeeded(values: unknown[]): string[] {
    const { allowHtml } = this.cellProperties;

    return values.map(value => (allowHtml ? stringify(value) : stripTags(stringify(value))));
  }

  /** Arrow up and down move in the list, except past its ends (then they move in the grid). */
  allowKeyEventPropagation(keyCode: number): boolean {
    const selectedRange = this.htEditor.getSelectedRangeLast();
    const selectedRow = selectedRange ? selectedRange.from.row : -1;

    return (keyCode === KEY_CODES.ARROW_DOWN && selectedRow > 0 && selectedRow < this.htEditor.countRows() - 1) ||
      (keyCode === KEY_CODES.ARROW_UP && selectedRow > -1);
  }

  close(): void {
    this.instance.removeHook('beforeKeyDown', onBeforeKeyDown);
    super.close();
  }

  discardEditor(result?: boolean): void {
    super.discardEditor(result);

    this.instance.view.render();
  }
}

export default EditorAutocomplete;
