# FreeGrid's own date picker — Design and Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** the `date` editor shows FreeGrid's own calendar instead of Pikaday: themed by `--fg-*` variables, keyboard
and screen-reader friendly, no dependency. Agreed 2026-10-13: an internal module of the date editor (not a plugin,
not a package), behind a small interface so it could be swapped.

**Builds on:** `src/helpers/dateFormat.ts` (PR "dates without moment").

## Design

**Files** (`src/editors/datePicker/`):

- `calendar.ts` — pure date math: `startOfDay`, `isSameDay`, `addMonths` (clamped to the month's last day),
  `monthGrid(year, month, firstDay)` → 6 weeks × 7 days (`Date[][]`), `clampDate(date, min, max)`.
- `datePicker.ts` — `class DatePicker`: renders into a container, owns its DOM and listeners.
- `datePicker.css` — styles, only through `--fg-datepicker-*` variables.

**Interface** (what `DateEditor` uses; another picker can implement the same):

```ts
interface DatePickerOptions {
  firstDay?: number;                 // 0 = Sunday (default), 1 = Monday …
  minDate?: Date; maxDate?: Date;
  disableDayFn?: (date: Date) => boolean;
  disableWeekends?: boolean;
  yearRange?: number | [number, number]; // years in the year list: ±n around the shown year (default 10) or [from, to]
  defaultDate?: Date | string;
  i18n?: { previousMonth?: string; nextMonth?: string; months?: string[]; weekdays?: string[]; weekdaysShort?: string[] };
  onSelect?: (date: Date) => void; onOpen?: () => void; onClose?: () => void; onDraw?: () => void;
}
class DatePicker {
  constructor(container: HTMLElement, options?: DatePickerOptions);
  readonly element: HTMLElement;
  config(options?: DatePickerOptions): DatePickerOptions; // merge and return
  show(): void; hide(): void; isVisible(): boolean;
  setDate(date: Date | null, silent?: boolean): void; getDate(): Date | null;
  gotoDate(date: Date): void; gotoToday(): void;
  focus(): void;   // moves keyboard focus to the shown day
  destroy(): void;
}
```

These are the `datePickerConfig` options FreeGrid supports (Pikaday's names, so existing configs keep working);
other Pikaday options are ignored. `field`, `trigger`, `container`, `bound` are FreeGrid's, as before.

**DOM:** `div.fg-datepicker[role=dialog][aria-label]` › header (`button.fg-datepicker-prev`,
`select.fg-datepicker-month`, `select.fg-datepicker-year`, `button.fg-datepicker-next`) › `table.fg-datepicker-table`
(`role=grid`; `th[abbr]` weekday names; `td` › `button.fg-datepicker-day` with `data-date="YYYY-MM-DD"`,
`aria-selected`, `aria-current="date"` for today, `disabled` for disabled days, class `is-outside` for other months'
days).

**Keyboard:** typing stays in the cell editor. Alt+Down (or clicking a day with Tab focus) moves focus into the
calendar; there arrows move by day/week, PageUp/PageDown by month (Shift: year), Home/End to the week's start/end,
Enter/Space pick the day, Esc goes back to the editor. Mouse: `mousedown` on a day picks it (as before, so the
editor keeps focus).

**Names:** `i18n` if given, otherwise English (`Intl.DateTimeFormat('en-US')`), matching FreeGrid's English date
formats.

**Theme variables:** the Pikaday-only variables go (`--fg-datepicker-border-bottom-color`,
`--fg-datepicker-selected-shadow-color`, `--fg-datepicker-inrange-background`, `--fg-datepicker-startrange-background`,
`--fg-datepicker-arrow-filter`); added: `--fg-datepicker-radius`, `--fg-datepicker-focus-color`. They were added after
0.1.0, so no release had them.

**Removed:** the `pikaday` dependency, `pikaday-theme.css`, the build's Pikaday CSS handling, Pikaday in the full CSS
and on the test page. The plain UMD build then needs only numbro.

## Global Constraints

- Every existing spec stays green in Chromium (baseline), Firefox and WebKit (known failures). The date editor specs
  keep their names; their Pikaday selectors become FreeGrid's.
- No `Co-Authored-By`. Check the build's exit code. One PR.

## Review Focus

1. Focus: typing in the editor while the calendar is open; mousedown on a day must not blur the editor.
2. `minDate`/`maxDate`/`disableDayFn`: disabled days cannot be picked by mouse or keyboard.
3. Month change near month ends (31 Jan + 1 month) and `firstDay` 1–6 grids.
4. Theme: dark theme and Modern style on the `body`-level holder (`applyTheme`).
5. Destroy: no calendar DOM or listeners left after the grid is destroyed.

## Task 1: calendar math + picker (unit)

- [ ] Unit specs (`test/unit/editors/datePicker.unit.ts`): grid for every `firstDay`, `addMonths` clamping, rendering,
  selection, disabled days, header selects, keyboard, `onSelect`/`onOpen`/`onClose`, `destroy`. Watch them fail.
- [ ] Implement `calendar.ts`, `datePicker.ts`, `datePicker.css`. Specs pass.

## Task 2: use it in the date editor; drop Pikaday

- [ ] Date editor specs: Pikaday selectors → FreeGrid's; new specs: Alt+Down focus, keyboard pick, disabled day,
  dark theme class on the holder. Watch the new ones fail.
- [ ] `DateEditor` uses `DatePicker`; remove Pikaday (dependency, CSS, build plugin, test page, dist tests).
- [ ] Unit + dist + E2E in three browsers; commit.

## Task 3: docs, CHANGELOG, verification, PR

- [ ] Cell types (`datePickerConfig` options), theming variables (generated), getting started (UMD needs only
  numbro), migration guide, CHANGELOG.
- [ ] Lint, typecheck, unit, types, build, dist, docs build, all browser runs; review; PR.
