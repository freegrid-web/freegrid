import { addClass, outerHeight } from './../helpers/dom/element';
import { applyTheme } from './../helpers/dom/theme';
import { deepExtend } from './../helpers/object';
import { formatDate, parseDate } from './../helpers/dateFormat';
import EventManager from './../eventManager';
import { isMetaKey } from './../helpers/unicode';
import { stopPropagation } from './../helpers/dom/event';
import TextEditor from './textEditor';
import { DatePicker } from './datePicker/datePicker';

/**
 * @private
 * @editor DateEditor
 * @class DateEditor
 * @dependencies TextEditor
 */
class DateEditor extends TextEditor {
  /**
   * @param {Core} hotInstance FreeGrid instance
   * @private
   */
  constructor(hotInstance) {
    super(hotInstance);

    // TODO: Move this option to general settings
    this.defaultDateFormat = 'DD/MM/YYYY';
    this.isCellEdited = false;
    this.parentDestroyed = false;
  }

  init() {
    super.init();
    this.instance.addHook('afterDestroy', () => {
      this.parentDestroyed = true;
      this.destroyElements();
    });
  }

  /**
   * Create data picker instance
   */
  createElements() {
    super.createElements();

    this.datePicker = document.createElement('DIV');
    this.datePickerStyle = this.datePicker.style;
    this.datePickerStyle.position = 'absolute';
    this.datePickerStyle.top = 0;
    this.datePickerStyle.left = 0;
    this.datePickerStyle.zIndex = 9999;

    addClass(this.datePicker, 'fg-datepicker-holder');
    document.body.appendChild(this.datePicker);

    this.$datePicker = new DatePicker(this.datePicker, this.getDatePickerConfig());
    const eventManager = new EventManager(this);

    /**
     * Prevent recognizing clicking on datepicker as clicking outside of table
     */
    eventManager.addEventListener(this.datePicker, 'mousedown', event => stopPropagation(event));
    // Alt+Down moves the keyboard focus into the calendar.
    eventManager.addEventListener(this.TEXTAREA, 'keydown', (event) => {
      if (event.altKey && event.key === 'ArrowDown' && this.$datePicker.isVisible()) {
        event.preventDefault();
        stopPropagation(event);
        this.$datePicker.focus();
      }
    });
    // The calendar follows a date typed in the cell's format.
    eventManager.addEventListener(this.TEXTAREA, 'input', () => {
      const date = parseDate(this.getValue(), this.cellProperties.dateFormat || this.defaultDateFormat, true);

      if (date && this.$datePicker.isVisible()) {
        this.$datePicker.setDate(date, true);
      }
    });
    this.hideDatepicker();
  }

  /**
   * Destroy data picker instance
   */
  destroyElements() {
    this.$datePicker.destroy();
    this.datePicker.remove();
  }

  /**
   * Prepare editor to appear
   *
   * @param {Number} row Row index
   * @param {Number} col Column index
   * @param {String} prop Property name (passed when datasource is an array of objects)
   * @param {HTMLTableCellElement} td Table cell element
   * @param {*} originalValue Original value
   * @param {Object} cellProperties Object with cell properties ({@see Core#getCellMeta})
   */
  prepare(row, col, prop, td, originalValue, cellProperties) {
    super.prepare(row, col, prop, td, originalValue, cellProperties);
  }

  /**
   * Open editor
   *
   * @param {Event} [event=null]
   */
  open(event = null) {
    super.open();
    // The date picker is in <body>, outside the grid: give it the grid's theme.
    applyTheme(this.datePicker, this.instance.rootElement);
    this.showDatepicker(event);
  }

  /**
   * Close editor
   */
  close() {
    this._opened = false;
    this.instance._registerTimeout(() => {
      this.instance._refreshBorders();
    });

    super.close();
  }

  /**
   * @param {Boolean} [isCancelled=false]
   * @param {Boolean} [ctrlDown=false]
   */
  finishEditing(isCancelled = false, ctrlDown = false) {
    if (isCancelled) { // pressed ESC, restore original value
      // var value = this.instance.getDataAtCell(this.row, this.col);
      const value = this.originalValue;

      if (value !== void 0) {
        this.setValue(value);
      }
    }
    this.hideDatepicker();
    super.finishEditing(isCancelled, ctrlDown);
  }

  /**
   * Show data picker
   *
   * @param {Event} event
   */
  showDatepicker(event) {
    this.$datePicker.config(this.getDatePickerConfig());

    const offset = this.TD.getBoundingClientRect();
    const dateFormat = this.cellProperties.dateFormat || this.defaultDateFormat;
    const datePickerConfig = this.$datePicker.config();
    let dateStr;
    const isMouseDown = this.instance.view.isMouseDown();
    const isMeta = event ? isMetaKey(event.keyCode) : false;

    this.datePickerStyle.top = `${window.pageYOffset + offset.top + outerHeight(this.TD)}px`;
    this.datePickerStyle.left = `${window.pageXOffset + offset.left}px`;

    datePickerConfig.format = dateFormat;

    if (this.originalValue) {
      dateStr = this.originalValue;

      this.selectDateInPicker(dateStr, dateFormat);

      // keep the cell's value (with its time, for date-and-time formats) in the editor
      if (this.getValue() !== this.originalValue) {
        this.setValue(this.originalValue);
      }

      if (!isMeta && !isMouseDown) {
        this.setValue('');
      }

    } else if (this.cellProperties.defaultDate) {
      dateStr = this.cellProperties.defaultDate;

      datePickerConfig.defaultDate = dateStr;

      this.selectDateInPicker(dateStr, dateFormat);

      if (!isMeta && !isMouseDown) {
        this.setValue('');
      }
    } else {
      // if a default date is not defined, set a soft-default-date: display the current day and month in the
      // datepicker, but don't fill the editor input
      this.$datePicker.gotoToday();
    }

    this.datePickerStyle.display = 'block';
    this.$datePicker.show();
  }

  /**
   * Shows the day of `dateStr` in the date picker, if `dateStr` is a date in `dateFormat`.
   *
   * @param {String} dateStr
   * @param {String} dateFormat
   */
  selectDateInPicker(dateStr, dateFormat) {
    const date = parseDate(dateStr, dateFormat, true);

    if (date) {
      this.$datePicker.setDate(date, true);
    }
  }

  /**
   * Hide data picker
   */
  hideDatepicker() {
    this.datePickerStyle.display = 'none';
    this.$datePicker.hide();
  }

  /**
   * Gives the keyboard focus back to the editor after the calendar had it.
   */
  focusEditorIfInPicker() {
    if (this.datePicker.contains(document.activeElement)) {
      this.focus();
    }
  }

  /**
   * Get date picker options.
   *
   * @returns {Object}
   */
  getDatePickerConfig() {
    const htInput = this.TEXTAREA;
    const options = {};

    if (this.cellProperties && this.cellProperties.datePickerConfig) {
      deepExtend(options, this.cellProperties.datePickerConfig);
    }
    const origOnSelect = options.onSelect;
    const origOnClose = options.onClose;

    options.field = htInput;
    options.trigger = htInput;
    options.container = this.datePicker;
    options.bound = false;
    options.format = options.format || this.defaultDateFormat;
    options.onSelect = (value) => {
      this.focusEditorIfInPicker();
      this.setValue(formatDate(value, this.cellProperties.dateFormat || this.defaultDateFormat));
      this.hideDatepicker();

      if (origOnSelect) {
        origOnSelect();
      }
    };
    options.onClose = () => {
      this.focusEditorIfInPicker();

      if (!this.parentDestroyed) {
        this.finishEditing(false);
      }
      if (origOnClose) {
        origOnClose();
      }
    };

    return options;
  }
}

export default DateEditor;
