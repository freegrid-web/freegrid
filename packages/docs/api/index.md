---
outline: [2, 2]
---

<script setup>
import { data } from './related.data.mjs';

const count = (topic, kind) => data.entries.filter(entry => entry.topic === topic && entry.kind === kind).length;
const slug = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
</script>

# API reference

The reference is generated from FreeGrid's source code, so it lists everything:

- [Methods](./methods): every method of a grid.
- [Events](./events): every event (hook) with its arguments.
- [Settings](./settings): every setting with its type and default.
- [Plugins](./plugins): the built-in plugins and their methods.

Guide pages list the methods, events and settings of their topic in the right-hand column ("Related API"). On narrow
screens, the list is at the end of the page.

## Constructor

```js
import FreeGrid from '@freegrid/sheet';
import '@freegrid/sheet/dist/freegrid.css';

const grid = new FreeGrid(element, settings);
```

| Argument | Type | Description |
| --- | --- | --- |
| `element` | `HTMLElement` | The container. The grid fills it; give it a size, or set `width` and `height`. |
| `settings` | `Object` | Optional. Any [settings](./settings), and any [event](./events) as a callback (`afterChange(changes, source) { … }`). |

The new grid is returned. Change settings later with [`grid.updateSettings(settings)`](./methods#updatesettings),
and remove the grid with [`grid.destroy()`](./methods#destroy).

## Topics

<table>
  <thead><tr><th>Topic</th><th>Methods</th><th>Events</th><th>Settings</th></tr></thead>
  <tbody>
    <tr v-for="topic in data.topics.filter(name => data.entries.some(entry => entry.topic === name))" :key="topic">
      <td>{{ topic }}</td>
      <td><a v-if="count(topic, 'method')" :href="`./methods#topic-${slug(topic)}`">{{ count(topic, 'method') }}</a></td>
      <td><a v-if="count(topic, 'event')" :href="`./events#topic-${slug(topic)}`">{{ count(topic, 'event') }}</a></td>
      <td><a v-if="count(topic, 'setting')" :href="`./settings#topic-${slug(topic)}`">{{ count(topic, 'setting') }}</a></td>
    </tr>
  </tbody>
</table>

## Static members

| Member | Description |
| --- | --- |
| `FreeGrid.version`, `FreeGrid.buildDate` | Build information |
| `FreeGrid.languages` | `registerLanguageDictionary`, `getLanguageDictionary`, `dictionaryKeys` |
| `FreeGrid.cellTypes`, `FreeGrid.editors`, `FreeGrid.renderers`, `FreeGrid.validators` | Built-ins and `register…` functions for your own |
| `FreeGrid.hooks` | Global hooks: `FreeGrid.hooks.add(name, callback)` |
| `FreeGrid.helper`, `FreeGrid.dom` | Utility functions, e.g. `FreeGrid.helper.createSpreadsheetData(rows, cols)` |
