<script setup>
import { data } from './theming.data.mjs';
</script>

# Theming

Every color of FreeSheet, its font and its shadows come from CSS variables (`--fg-*`). Override a few of them to match
your site, or switch to the built-in dark theme.

## Change the colors

Set base variables anywhere: on `:root` for the whole page, or on an element around the grid.

```css
:root {
  --fg-color-accent: #0a7d55;
  --fg-color-header-background: #eef6f2;
  --fg-font-family: Inter, sans-serif;
  --fg-font-size: 13px;
}
```

Base variables restyle everything that uses them: `--fg-color-accent`, for example, colors the selection border.
For finer control, every part has its own component variable (see the tables below). Setting component variables on
the grid itself always works:

```css
.freegrid {
  --fg-header-highlight-background: #d7ebe2;
  --fg-menu-hover-background: #eef6f2;
}
```

The grid takes the text color and the font from the page unless you set `--fg-color-text`, `--fg-font-family` and
`--fg-font-size`.

::: tip Menus and popups
The context menu, the comment editor and the date picker are added to `<body>`, outside the grid. They get the grid's
theme automatically, but variables set on an element around the grid do not reach them. Set your variables on
`:root` (or on a theme class) so that they apply to the popups too.
:::

## Dark theme

Add the class `fg-theme-dark` (or the attribute `data-fg-theme="dark"`) to the grid's container or any element around
it, such as `<html>` or `<body>`:

```html
<div class="fg-theme-dark">
  <div id="grid"></div>
</div>
```

`fg-theme-auto` (or `data-fg-theme="auto"`) follows the system setting: dark when the operating system or the
browser uses dark mode, light otherwise. Without a theme class the grid is light.

`fg-theme-light` (or `data-fg-theme="light"`) keeps a grid light inside a dark page: the closest theme to the grid
wins.

## Styles

Two looks, independent of the color theme:

- **Classic** (the default): compact 23px rows and the colors of Handsontable 6; the grid uses the page's font and
  text color.
- **Modern**: roomier 32px rows and 8px cell padding, a rounded editor and context menu with a soft shadow, a round
  fill handle, and its own light palette (light grid lines, soft text, light headers, a blue accent) and font
  (14px Roboto or the system's sans-serif). Add `fg-style-modern` (or `data-fg-style="modern"`) to the grid or any
  element around it, together with any theme:

```html
<div class="fg-style-modern fg-theme-dark">
  <div id="grid"></div>
</div>
```

The examples on this site use Modern; switch them with **Grid** in the top bar.

Modern's colors and font are defaults, not overrides: a base variable you set (`--fg-color-border`, `--fg-font-family`,
…) wins in Modern too, and the dark theme gives Modern its dark colors. The "Modern" column in [Variables](#variables)
lists what Modern changes. To show a Classic grid inside a Modern page, add `fg-style-classic` (or
`data-fg-style="classic"`) around it: the closest style wins.

Sizes are variables too (`--fg-row-height`, `--fg-cell-padding-x`, `--fg-radius`, `--fg-header-font-weight`,
`--fg-fill-handle-radius`), so you can make your own density, e.g. `.freegrid { --fg-row-height: 28px; }`. FreeSheet
reads `--fg-row-height` when the grid is created; after changing it later, call `updateSettings({})`. Modern's wider
padding needs a little more column width: with fixed `colWidths`, add about 8px per column so that text does not wrap.

## Playground

Switch the theme and change the base variables; the CSS to copy appears below the grid. Right-click a cell for the
context menu, double-click a date to open the date picker.

<ThemePlayground :variables="data.base" />

## Variables

The values are read from FreeSheet's `variables.css`. "Light" is the default (Classic) value; "Modern" is shown where
the Modern style differs; "(page)" means the grid inherits the value from the page; an empty dark value means the
variable keeps its light value or follows a base variable.

### Base

<table class="theming-variables">
  <thead><tr><th>Variable</th><th>What it styles</th><th>Light</th><th>Modern</th><th>Dark</th></tr></thead>
  <tbody>
    <tr v-for="row in data.base" :key="row.name">
      <td><code>{{ row.name }}</code></td><td>{{ row.description }}</td><td><code>{{ row.light }}</code></td>
      <td><code v-if="row.modern">{{ row.modern }}</code></td><td><code v-if="row.dark">{{ row.dark }}</code></td>
    </tr>
  </tbody>
</table>

<template v-for="group in data.groups" :key="group.name">
  <h3>{{ group.name }}</h3>
  <table class="theming-variables">
    <thead><tr><th>Variable</th><th>What it styles</th><th>Light</th><th>Modern</th><th>Dark</th></tr></thead>
    <tbody>
      <tr v-for="row in group.rows" :key="row.name">
        <td><code>{{ row.name }}</code></td><td>{{ row.description }}</td><td><code>{{ row.light }}</code></td>
        <td><code v-if="row.modern">{{ row.modern }}</code></td><td><code v-if="row.dark">{{ row.dark }}</code></td>
      </tr>
    </tbody>
  </table>
</template>
