---
api: [Lifecycle]
---

# Getting started

## Install

::: code-group

```sh [npm]
npm install @freegrid/sheet
```

```sh [pnpm]
pnpm add @freegrid/sheet
```

```sh [yarn]
yarn add @freegrid/sheet
```

:::


## Your first grid

Add an element for the grid, import FreeSheet and its styles, and create an instance:

```html
<div id="grid"></div>
```

<<< @/examples/getting-started.js

The result:

<LiveExample name="getting-started" />

## Without a bundler

Load the build from a `<script>` tag. It defines a global `FreeSheet` and needs no other library: FreeSheet formats
numbers and dates and shows its date picker itself.

```html
<link rel="stylesheet" href="@freegrid/sheet/dist/freesheet.min.css">
<script src="@freegrid/sheet/dist/freesheet.min.js"></script>

<div id="grid"></div>
<script>
  new FreeSheet(document.getElementById('grid'), {
    data: [['A1', 'B1'], ['A2', 'B2']],
    rowHeaders: true,
    colHeaders: true,
  });
</script>
```

`freesheet.full.min.js` and `freesheet.full.min.css` still exist for pages that load them; they are now the same as
`freesheet.min.js` and `freesheet.min.css`.

## Sizing

Without `width` and `height`, the grid grows with its data. For large data, give the grid a fixed `height`
(in pixels), or give its container a height and `overflow: hidden`. Only the visible rows are then
rendered. `stretchH: 'all'` makes the columns fill the available width.

## Next steps

- [Configuration](./configuration) explains how settings work.
- [Examples](../examples/basics) show the main features in action.
