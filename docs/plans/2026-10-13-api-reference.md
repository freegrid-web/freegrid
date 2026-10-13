# API reference — Design and Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal (user, 2026-10-13, required before 0.2.0):** a complete reference, so a reader never has to hunt:

- every method (parameters, return value, example);
- every event (when it fires, arguments);
- every setting (type, default, meaning);
- the constructor's arguments.

Guide pages such as "Data and events" or "Configuration" list **all** related methods, events and settings in the
right-hand column, with links into the reference.

## Design

**One source:** the JSDoc already in the code (MIT, ours), read at docs build time by a VitePress data loader.
Nothing is copied by hand, so the lists stay complete:

| Source | Entries |
| --- | --- |
| `src/core.js` | `@memberof Core#` methods (non-`@private`) |
| `src/pluginHooks.js` | `@event Hooks#name` events |
| `src/defaultSettings.js` | settings: the block before `name: default,` |
| `src/plugins/*/*.js` | each plugin's public methods (`@memberof PluginName#`) |

**Parser:** `packages/docs/api/jsdoc.mjs` reads every `/** … */` block and returns:

- the description;
- `@param` (type, name, optional, default, description);
- `@returns`, `@example`, `@deprecated`, `@since`, `@type`, `@default`, `@private`.

`{@link Core#name}`, `{@link Hooks#name}` and `{@link Options#name}` become links into the reference. Links to
upstream sites are dropped.

**Topics:** `packages/docs/api/topics.mjs` maps every entry to one topic:

| Topic | Examples |
| --- | --- |
| Data | `getData`, `setDataAtCell`, `afterChange`, `data` … |
| Selection | |
| Editing and validation | |
| Rows and columns | `alter`, sizes, headers … |
| Cell meta and types | |
| Rendering and scrolling | |
| Lifecycle | `updateSettings`, `destroy`, `afterInit` … |
| Hooks API | `addHook` … |
| Localization | |
| Plugins | |

Each topic has explicit name lists plus name patterns (e.g. `/Row|Col/`). An entry that matches no topic goes to
"Other", and the build prints a warning, so new entries are noticed.

**Pages:**

| Page | Content |
| --- | --- |
| `api/index.md` | Constructor; links to the pages below. |
| `api/methods.md` | All methods by topic: signature, description, parameters table, returns, example. |
| `api/events.md` | All events by topic: when, arguments table, example. |
| `api/settings.md` | All settings by topic: type, default, description, example. |
| `api/plugins.md` | Each plugin: its setting, its methods. |

Each entry has an anchor (`#getdata`). The sidebar lists the pages, and the page outline lists the topics.

**Related API in guides:** frontmatter `api: [Data, Selection]` on a guide page. A component in the right-hand
column (aside slot, above "On this page") lists every method, event and setting of those topics, linked into the
reference. On narrow screens it shows at the end of the page.

## Global Constraints

- Clean-room for anything after Handsontable 6.2.2: descriptions come from our own code's JSDoc. Upstream wording
  that names Handsontable or its sites is replaced at build time (FreeGrid) or dropped (links).
- `@private` entries are not listed.
- The docs build fails if the parser finds no methods, events or settings (a broken source path must not ship an
  empty reference).
- No `Co-Authored-By`. One PR.

## Review Focus

1. Every public method, event and setting appears exactly once, with a working anchor.
2. Optional parameters and defaults (`[amount=1]`) are shown correctly.
3. `{@link …}` targets resolve; there are no dead anchors.
4. The Related column lists the right topic's entries and fits narrow screens.
5. Examples render as code and are not escaped twice.

## Tasks

- [ ] Parser with unit tests (Vitest in the docs package or `tools/`): descriptions, params with types, optional and
  defaults, returns, examples, links, private.
- [ ] Data loader with topics; reference pages; anchors; sidebar.
- [ ] Related API aside component; frontmatter on guide pages.
- [ ] Review the generated text for upstream wording; fix it in the JSDoc (it is ours) where it is wrong or unclear.
- [ ] Docs build, link check (all anchors resolve), screenshots at desktop and phone width; CHANGELOG; PR.
