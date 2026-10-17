# Fill and paste

## Fill handle

Drag the small square at the corner of the selection to fill the cells next to it. As in a spreadsheet, each column
(or row, when you drag sideways) goes on as a series when its values are one:

| Selected | Filled |
| --- | --- |
| `1`, `3` | `5`, `7`, `9` |
| `Item 1` | `Item 2`, `Item 3` |
| `Q1`, `Q3` | `Q5`, `Q7` |
| `Jan` | `Feb`, `Mar` (month and weekday names, short or long, in their case) |
| `2026-01-30` | `2026-01-31`, `2026-02-01` (one date: day by day) |
| `2026-01-15`, `2026-02-15` | `2026-03-15` (the same day of the month: month by month) |

- A single number is repeated, as is text that is no series.
- A column with an empty cell among the selected ones repeats too.
- Dragging up or left fills the values before the series.
- Date cells (`type: 'date'`) go on in their `dateFormat`.
- Formulas are copied with their references moved.
- A fill is one undo step.

`fillHandle: false` turns the handle off; `fillHandle: 'vertical'` allows only up and down.

## Copy and paste with formatting

Copy and paste keep the cells' formatting:

- **Copying** from FreeSheet puts bold, italic, underline, strikethrough, text and fill colors, and the horizontal
  alignment on the clipboard. Pasted into Excel or Google Sheets, the cells keep their formatting.
- **Pasting** a table from Excel, Google Sheets, a web page or FreeSheet gives the cells the pasted formatting, as in
  Excel. Text without formatting, such as plain text or a table with no styles, leaves the cells' own formatting.
- Undo takes back the values and their formatting in one step.

Turn it off to paste values only:

```js
copyPaste: { formats: false }
```
