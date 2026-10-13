import { addClass, outerHeight } from './../helpers/dom/element';
import { applyTheme } from './../helpers/dom/theme';
import { deepExtend } from './../helpers/object';
import { formatDate, parseDate } from './../helpers/dateFormat';
import EventManager from './../eventManager';
import { isMetaKey } from './../helpers/unicode';
import { stopPropagation } from './../helpers/dom/event';
import EditorText from './editorText';
import { DatePicker } from './datePicker/datePicker';
import type { DatePickerOptions } from './datePicker/datePicker';

/**
 * A text editor with a date picker under the cell. The picked day is written in the cell's `dateFormat`; the cell's
 * `datePickerConfig` holds the picker's options and `defaultDate` the day shown for an empty cell.
 */
class EditorDate extends EditorText {
  // Set by createElements(), inside the base constructor.
  /** The picker's holder (in `<body>`). */
  declare datePicker: HTMLDivElement;

  declare datePickerStyle: CSSStyleDeclaration;

  declare $datePicker: DatePicker;

  /** The format of cells without a `dateFormat`. */
  defaultDateFormat = 'DD/MM/YYYY';

  isCellEdited = false;

  parentDestroyed = false;

  /** The `defaultDate` shown for an empty cell: confirming the empty editor writes it. */
  defaultDateShown: string | null = null;

  init(): void {
    super.init();
    this.instance.addHook('afterDestroy', () => {
      this.parentDestroyed = true;
      this.destroyElements();
    });
  }

  createElements(): void {
    super.createElements();

    this.datePicker = document.createElement('DIV') as HTMLDivElement;
    this.datePickerStyle = this.datePicker.style;
    this.datePickerStyle.position = 'absolute';
    this.datePickerStyle.top = '0';
    this.datePickerStyle.left = '0';
    this.datePickerStyle.zIndex = '9999';

    addClass(this.datePicker, 'fg-datepicker-holder');
    document.body.appendChild(this.datePicker);

    this.$datePicker = new DatePicker(this.datePicker, this.getDatePickerConfig());
    const eventManager = new EventManager(this);

    // A click in the picker is not a click outside the grid.
    eventManager.addEventListener(this.datePicker, 'mousedown', (event: Event) => stopPropagation(event));
    // Alt+Down moves the keyboard focus into the calendar.
    eventManager.addEventListener(this.TEXTAREA, 'keydown', (event: KeyboardEvent) => {
      if (event.altKey && event.key === 'ArrowDown' && this.$datePicker.isVisible()) {
        event.preventDefault();
        stopPropagation(event);
        this.$datePicker.focus();
      }
    });
    // The calendar follows a date typed in the cell's format.
    eventManager.addEventListener(this.TEXTAREA, 'input', () => {
      const date = parseDate(this.getValue(), this.#dateFormat(), true);

      if (date && this.$datePicker.isVisible()) {
        this.$datePicker.setDate(date, true);
      }
    });
    this.hideDatepicker();
  }

  destroyElements(): void {
    this.$datePicker.destroy();
    this.datePicker.remove();
  }

  open(event: Event | null = null): void {
    super.open();
    // The date picker is in <body>, outside the grid: give it the grid's theme.
    applyTheme(this.datePicker, this.instance.rootElement);
    this.showDatepicker(event);
  }

  close(): void {
    this._opened = false;
    this.instance._registerTimeout(() => {
      this.instance._refreshBorders();
    });

    super.close();
  }

  finishEditing(isCancelled = false, ctrlDown = false, callback?: (result: boolean) => void): void {
    // Esc: the original value comes back.
    if (isCancelled && this.originalValue !== undefined) {
      this.setValue(this.originalValue);
    }
    // An empty cell confirmed without typing gets its defaultDate.
    if (!isCancelled && this.defaultDateShown && this.getValue() === '') {
      this.setValue(this.defaultDateShown);
    }
    this.defaultDateShown = null;
    this.hideDatepicker();
    super.finishEditing(isCancelled, ctrlDown, callback);
  }

  /**
   * Shows the picker under the cell, at the cell's date (or its `defaultDate`, or today). Typing replaces the value
   * unless the editor was opened with the mouse or a meta key.
   */
  showDatepicker(event: Event | null): void {
    this.$datePicker.config(this.getDatePickerConfig());

    const cellRect = this.TD.getBoundingClientRect();
    const dateFormat = this.#dateFormat();
    const datePickerConfig = this.$datePicker.config();
    const isMouseDown = this.instance.view.isMouseDown();
    const isMeta = event ? isMetaKey((event as KeyboardEvent).keyCode) : false;
    const replaceValue = !isMeta && !isMouseDown;

    this.defaultDateShown = null;

    this.datePickerStyle.top = `${window.pageYOffset + cellRect.top + outerHeight(this.TD)}px`;
    this.datePickerStyle.left = `${window.pageXOffset + cellRect.left}px`;

    datePickerConfig.format = dateFormat;

    if (this.originalValue) {
      const dateStr = this.originalValue as string;

      this.selectDateInPicker(dateStr, dateFormat);

      // The editor keeps the cell's value (with its time, for date-and-time formats).
      if (this.getValue() !== this.originalValue) {
        this.setValue(this.originalValue);
      }
      if (replaceValue) {
        this.setValue('');
      }

    } else if (this.cellProperties.defaultDate) {
      const dateStr = this.cellProperties.defaultDate as string;

      datePickerConfig.defaultDate = dateStr;
      this.defaultDateShown = dateStr;

      this.selectDateInPicker(dateStr, dateFormat);

      if (replaceValue) {
        this.setValue('');
      }
    } else {
      // No default date: the picker shows today, the editor stays empty.
      this.$datePicker.gotoToday();
    }

    this.datePickerStyle.display = 'block';
    this.$datePicker.show();
  }

  /** Shows the day of `dateStr` in the date picker, if `dateStr` is a date in `dateFormat`. */
  selectDateInPicker(dateStr: string, dateFormat: string): void {
    const date = parseDate(dateStr, dateFormat, true);

    if (date) {
      this.$datePicker.setDate(date, true);
    }
  }

  hideDatepicker(): void {
    this.datePickerStyle.display = 'none';
    this.$datePicker.hide();
  }

  /** Gives the keyboard focus back to the editor after the calendar had it. */
  focusEditorIfInPicker(): void {
    if (this.datePicker.contains(document.activeElement)) {
      this.focus();
    }
  }

  /** The picker's options: the cell's `datePickerConfig`, wired to the editor. */
  getDatePickerConfig(): DatePickerOptions {
    const options: DatePickerOptions = {};

    if (this.cellProperties?.datePickerConfig) {
      deepExtend(options as Record<PropertyKey, unknown>, this.cellProperties.datePickerConfig as Record<PropertyKey, unknown>);
    }
    const { onSelect, onClose } = options;

    options.field = this.TEXTAREA;
    options.trigger = this.TEXTAREA;
    options.container = this.datePicker;
    options.bound = false;
    options.format = options.format || this.defaultDateFormat;
    options.onSelect = (value: Date) => {
      this.focusEditorIfInPicker();
      this.setValue(formatDate(value, this.#dateFormat()));
      this.hideDatepicker();
      // Called without the date, as before.
      (onSelect as (() => void) | undefined)?.();
    };
    options.onClose = () => {
      this.focusEditorIfInPicker();

      if (!this.parentDestroyed) {
        this.finishEditing(false);
      }
      onClose?.();
    };

    return options;
  }

  #dateFormat(): string {
    return (this.cellProperties.dateFormat as string | undefined) || this.defaultDateFormat;
  }
}

export default EditorDate;
