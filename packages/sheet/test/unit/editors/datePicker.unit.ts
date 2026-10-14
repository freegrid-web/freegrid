import { addMonths, monthGrid } from '../../../src/editors/datePicker/calendar';
import { DatePicker } from '../../../src/editors/datePicker/datePicker';

const ymd = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

describe('calendar', () => {
  it('lays a month out in 6 weeks starting on firstDay', () => {
    for (let firstDay = 0; firstDay < 7; firstDay += 1) {
      const weeks = monthGrid(2026, 9, firstDay); // October 2026 starts on a Thursday

      expect(weeks).toHaveLength(6);
      weeks.forEach(week => expect(week).toHaveLength(7));
      expect(weeks[0][0].getDay()).toBe(firstDay);
      expect(weeks.flat().some(day => ymd(day) === '2026-10-01')).toBe(true);
      expect(weeks.flat().some(day => ymd(day) === '2026-10-31')).toBe(true);
      expect(weeks[0].some(day => ymd(day) === '2026-10-01')).toBe(true);
    }
  });

  it('adds months without spilling into the next month', () => {
    expect(ymd(addMonths(new Date(2026, 0, 31), 1))).toBe('2026-02-28');
    expect(ymd(addMonths(new Date(2024, 0, 31), 1))).toBe('2024-02-29');
    expect(ymd(addMonths(new Date(2026, 2, 31), -1))).toBe('2026-02-28');
    expect(ymd(addMonths(new Date(2026, 11, 15), 1))).toBe('2027-01-15');
  });
});

describe('DatePicker', () => {
  let container: HTMLElement;
  let picker: DatePicker;

  const day = (date: string) => picker.element.querySelector<HTMLButtonElement>(`.fs-datepicker-day[data-date="${date}"]`)!;
  const selected = () => picker.element.querySelector<HTMLButtonElement>('.fs-datepicker-day[aria-selected="true"]');
  const select = (name: string) => picker.element.querySelector<HTMLSelectElement>(`.fs-datepicker-${name}`)!;
  const mousedown = (element: Element) => element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  const key = (key: string, init: KeyboardEventInit = {}) => {
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 13, 12));
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    picker?.destroy();
    container.remove();
    vi.useRealTimers();
  });

  it('shows the month of the selected date, today and the selection', () => {
    picker = new DatePicker(container);
    picker.setDate(new Date(2026, 9, 20), true);
    picker.show();

    expect(picker.isVisible()).toBe(true);
    expect(container.contains(picker.element)).toBe(true);
    expect(picker.element.getAttribute('role')).toBe('dialog');
    expect(select('month').value).toBe('9');
    expect(select('year').value).toBe('2026');
    expect(selected()!.dataset.date).toBe('2026-10-20');
    expect(day('2026-10-13').getAttribute('aria-current')).toBe('date');
    expect(day('2026-09-28').classList.contains('is-outside')).toBe(true);
  });

  it('names weekdays and months in English, starting on firstDay', () => {
    picker = new DatePicker(container, { firstDay: 1 });
    picker.show();

    const headers = [...picker.element.querySelectorAll('th')];

    expect(headers.map(th => th.textContent)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(headers[0].getAttribute('abbr')).toBe('Monday');
    expect(select('month').options[0].textContent).toBe('January');
  });

  it('uses i18n names when given', () => {
    picker = new DatePicker(container, {
      i18n: {
        previousMonth: 'Ankstesnis',
        nextMonth: 'Kitas',
        months: ['Sausis', 'Vasaris', 'Kovas', 'Balandis', 'Gegužė', 'Birželis', 'Liepa', 'Rugpjūtis', 'Rugsėjis',
          'Spalis', 'Lapkritis', 'Gruodis'],
        weekdays: ['Sekmadienis', 'Pirmadienis', 'Antradienis', 'Trečiadienis', 'Ketvirtadienis', 'Penktadienis',
          'Šeštadienis'],
        weekdaysShort: ['Sk', 'Pr', 'An', 'Tr', 'Kt', 'Pn', 'Št'],
      },
    });
    picker.show();

    expect(select('month').options[9].textContent).toBe('Spalis');
    expect(picker.element.querySelector('th')!.textContent).toBe('Sk');
    expect(picker.element.querySelector('.fs-datepicker-prev')!.getAttribute('aria-label')).toBe('Ankstesnis');
  });

  it('picks a day on mousedown without taking focus', () => {
    const onSelect = vi.fn();
    const input = document.createElement('input');

    container.appendChild(input);
    input.focus();
    picker = new DatePicker(container, { onSelect });
    picker.show();

    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });

    day('2026-10-02').dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(input);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(ymd(onSelect.mock.calls[0][0])).toBe('2026-10-02');
    expect(ymd(picker.getDate()!)).toBe('2026-10-02');
  });

  it('does not call onSelect for a silent setDate', () => {
    const onSelect = vi.fn();

    picker = new DatePicker(container, { onSelect });
    picker.setDate(new Date(2026, 0, 5), true);
    picker.setDate(null, true);

    expect(onSelect).not.toHaveBeenCalled();
    expect(picker.getDate()).toBeNull();
  });

  it('moves between months with the arrows and the selects', () => {
    picker = new DatePicker(container);
    picker.gotoDate(new Date(2026, 0, 31));
    picker.show();

    mousedown(picker.element.querySelector('.fs-datepicker-next')!);
    expect(select('month').value).toBe('1');
    mousedown(picker.element.querySelector('.fs-datepicker-prev')!);
    mousedown(picker.element.querySelector('.fs-datepicker-prev')!);
    expect(select('month').value).toBe('11');
    expect(select('year').value).toBe('2025');

    select('year').value = '2030';
    select('year').dispatchEvent(new Event('change', { bubbles: true }));
    select('month').value = '4';
    select('month').dispatchEvent(new Event('change', { bubbles: true }));

    expect(day('2030-05-01')).not.toBeNull();
  });

  it('lists yearRange years around the shown year, or a fixed range', () => {
    picker = new DatePicker(container, { yearRange: 2 });
    picker.gotoDate(new Date(2026, 0, 1));
    picker.show();
    expect([...select('year').options].map(option => option.value)).toEqual(['2024', '2025', '2026', '2027', '2028']);

    picker.config({ yearRange: [1999, 2001] });
    picker.gotoDate(new Date(2000, 0, 1));
    expect([...select('year').options].map(option => option.value)).toEqual(['1999', '2000', '2001']);
  });

  it('does not let disabled days be picked', () => {
    const onSelect = vi.fn();

    picker = new DatePicker(container, {
      minDate: new Date(2026, 9, 5),
      maxDate: new Date(2026, 9, 25),
      disableDayFn: date => date.getDate() === 15,
      disableWeekends: true,
      onSelect,
    });
    picker.show();

    ['2026-10-04', '2026-10-26', '2026-10-15', '2026-10-10'].forEach((date) => {
      expect(day(date).disabled, date).toBe(true);
      mousedown(day(date));
    });
    expect(day('2026-10-14').disabled).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('can be used from the keyboard', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    picker = new DatePicker(container, { onSelect, onClose });
    picker.setDate(new Date(2026, 9, 13), true);
    picker.show();
    picker.focus();

    expect(document.activeElement).toBe(day('2026-10-13'));
    key('ArrowRight');
    expect(document.activeElement).toBe(day('2026-10-14'));
    key('ArrowDown');
    expect(document.activeElement).toBe(day('2026-10-21'));
    key('PageDown');
    expect((document.activeElement as HTMLElement).dataset.date).toBe('2026-11-21');
    key('PageUp', { shiftKey: true });
    expect((document.activeElement as HTMLElement).dataset.date).toBe('2025-11-21');
    key('Home');
    expect((document.activeElement as HTMLElement).dataset.date).toBe('2025-11-16');
    key('End');
    expect((document.activeElement as HTMLElement).dataset.date).toBe('2025-11-22');
    key('Enter');
    expect(ymd(onSelect.mock.calls[0][0])).toBe('2025-11-22');

    picker.focus();
    key('Escape');
    expect(onClose).toHaveBeenCalled();
  });

  it('skips disabled days with the keyboard', () => {
    picker = new DatePicker(container, { maxDate: new Date(2026, 9, 14) });
    picker.setDate(new Date(2026, 9, 14), true);
    picker.show();
    picker.focus();

    key('ArrowRight');
    expect(document.activeElement).toBe(day('2026-10-14'));
  });

  it('calls onOpen, onClose and onDraw', () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    const onDraw = vi.fn();

    picker = new DatePicker(container, { onOpen, onClose, onDraw });
    picker.show();
    picker.hide();

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDraw).toHaveBeenCalled();
    expect(picker.isVisible()).toBe(false);
  });

  it('merges options with config() and returns them', () => {
    picker = new DatePicker(container, { firstDay: 1 });

    expect(picker.config({ yearRange: 5 })).toEqual(expect.objectContaining({ firstDay: 1, yearRange: 5 }));
  });

  it('starts on defaultDate when nothing is selected', () => {
    picker = new DatePicker(container, { defaultDate: new Date(2001, 1, 3) });
    picker.show();

    expect(select('year').value).toBe('2001');
    expect(selected()).toBeNull();
  });

  it('removes its element on destroy', () => {
    picker = new DatePicker(container);
    picker.show();
    picker.destroy();

    expect(container.querySelector('.fs-datepicker')).toBeNull();
  });
});
