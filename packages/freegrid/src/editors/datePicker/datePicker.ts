import { addDays, addMonths, isSameDay, monthGrid, startOfDay, toKey } from './calendar';
import './datePicker.css';

export interface DatePickerI18n {
  previousMonth?: string;
  nextMonth?: string;
  months?: string[];
  weekdays?: string[];
  weekdaysShort?: string[];
}

/**
 * The date picker's options. The names are Pikaday's, so `datePickerConfig` objects written for it keep working.
 */
export interface DatePickerOptions {
  /** The first day of the week: 0 = Sunday (default), 1 = Monday, … */
  firstDay?: number;
  minDate?: Date;
  maxDate?: Date;
  disableDayFn?: (date: Date) => boolean;
  disableWeekends?: boolean;
  /** Years in the year list: `n` years before and after the shown year (default 10), or `[from, to]`. */
  yearRange?: number | [number, number];
  /** The month shown when no day is selected. */
  defaultDate?: Date | string;
  i18n?: DatePickerI18n;
  onSelect?: (date: Date) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onDraw?: () => void;
  [option: string]: unknown;
}

const englishNames = (): Required<DatePickerI18n> => {
  const month = new Intl.DateTimeFormat('en-US', { month: 'long' });
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' });
  const weekdayShort = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
  // 1 January 2023 was a Sunday.
  const days = Array.from({ length: 7 }, (_, day) => new Date(2023, 0, 1 + day));

  return {
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    months: Array.from({ length: 12 }, (_, index) => month.format(new Date(2023, index, 1))),
    weekdays: days.map(day => weekday.format(day)),
    weekdaysShort: days.map(day => weekdayShort.format(day)),
  };
};

const create = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | number | boolean | undefined> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tag);

  Object.entries(attributes).forEach(([name, value]) => {
    if (value === true) {
      element.setAttribute(name, '');
    } else if (value !== false && value !== undefined) {
      element.setAttribute(name, String(value));
    }
  });
  element.append(...children);

  return element;
};

// Keyboard moves inside the day grid: [days, months].
const MOVES: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [-7, 0],
  ArrowDown: [7, 0],
  PageUp: [0, -1],
  PageDown: [0, 1],
};

/**
 * A month calendar: pick a day with the mouse or the keyboard. Used by the date editor.
 */
export class DatePicker {
  readonly element: HTMLElement;

  #options: DatePickerOptions;

  #selected: Date | null = null;

  /** The day with keyboard focus; its month is the one shown. */
  #active: Date;

  #visible = false;

  constructor(container: HTMLElement, options: DatePickerOptions = {}) {
    this.#options = { ...options };
    this.#active = this.#startDay();
    this.element = create('div', { class: 'fg-datepicker', role: 'dialog', 'aria-label': 'Choose a date' });
    this.element.hidden = true;
    this.element.addEventListener('mousedown', this.#onMouseDown);
    this.element.addEventListener('change', this.#onChange);
    this.element.addEventListener('keydown', this.#onKeyDown);
    container.appendChild(this.element);
  }

  /**
   * Merges `options` into the current ones and returns them all.
   */
  config(options?: DatePickerOptions): DatePickerOptions {
    if (options) {
      this.#options = { ...this.#options, ...options };

      if (!this.#selected && options.defaultDate) {
        this.#active = this.#startDay();
      }
      this.#draw();
    }

    return this.#options;
  }

  show(): void {
    if (this.#visible) {
      return;
    }
    this.#visible = true;
    this.element.hidden = false;
    this.#draw();
    this.#options.onOpen?.();
  }

  hide(): void {
    if (!this.#visible) {
      return;
    }
    this.#visible = false;
    this.element.hidden = true;
    this.#options.onClose?.();
  }

  isVisible(): boolean {
    return this.#visible;
  }

  /**
   * Selects the day of `date` (or nothing for `null`) and shows its month. Calls `onSelect` unless `silent`.
   */
  setDate(date: Date | null, silent = false): void {
    this.#selected = date ? startOfDay(date) : null;

    if (this.#selected) {
      this.#active = this.#selected;
    }
    this.#draw();

    if (this.#selected && !silent) {
      this.#options.onSelect?.(new Date(this.#selected));
    }
  }

  getDate(): Date | null {
    return this.#selected ? new Date(this.#selected) : null;
  }

  gotoDate(date: Date): void {
    this.#active = startOfDay(date);
    this.#draw();
  }

  gotoToday(): void {
    this.gotoDate(new Date());
  }

  /**
   * Moves keyboard focus to the active day.
   */
  focus(): void {
    this.element.querySelector<HTMLElement>('.fg-datepicker-day[tabindex="0"]')?.focus();
  }

  destroy(): void {
    this.element.removeEventListener('mousedown', this.#onMouseDown);
    this.element.removeEventListener('change', this.#onChange);
    this.element.removeEventListener('keydown', this.#onKeyDown);
    this.element.remove();
  }

  #startDay(): Date {
    const { defaultDate } = this.#options;
    const date = defaultDate instanceof Date ? defaultDate : new Date(defaultDate ?? NaN);

    return startOfDay(Number.isNaN(date.getTime()) ? new Date() : date);
  }

  #names(): Required<DatePickerI18n> {
    return { ...englishNames(), ...this.#options.i18n } as Required<DatePickerI18n>;
  }

  #isDisabled(date: Date): boolean {
    const { minDate, maxDate, disableDayFn, disableWeekends } = this.#options;

    return (minDate instanceof Date && date < startOfDay(minDate))
      || (maxDate instanceof Date && date > startOfDay(maxDate))
      || (!!disableWeekends && (date.getDay() === 0 || date.getDay() === 6))
      || !!disableDayFn?.(new Date(date));
  }

  #years(): number[] {
    const { yearRange = 10 } = this.#options;
    const shown = this.#active.getFullYear();
    const [from, to] = Array.isArray(yearRange) ? yearRange : [shown - yearRange, shown + yearRange];
    const years = Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index);

    return years.includes(shown) ? years : [...years, shown].sort((a, b) => a - b);
  }

  #draw(): void {
    if (!this.#visible) {
      return;
    }
    const names = this.#names();
    const firstDay = Number(this.#options.firstDay ?? 0) % 7;
    const month = this.#active.getMonth();
    const today = new Date();
    const header = create('div', { class: 'fg-datepicker-header' }, [
      create('button', { type: 'button', class: 'fg-datepicker-prev', 'aria-label': names.previousMonth }, ['‹']),
      create('select', { class: 'fg-datepicker-month', 'aria-label': 'Month' }, names.months.map((name, index) => create(
        'option', { value: index, selected: index === month }, [name]))),
      create('select', { class: 'fg-datepicker-year', 'aria-label': 'Year' }, this.#years().map(year => create(
        'option', { value: year, selected: year === this.#active.getFullYear() }, [String(year)]))),
      create('button', { type: 'button', class: 'fg-datepicker-next', 'aria-label': names.nextMonth }, ['›']),
    ]);
    const weekdays = Array.from({ length: 7 }, (_, index) => (firstDay + index) % 7);
    const head = create('thead', {}, [create('tr', {}, weekdays.map(day => create(
      'th', { scope: 'col', abbr: names.weekdays[day] }, [names.weekdaysShort[day]])))]);
    const body = create('tbody', {}, monthGrid(this.#active.getFullYear(), month, firstDay).map(week => create(
      'tr', {}, week.map(date => create('td', { role: 'gridcell' }, [create('button', {
        type: 'button',
        class: `fg-datepicker-day${date.getMonth() === month ? '' : ' is-outside'}`,
        'data-date': toKey(date),
        tabindex: isSameDay(date, this.#active) ? 0 : -1,
        'aria-selected': String(isSameDay(date, this.#selected)),
        'aria-current': isSameDay(date, today) ? 'date' : undefined,
        'aria-label': `${names.weekdays[date.getDay()]}, ${names.months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`,
        disabled: this.#isDisabled(date),
      }, [String(date.getDate())])])))));

    this.element.replaceChildren(header, create('table', { class: 'fg-datepicker-table', role: 'grid' }, [head, body]));
    this.#options.onDraw?.();
  }

  #pick(date: Date): void {
    if (!this.#isDisabled(date)) {
      this.setDate(date);
    }
  }

  /**
   * Moves the active day, stepping over disabled days in the same direction; stays if there is none.
   */
  #move(days: number, months: number): void {
    const step = days < 0 || months < 0 ? -1 : 1;
    let date = addDays(addMonths(this.#active, months), days);

    for (let tries = 0; this.#isDisabled(date) && tries < 366; tries += 1) {
      date = addDays(date, step);
    }
    if (!this.#isDisabled(date)) {
      this.#active = date;
      this.#draw();
    }
    this.focus();
  }

  #onMouseDown = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;

    if (target.closest('select')) {
      return;
    }
    // Keep the focus where it is (the cell editor).
    event.preventDefault();
    const day = target.closest<HTMLButtonElement>('.fg-datepicker-day');

    if (day && !day.disabled) {
      const [year, month, date] = day.dataset.date!.split('-').map(Number);

      this.#pick(new Date(year, month - 1, date));
    } else if (target.closest('.fg-datepicker-prev')) {
      this.gotoDate(addMonths(this.#active, -1));
    } else if (target.closest('.fg-datepicker-next')) {
      this.gotoDate(addMonths(this.#active, 1));
    }
  };

  #onChange = (event: Event): void => {
    const select = event.target as HTMLSelectElement;
    const value = Number(select.value);

    if (select.classList.contains('fg-datepicker-month')) {
      this.gotoDate(addMonths(this.#active, value - this.#active.getMonth()));
    } else if (select.classList.contains('fg-datepicker-year')) {
      this.gotoDate(addMonths(this.#active, (value - this.#active.getFullYear()) * 12));
    }
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    if (!(event.target as HTMLElement).classList.contains('fg-datepicker-day')) {
      if (event.key === 'Escape') {
        this.hide();
      }

      return;
    }
    const firstDay = Number(this.#options.firstDay ?? 0) % 7;
    const weekStart = -((this.#active.getDay() - firstDay + 7) % 7);
    const [days, months] = MOVES[event.key] ?? [0, 0];

    if (event.key in MOVES) {
      this.#move(days, event.shiftKey && months ? months * 12 : months);
    } else if (event.key === 'Home') {
      this.#move(weekStart, 0);
    } else if (event.key === 'End') {
      this.#move(weekStart + 6, 0);
    } else if (event.key === 'Enter' || event.key === ' ') {
      this.#pick(this.#active);
    } else if (event.key === 'Escape') {
      this.hide();
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };
}
