/**
 * Date math for the date picker. Dates are local days (time 00:00).
 */

export const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const isSameDay = (a: Date | null | undefined, b: Date | null | undefined): boolean => !!a && !!b
  && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const addDays = (date: Date, days: number): Date => new Date(date.getFullYear(), date.getMonth(),
  date.getDate() + days);

/**
 * Adds months, keeping the day unless the target month is shorter (31 January + 1 month = 28/29 February).
 */
export const addMonths = (date: Date, months: number): Date => {
  const first = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();

  return new Date(first.getFullYear(), first.getMonth(), Math.min(date.getDate(), lastDay));
};

/**
 * The days shown for a month: 6 weeks of 7 days, the first week starting on `firstDay` (0 = Sunday) and containing
 * the 1st.
 */
export const monthGrid = (year: number, month: number, firstDay: number): Date[][] => {
  const first = new Date(year, month, 1);
  const start = addDays(first, -((first.getDay() - firstDay + 7) % 7));

  return Array.from({ length: 6 }, (_, week) => Array.from({ length: 7 }, (__, day) => addDays(start, (week * 7) + day)));
};

/**
 * `YYYY-MM-DD` of a local day.
 */
export const toKey = (date: Date): string => [date.getFullYear(), date.getMonth() + 1, date.getDate()]
  .map((part, index) => String(part).padStart(index ? 2 : 4, '0'))
  .join('-');
