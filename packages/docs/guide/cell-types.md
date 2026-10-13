# Cell types

A cell type bundles a renderer (how a value looks), an editor (how it is edited) and a validator (what is
allowed). Set it with `type`, usually per column:

```js
columns: [
  { type: 'text' },
  { type: 'numeric', numericFormat: { pattern: '0,0.00' } },
  { type: 'date', dateFormat: 'YYYY-MM-DD', correctFormat: true },
  { type: 'checkbox' },
  { type: 'dropdown', source: ['Yes', 'No'] },
]
```

| Type | Notes |
| --- | --- |
| `text` | The default. |
| `numeric` | Right-aligned. `numericFormat: { pattern, culture }` uses [numbro](https://numbrojs.com) patterns. |
| `date` | A date picker. `dateFormat` sets the format (see [Date and time formats](#date-and-time-formats)); `correctFormat: true` reformats valid input. |
| `time` | `timeFormat` sets the format (see [Date and time formats](#date-and-time-formats)). |
| `checkbox` | `checkedTemplate` and `uncheckedTemplate` set the stored values. |
| `dropdown` | A fixed list from `source`. |
| `autocomplete` | Suggestions from `source` (an array or a function). `strict: false` also allows other values. |
| `password` | Shows the value masked. |

## Validation

Invalid values get the `htInvalid` class. `allowInvalid: false` rejects them instead of keeping them.
Your own rule:

```js
{
  validator(value, callback) {
    callback(typeof value === 'string' && value.length <= 20);
  },
}
```

See it live in the [cell types example](../examples/cell-types).

## Date picker

A `date` cell opens a calendar under the cell. Pick a day with the mouse, or press <kbd>Alt</kbd>+<kbd>↓</kbd> to move
into the calendar: arrows move by day and week, <kbd>Page Up</kbd>/<kbd>Page Down</kbd> by month (with
<kbd>Shift</kbd> by year), <kbd>Home</kbd>/<kbd>End</kbd> to the start/end of the week, <kbd>Enter</kbd> picks the
day and <kbd>Esc</kbd> closes the calendar. While you type a date in the cell's format, the calendar follows it.

`datePickerConfig` sets the calendar:

```js
columns: [{
  type: 'date',
  dateFormat: 'YYYY-MM-DD',
  datePickerConfig: {
    firstDay: 1, // weeks start on Monday (0 = Sunday, the default)
    minDate: new Date(2026, 0, 1),
    maxDate: new Date(2026, 11, 31),
    disableWeekends: true,
    disableDayFn: date => date.getDate() === 13, // days that cannot be picked
    yearRange: [2020, 2030], // the year list: [from, to], or n years around the shown year (default 10)
    i18n: { previousMonth: 'Ankstesnis mėnuo', nextMonth: 'Kitas mėnuo', months: [/* 12 names */],
      weekdays: [/* 7 names, Sunday first */], weekdaysShort: [/* 7 short names */] },
    onSelect: () => {}, onOpen: () => {}, onClose: () => {}, onDraw: () => {},
  },
}]
```

`defaultDate` (a cell setting) is the date shown when the cell is empty. The calendar's colors come from the
`--fg-datepicker-*` [theme variables](./theming).

## Date and time formats

`dateFormat` (default `DD/MM/YYYY`) and `timeFormat` (default `h:mm:ss a`) use the same tokens as moment.js, so
formats written for moment keep working. FreeGrid reads and writes them itself; no date library is needed.

| Token | Meaning | Example |
| --- | --- | --- |
| `YYYY`, `YY` | Year | `2026`, `26` |
| `M`, `MM`, `MMM`, `MMMM` | Month | `1`, `01`, `Jan`, `January` |
| `D`, `DD`, `Do` | Day of the month | `2`, `02`, `2nd` |
| `d`, `dd`, `ddd`, `dddd` | Weekday | `5`, `Fr`, `Fri`, `Friday` |
| `H`, `HH` / `h`, `hh` / `k`, `kk` | Hour: 0–23 / 1–12 / 1–24 | `15`, `3`, `15` |
| `m`, `mm`, `s`, `ss` | Minutes, seconds | `4`, `04` |
| `S`, `SS`, `SSS` | Fractions of a second | `1`, `12`, `123` |
| `a`, `A` | am/pm | `pm`, `PM` |
| `Z`, `ZZ` | Time zone offset | `+02:00`, `+0200` |
| `X`, `x` | Unix time in seconds, milliseconds | `1767225600` |
| `Q` | Quarter | `1` |
| `L`, `LL`, `LLL`, `LLLL`, `LT`, `LTS` | Long formats | `01/02/2026`, `January 2, 2026`, `3:04 PM` |
| `[text]` | Text as it is | `[at] h a` → `at 3 pm` |

Names are in English. When validating, a value in exactly the format is valid; other readable values (`1:00 pm` for
`h:mm:ss a`) are invalid unless `correctFormat: true`, which rewrites them in the format.
