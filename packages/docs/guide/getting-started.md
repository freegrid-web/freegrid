# Getting started

## Install

::: code-group

```sh [npm]
npm install @freegrid/core
```

```sh [pnpm]
pnpm add @freegrid/core
```

```sh [yarn]
yarn add @freegrid/core
```

:::


## Your first grid

Add an element for the grid, import FreeGrid and its styles, and create an instance:

```html
<div id="grid"></div>
```

<<< @/examples/getting-started.js

The result:

<LiveExample name="getting-started" />

## Without a bundler

Load the "full" build, which already includes its dependency (numbro), from a
`<script>` tag. It defines a global `FreeGrid`:

```html
<link rel="stylesheet" href="@freegrid/core/dist/freegrid.full.min.css">
<script src="@freegrid/core/dist/freegrid.full.min.js"></script>

<div id="grid"></div>
<script>
  new FreeGrid(document.getElementById('grid'), {
    data: [['A1', 'B1'], ['A2', 'B2']],
    rowHeaders: true,
    colHeaders: true,
  });
</script>
```

If your page already loads numbro, use `freegrid.min.js` and `freegrid.min.css` instead; they expect `numbro` as a
global. FreeGrid reads and writes dates and shows its date picker itself, without other libraries.

## Sizing

Without `width` and `height`, the grid grows with its data. For large data, give the grid a fixed `height`
(in pixels), or give its container a height and `overflow: hidden`. Only the visible rows are then
rendered. `stretchH: 'all'` makes the columns fill the available width.

## Next steps

- [Configuration](./configuration) explains how settings work.
- [Examples](../examples/basics) show the main features in action.
