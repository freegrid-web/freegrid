# TypeScript Phase 2a (Cleanup: IE and old-browser code) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Internet Explorer, legacy Edge, Shadow DOM v0 and polyfill-era code from `packages/freegrid`, with
the same behavior in every supported browser and every public removal listed in the CHANGELOG.

**Architecture:** First of the 2–3 Phase 2 PRs in the spec (2b: `EventManager` → `AbortController`; 2c: homegrown
DOM/array/object helpers → built-ins). Code stays JavaScript here; Phase 3 converts it. Each removed branch is dead in
the supported browsers (Chrome 80+, Firefox 74+, Safari 14+), so behavior there does not change. Public helpers that
disappear are pinned by dist and type tests, and a new unit test keeps IE-only APIs out of `src` for good.

**Tech Stack:** JavaScript (ES2020), Vite 7, Vitest 4, Jasmine E2E via Playwright, TypeScript 5.9 for `test:types`.

**Spec:** `docs/specs/2026-10-12-typescript-and-clean-code-design.md` (§2.4 "No dead code", §3 phase 2, §5 allowed
public API changes)

## Global Constraints

- Behavior in supported browsers stays the same. Unit, dist, types and E2E stay green in Chromium (against
  `docs/baseline/`), Firefox and WebKit (against `packages/freegrid/test/runner/known-failures.json`).
- Allowed public API changes (spec §5): removing `FreeGrid.helper.*` / `FreeGrid.dom.*` functions that only
  re-implement built-ins, and removing IE-specific behavior. Each one is listed in the CHANGELOG with a migration note.
- A test changes only when the behavior it checks was deliberately changed, and the PR says so (spec §2.7). Tests of
  removed functions are removed together with the functions.
- Code stays `.js` in this phase.
- Out of scope (later PRs): the Safari `-webkit-transform` branches (`setOverlayPosition`, `getCssTransform`,
  `resetCssTransform`) → 2c; `EventManager` bookkeeping → 2b; `core.js` `listen()` "IE" branch → Phase 6.
- Kept on purpose: `stopImmediatePropagation` sets `event.cancelBubble = true` (a standard alias for stopping
  bubbling, not an IE fallback); `stopPropagation`'s `typeof event.stopPropagation === 'function'` check (callers may
  pass plain objects).
- Package filter is `@freegrid/core`. Browser tests run locally only through `tools/in-playwright-docker.sh`.
- One PR to `main`. Conventional Commits. **No `Co-Authored-By` lines.** No file renames, so the PR can be
  squash-merged.

## Review Focus

1. **Overlays in Safari/WebKit and Firefox.** `setOverlayPosition` loses its IE8/9 branch. Expected: frozen
   rows/columns still follow scrolling. Covered by the existing overlay E2E specs in the WebKit and Firefox runs
   (Task 6).
2. **A browser that still has the `<caption>` height problem.** `hasCaptionProblem()` is runtime detection. If a
   supported browser still reported `true`, removing the branch would change `outerHeight`/`offset` for captioned
   tables. Expected: no supported browser has it. Pinned by `Dom.spec.js` "outerHeight … (with caption)" and "offset
   for table cell (table with caption)", which run in all three browsers (Task 6), plus a probe in Task 2, Step 1.
3. **Code that calls a removed helper.** Expected: removed names are really gone from every UMD and ESM build (not
   half-removed), and the remaining helpers still work. Pinned by the dist tests in Tasks 1 and 2.
4. **`requestAnimationFrame` timing in autoColumnSize/autoRowSize/Interval.** Every supported browser already used
   the native function through the wrapper. Expected: same batching. Covered by the existing unit (`Interval.spec`)
   and E2E (`AutoColumnSize`, `AutoRowSize`) specs.
5. **IE-only APIs creeping back in** (copied from upstream or old answers on the web). Expected: a unit test names
   the file and the API. Pinned in Task 3, Step 1.

---

## Task 0: Branch

- [ ] **Step 1: Create the branch from the latest `main`**

```bash
cd /home/mindaugas/Projects/excel
git fetch origin
git switch -c refactor/remove-legacy-browser-code origin/main
git add docs/plans/2026-10-12-ts-phase-2a-legacy-browser-code.md
git commit -m "docs: TypeScript phase 2a (legacy browser code) plan"
```

---

## Task 1: Browser detection without IE and legacy Edge

**Files:**
- Modify: `packages/freegrid/src/helpers/browser.js`
- Modify: `packages/freegrid/src/helpers/dom/element.js` (`setOverlayPosition`, imports)
- Modify: `packages/freegrid/test/unit/helpers/Browser.spec.js`
- Modify: `packages/freegrid/test/build/dist.test.js`

**Interfaces:**
- Produces: `helpers/browser.js` exports exactly `setBrowserMeta`, `isChrome`, `isMobileBrowser`, `isSafari`.
  Removed: `isEdge`, `isIE`, `isIE8`, `isIE9`, `isMSBrowser`.

- [ ] **Step 1: Failing dist test**

In `packages/freegrid/test/build/dist.test.js`, add inside `describe('dist outputs', …)`:

```js
  it('IE and legacy Edge detection is gone from FreeGrid.helper', () => {
    const { helper } = windowWith(read('freegrid.full.js')).FreeGrid;

    ['isIE', 'isIE8', 'isIE9', 'isEdge', 'isMSBrowser'].forEach(name => expect(helper[name], name).toBeUndefined());
    ['isChrome', 'isSafari', 'isMobileBrowser', 'setBrowserMeta'].forEach(name => expect(typeof helper[name], name).toBe('function'));
  });
```

Run: `pnpm --filter @freegrid/core build && pnpm --filter @freegrid/core test:dist`
Expected: FAIL, `isIE: expected [Function isIE] to be undefined`.

- [ ] **Step 2: Remove the detection**

`packages/freegrid/src/helpers/browser.js`, replace the `browsers` object and delete the five functions:

```js
const browsers = {
  chrome: tester((ua, vendor) => /Chrome/.test(ua) && /Google/.test(vendor)),
  mobile: tester(ua => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)),
  safari: tester((ua, vendor) => /Safari/.test(ua) && /Apple Computer/.test(vendor)),
};
```

Delete `export function isEdge() {…}`, `isIE`, `isIE8`, `isIE9` and `isMSBrowser` (each a 3-line function).
`isChrome`, `isMobileBrowser`, `isSafari` and `setBrowserMeta` stay unchanged. (`IEMobile` in the mobile regex stays:
it is a user-agent token, and the mobile tests cover it.)

`packages/freegrid/src/helpers/dom/element.js`: change the import on line 2 to

```js
import { isSafari } from '../browser';
```

and replace `setOverlayPosition` with:

```js
/**
 * Sets overlay position depending on it's type and used browser
 */
export function setOverlayPosition(overlayElem, left, top) {
  if (isSafari()) {
    overlayElem.style['-webkit-transform'] = 'translate3d(' + left + ',' + top + ',0)';
  } else {
    overlayElem.style.transform = 'translate3d(' + left + ',' + top + ',0)';
  }
}
```

- [ ] **Step 3: Remove the tests of the removed functions**

In `packages/freegrid/test/unit/helpers/Browser.spec.js`: drop `isEdge`, `isIE` and `isMSBrowser` from the import
list, and delete the whole `describe('isIE', …)`, `describe('isEdge', …)` and `describe('isMSBrowser', …)` blocks.
`isMobileBrowser`, `isSafari` and `isChrome` blocks stay unchanged.

- [ ] **Step 4: Green**

```bash
cd /home/mindaugas/Projects/excel
pnpm lint && pnpm typecheck && pnpm --filter @freegrid/core test:unit
pnpm --filter @freegrid/core build && pnpm --filter @freegrid/core test:dist
```
Expected: lint exit 0 (only the 2 existing warnings), unit `No regressions.`, all dist tests pass. (`typecheck` exists
once the Phase 1 PR is merged; if `main` does not have it yet, skip it.)

- [ ] **Step 5: Commit**

```bash
git add packages/freegrid/src/helpers/browser.js packages/freegrid/src/helpers/dom/element.js \
  packages/freegrid/test/unit/helpers/Browser.spec.js packages/freegrid/test/build/dist.test.js
git commit -m "refactor!: remove IE and legacy Edge browser detection"
```

---

## Task 2: Feature helpers without polyfills and dead detections

**Files:**
- Modify: `packages/freegrid/src/helpers/feature.js`
- Modify: `packages/freegrid/src/helpers/dom/element.js` (`offset`, `outerHeight`, imports)
- Modify: `packages/freegrid/src/eventManager.js` (web-component branch, import)
- Modify: `packages/freegrid/src/utils/interval.js`, `src/plugins/autoColumnSize/autoColumnSize.js`,
  `src/plugins/autoRowSize/autoRowSize.js` (imports only)
- Modify: `packages/freegrid/test/build/dist.test.js`

**Interfaces:**
- Produces: `helpers/feature.js` exports exactly `isTouchSupported`, `getComparisonFunction`. Removed:
  `requestAnimationFrame`, `cancelAnimationFrame`, `isWebComponentSupportedNatively`, `hasCaptionProblem`. Callers use
  the global `requestAnimationFrame` / `cancelAnimationFrame`.

- [ ] **Step 1: Probe `hasCaptionProblem()` in the three browsers**

Before deleting runtime detection, confirm it is `false` everywhere. Temporarily add to the top of
`packages/freegrid/test/e2e/Dom.spec.js`, inside `describe('Handsontable.Dom', () => {`:

```js
  it('PROBE hasCaptionProblem', () => {
    expect(Handsontable.helper.hasCaptionProblem()).toBe(false);
  });
```

```bash
cd /home/mindaugas/Projects/excel
for s in test:e2e test:e2e:firefox test:e2e:webkit; do
  tools/in-playwright-docker.sh pnpm --dir packages/freegrid $s 2>&1 | grep -E "PROBE|No regressions|No unexpected|UNEXPECTED|REGRESSIONS"
done
git checkout packages/freegrid/test/e2e/Dom.spec.js
```
Expected: no `PROBE` failure in any browser (Chromium `No regressions.`, Firefox/WebKit `No unexpected failures.`).
If a browser reports `true`: stop; keep `hasCaptionProblem` and its two branches, drop it from Steps 2–4, and note it
in the PR.

- [ ] **Step 2: Failing dist test**

In `packages/freegrid/test/build/dist.test.js`, add inside `describe('dist outputs', …)`:

```js
  it('polyfills and dead feature detections are gone from FreeGrid.helper', () => {
    const { helper } = windowWith(read('freegrid.full.js')).FreeGrid;

    ['requestAnimationFrame', 'cancelAnimationFrame', 'isWebComponentSupportedNatively', 'hasCaptionProblem']
      .forEach(name => expect(helper[name], name).toBeUndefined());
    ['isTouchSupported', 'getComparisonFunction'].forEach(name => expect(typeof helper[name], name).toBe('function'));
    expect(helper.getComparisonFunction()('a', 'b')).toBe(-1);
  });
```

Run: `pnpm --filter @freegrid/core build && pnpm --filter @freegrid/core test:dist`
Expected: FAIL, `requestAnimationFrame: expected [Function requestAnimationFrame] to be undefined`.

- [ ] **Step 3: Rewrite `feature.js`**

Replace the whole content of `packages/freegrid/src/helpers/feature.js`:

```js
export function isTouchSupported() {
  return ('ontouchstart' in window);
}

let comparisonFunction;

/**
 * Get string comparison function for sorting purposes. It supports multilingual string comparison base on Internationalization API.
 * The first call decides the language and options; later calls return the same function.
 *
 * @param {String} [language]
 * @param {Object} [options]
 * @returns {Function}
 */
export function getComparisonFunction(language, options = {}) {
  if (!comparisonFunction) {
    comparisonFunction = new Intl.Collator(language, options).compare;
  }

  return comparisonFunction;
}
```

(`Intl` exists in every supported browser and in Node, so the `localeCompare` and `>` fallbacks were dead. The
memoization, including its "first call wins" quirk, is unchanged.)

- [ ] **Step 4: Update the callers**

`packages/freegrid/src/utils/interval.js`: delete line 1
(`import { requestAnimationFrame, cancelAnimationFrame } from './../helpers/feature';`). The calls now use the
globals; nothing else changes.

`packages/freegrid/src/plugins/autoColumnSize/autoColumnSize.js` and
`packages/freegrid/src/plugins/autoRowSize/autoRowSize.js`: delete line 3
(`import { cancelAnimationFrame, requestAnimationFrame } from './../../helpers/feature';`).

`packages/freegrid/src/helpers/dom/element.js`:
- delete the line `import { hasCaptionProblem } from '../feature';`
- in `offset(elem)`, delete the whole `if (hasCaptionProblem() && elementToCheck.firstChild && …) { … }` block
  (the comment and the `getBoundingClientRect` early return). If `box` is then unused, delete its `let box;`
  declaration too.
- replace `outerHeight` with:

```js
/**
 * Returns the element's outer height
 *
 * @param elem
 * @returns {number} Element's outer height
 */
export function outerHeight(elem) {
  return elem.offsetHeight;
}
```

`packages/freegrid/src/eventManager.js`:
- delete line 3 (`import { isWebComponentSupportedNatively } from './helpers/feature';`)
- in the event-wrapping function, replace

```js
  if (isWebComponentSupportedNatively()) {
    event.realTarget = event.srcElement || event.toElement;

  } else if (hasOwnProperty(context, 'hot') || context.isHotTableEnv || context.wtTable) {
```

with

```js
  // Shadow DOM v0 (`createShadowRoot`) is gone from browsers, so the target is always resolved here.
  if (hasOwnProperty(context, 'hot') || context.isHotTableEnv || context.wtTable) {
```

- [ ] **Step 5: Green**

```bash
cd /home/mindaugas/Projects/excel
pnpm lint && pnpm --filter @freegrid/core test:unit
pnpm --filter @freegrid/core build && pnpm --filter @freegrid/core test:dist
grep -rnE "helpers/feature'" packages/freegrid/src | grep -vE "isTouchSupported|getComparisonFunction"
```
Expected: lint exit 0 (2 existing warnings; `no-undef` must not report `requestAnimationFrame`, it is a browser
global), unit `No regressions.`, dist all pass, and the last command prints nothing.

- [ ] **Step 6: Commit**

```bash
git add packages/freegrid/src packages/freegrid/test/build/dist.test.js
git commit -m "refactor!: drop requestAnimationFrame polyfill and dead feature detections"
```

---

## Task 3: Internal IE fallbacks, and a guard against IE-only APIs

**Files:**
- Create: `packages/freegrid/test/setup/legacy-apis.unit.js`
- Modify: `packages/freegrid/src/helpers/dom/element.js` (`fastInnerText`, `getComputedStyle`, `addEvent`,
  `removeEvent`, `getCaretPosition`, `getSelectionEndPosition`, `getSelectionText`)
- Modify: `packages/freegrid/src/eventManager.js` (`fireEvent`)
- Modify: `packages/freegrid/src/tableView.js` (`clearTextSelection`)
- Modify: `packages/freegrid/src/helpers/console.js`

**Interfaces:** none change. Every function keeps its name, parameters and result in supported browsers.

- [ ] **Step 1: Failing guard test**

`packages/freegrid/test/setup/legacy-apis.unit.js`:

```js
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// APIs that only Internet Explorer (or Shadow DOM v0) had. FreeGrid supports Chrome 80+, Firefox 74+ and Safari 14+,
// so code using them is dead. `cancelBubble` is not listed: it is also a standard alias for stopping propagation.
const IE_ONLY = [
  /\battachEvent\b/, /\bdetachEvent\b/, /\bcreateEventObject\b/, /\.currentStyle\b/, /\bdocument\.selection\b/,
  /\bcreateTextRange\b/, /\bdocumentMode\b/, /\bcreateShadowRoot\b/, /Trident/,
];

describe('source files', () => {
  it('do not use IE-only APIs', () => {
    const src = resolve(import.meta.dirname, '../../src');
    const files = readdirSync(src, { recursive: true }).map(String)
      .filter(f => /\.(js|ts)$/.test(f) && !/(^|[\\/])(test|dist)[\\/]/.test(f));
    const found = files.flatMap((file) => {
      const code = readFileSync(resolve(src, file), 'utf8');

      return IE_ONLY.filter(api => api.test(code)).map(api => `${file}: ${api.source}`);
    });

    expect(found).toEqual([]);
  });
});
```

Run: `pnpm --filter @freegrid/core exec vitest run test/setup/legacy-apis.unit.js`
Expected: FAIL. The list names `helpers/dom/element.js` (`.currentStyle`, `attachEvent`, `detachEvent`,
`document.selection`, `createTextRange`), `eventManager.js` (`createEventObject`) and `tableView.js`
(`document.selection`). Tasks 1–2 already removed `Trident`, `documentMode` and `createShadowRoot`; if those still
show up, Task 1 or 2 is incomplete.

- [ ] **Step 2: `element.js`**

`fastInnerText`: delete the `const textContextSupport = …;` line above it, and replace the fast-lane body so the
function reads:

```js
export function fastInnerText(element, content) {
  const child = element.firstChild;

  if (child && child.nodeType === 3 && child.nextSibling === null) {
    // fast lane - replace existing text node
    child.textContent = content;
  } else {
    // slow lane - empty element and insert a text node
    empty(element);
    element.appendChild(document.createTextNode(content));
  }
}
```

`getComputedStyle`:

```js
/**
 * Returns a computed style object for the provided element. (Needed if style is declared in external stylesheet).
 *
 * @param element
 * @returns {CSSStyleDeclaration} Elements computed style object
 */
export function getComputedStyle(element) {
  return document.defaultView.getComputedStyle(element);
}
```

`addEvent` / `removeEvent`:

```js
export function addEvent(element, event, callback) {
  element.addEventListener(event, callback, false);
}

export function removeEvent(element, event, callback) {
  element.removeEventListener(event, callback, false);
}
```

`getCaretPosition`, `getSelectionEndPosition`, `getSelectionText` (keep their JSDoc blocks):

```js
export function getCaretPosition(el) {
  if (el.selectionStart) {
    return el.selectionStart;
  }

  return 0;
}
```

```js
export function getSelectionEndPosition(el) {
  if (el.selectionEnd) {
    return el.selectionEnd;
  }

  return 0;
}
```

```js
export function getSelectionText() {
  return window.getSelection().toString();
}
```

(The `if (el.selectionStart)` shape is kept on purpose: `0` and `null` both return `0`, as before.)

- [ ] **Step 3: `eventManager.js` `fireEvent`**

Replace the part after the `options` object:

```js
    const event = document.createEvent('MouseEvents');

    event.initMouseEvent(eventName, options.bubbles, options.cancelable,
      options.view, options.detail,
      options.screenX, options.screenY, options.clientX, options.clientY,
      options.ctrlKey, options.altKey, options.shiftKey, options.metaKey,
      options.button, options.relatedTarget || document.body.parentNode);

    element.dispatchEvent(event);
  }
```

(and delete the now-unused `let event;`). Moving from `initMouseEvent` to `new MouseEvent()` is 2c's job, not this
PR's.

- [ ] **Step 4: `tableView.js` `clearTextSelection`**

```js
const clearTextSelection = function() {
  // http://stackoverflow.com/questions/3169786/clear-text-selection-with-javascript
  if (window.getSelection().empty) { // Chrome
    window.getSelection().empty();
  } else if (window.getSelection().removeAllRanges) { // Firefox
    window.getSelection().removeAllRanges();
  }
};
```

- [ ] **Step 5: `console.js`**

Replace the whole file content (keep the two eslint-disable lines at the top):

```js
/* eslint-disable no-console */
/* eslint-disable no-restricted-globals */

/**
 * Logs message to the console.
 *
 * @param {...*} args Values which will be logged.
 */
export function log(...args) {
  console.log(...args);
}

/**
 * Logs warn to the console.
 *
 * @param {...*} args Values which will be logged.
 */
export function warn(...args) {
  console.warn(...args);
}

/**
 * Logs info to the console.
 *
 * @param {...*} args Values which will be logged.
 */
export function info(...args) {
  console.info(...args);
}

/**
 * Logs error to the console.
 *
 * @param {...*} args Values which will be logged.
 */
export function error(...args) {
  console.error(...args);
}
```

Check first that `test/unit/helpers/Console.spec.js` does not test the "no console" case:
`grep -n "isDefined\|undefined" packages/freegrid/test/unit/helpers/Console.spec.js`. If it does, that test checks
IE-only behavior: remove it in this commit and say so in the PR.

- [ ] **Step 6: Green**

```bash
cd /home/mindaugas/Projects/excel
pnpm --filter @freegrid/core exec vitest run test/setup/legacy-apis.unit.js
pnpm lint && pnpm --filter @freegrid/core test:unit
```
Expected: the guard PASSes, lint exit 0 (2 existing warnings), unit `No regressions.`

- [ ] **Step 7: Commit**

```bash
git add packages/freegrid/src packages/freegrid/test
git commit -m "refactor: remove internal IE fallbacks and guard against IE-only APIs"
```

---

## Task 4: CSS without IE hacks

**Files:**
- Modify: `packages/freegrid/src/css/handsontable.css`
- Modify: `packages/freegrid/src/css/mobile.handsontable.css`
- Modify: `packages/freegrid/src/3rdparty/walkontable/css/walkontable.css`
- Modify: `packages/freegrid/test/build/dist.test.js`

- [ ] **Step 1: Failing dist test**

```js
  it('CSS has no IE hacks', () => {
    ['freegrid.css', 'freegrid.full.css'].forEach((file) => {
      const css = read(file);

      expect(css, file).not.toMatch(/-ms-/);
      expect(css, file).not.toMatch(/\\9\s*;/);
    });
  });
```

Run: `pnpm --filter @freegrid/core build && pnpm --filter @freegrid/core test:dist`
Expected: FAIL on `-ms-` in `freegrid.css`.

- [ ] **Step 2: Remove the hacks**

- `src/css/handsontable.css`: delete the line `bottom: -100%\9; /* Fix for IE9 … */`, the comment
  `/* Fix for IE10 and IE11 … */` and the whole `@media screen and (-ms-high-contrast: active), (-ms-high-contrast: none) { … }`
  block; delete the `-ms-user-select: none;` line.
- `src/css/mobile.handsontable.css`: delete `-ms-user-select:none;`.
- `src/3rdparty/walkontable/css/walkontable.css`: delete `-ms-user-select: none;`.

The unprefixed `user-select` (and the `-webkit-`/`-moz-` lines) next to them stay.

- [ ] **Step 3: Green and commit**

```bash
cd /home/mindaugas/Projects/excel
pnpm --filter @freegrid/core build && pnpm --filter @freegrid/core test:dist
git add packages/freegrid/src/css packages/freegrid/src/3rdparty/walkontable/css packages/freegrid/test/build/dist.test.js
git commit -m "style: remove IE-only CSS hacks"
```
Expected: all dist tests pass.

---

## Task 5: Public types and CHANGELOG

**Files:**
- Modify: `packages/freegrid/types/freegrid.d.ts` (the `helper` declarations around lines 1807–1864)
- Modify: `packages/freegrid/test/types/helpers/helpers.types.ts`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Failing type test**

In `packages/freegrid/test/types/helpers/helpers.types.ts`, delete the calls to the nine removed helpers
(`cancelAnimationFrame`, `hasCaptionProblem`, `isEdge`, `isIE`, `isIE8`, `isIE9`, `isMSBrowser`,
`isWebComponentSupportedNatively`, `requestAnimationFrame`) and add at the end of the file:

```ts
// Removed in 0.1 (IE and polyfill-era helpers, see CHANGELOG).
// @ts-expect-error
Handsontable.helper.isIE();
// @ts-expect-error
Handsontable.helper.isIE8();
// @ts-expect-error
Handsontable.helper.isIE9();
// @ts-expect-error
Handsontable.helper.isEdge();
// @ts-expect-error
Handsontable.helper.isMSBrowser();
// @ts-expect-error
Handsontable.helper.isWebComponentSupportedNatively();
// @ts-expect-error
Handsontable.helper.hasCaptionProblem();
// @ts-expect-error
Handsontable.helper.requestAnimationFrame(() => {});
// @ts-expect-error
Handsontable.helper.cancelAnimationFrame(1);
```

Run: `pnpm --filter @freegrid/core test:types`
Expected: FAIL with nine `error TS2578: Unused '@ts-expect-error' directive.`

- [ ] **Step 2: Remove the declarations**

In `packages/freegrid/types/freegrid.d.ts`, delete these lines inside the `helper` declaration:
`cancelAnimationFrame(id: number): void,`, `hasCaptionProblem(): boolean | void,`, `isEdge(): boolean,`,
`isIE(): boolean,`, `isIE8(): boolean,`, `isIE9(): boolean,`, `isMSBrowser(): boolean,`,
`isWebComponentSupportedNatively(): boolean,`, `requestAnimationFrame(callback: () => void): number,`.

Change `getComparisonFunction(language: string, options?: object): any | void,` to
`getComparisonFunction(language?: string, options?: Intl.CollatorOptions): (a: string, b: string) => number,`.

Run: `pnpm --filter @freegrid/core test:types`
Expected: PASS. (If `Intl.CollatorOptions` is unknown under `test/types/tsconfig.json`'s `lib`, use `object` and
note it in the ledger.)

- [ ] **Step 3: CHANGELOG**

Add at the end of the `## Unreleased (Stage 0)` list in `CHANGELOG.md`:

```markdown
- Removed IE and legacy-browser code. Removed helpers, with what to use instead:
  - `FreeGrid.helper.isIE`, `isIE8`, `isIE9`, `isEdge`, `isMSBrowser`: no replacement; IE and EdgeHTML are not
    supported.
  - `FreeGrid.helper.requestAnimationFrame`, `cancelAnimationFrame`: use `window.requestAnimationFrame` and
    `window.cancelAnimationFrame`.
  - `FreeGrid.helper.isWebComponentSupportedNatively` (Shadow DOM v0), `FreeGrid.helper.hasCaptionProblem`: no
    replacement; no supported browser needs them.
  - IE-only CSS (`-ms-` properties, IE9–11 selection-area fixes) removed from `freegrid.css`.
```

- [ ] **Step 4: Commit**

```bash
git add packages/freegrid/types/freegrid.d.ts packages/freegrid/test/types/helpers/helpers.types.ts CHANGELOG.md
git commit -m "docs: remove legacy helpers from public types, list removals in CHANGELOG"
```

---

## Task 6: Full verification and PR

- [ ] **Step 1: Checks job, locally**

```bash
cd /home/mindaugas/Projects/excel
pnpm install --frozen-lockfile && pnpm lint && pnpm --filter @freegrid/core test:unit \
  && pnpm --filter @freegrid/core test:types && pnpm --filter @freegrid/core build && pnpm --filter @freegrid/core test:dist
```
(add `pnpm typecheck` after `pnpm lint` once Phase 1 is on `main`)
Expected: all succeed; unit `No regressions.`

- [ ] **Step 2: Browser suites in Docker**

```bash
for s in build test:e2e test:e2e:min test:walkontable test:e2e:firefox test:e2e:webkit; do
  tools/in-playwright-docker.sh pnpm --dir packages/freegrid $s
done
```
Expected: Chromium runs end with `No regressions.`; Firefox and WebKit with `No unexpected failures.` In particular
the `Dom.spec.js` caption specs and the overlay/scroll specs pass in all three.

- [ ] **Step 3: Docs site**

`pnpm build && pnpm docs:build` → both succeed.

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin refactor/remove-legacy-browser-code
gh pr create --base main --title "refactor!: remove IE and legacy-browser code (phase 2a)" --body "$(cat <<'EOF'
Phase 2a of docs/specs/2026-10-12-typescript-and-clean-code-design.md: remove IE, legacy Edge, Shadow DOM v0 and polyfill-era code. Same behavior in Chrome 80+, Firefox 74+ and Safari 14+.

Public API (listed in CHANGELOG with replacements):
- Removed `FreeGrid.helper.isIE`, `isIE8`, `isIE9`, `isEdge`, `isMSBrowser`, `requestAnimationFrame`, `cancelAnimationFrame`, `isWebComponentSupportedNatively`, `hasCaptionProblem`.
- IE-only CSS removed.

Tests changed on purpose: the unit tests of `isIE`, `isEdge` and `isMSBrowser` are removed with those functions, and the type tests now assert the nine helpers are gone. New: dist tests for the removed/remaining helpers and CSS, and a unit test that keeps IE-only APIs out of `src`.

Kept on purpose: `stopImmediatePropagation`'s `cancelBubble` (a standard alias), `stopPropagation`'s duck-typing check, the Safari `-webkit-transform` branches (phase 2c) and `core.js`'s `listen()` fallback (phase 6).

Verified locally: lint, unit, types, build, dist, docs build; E2E Chromium (dev, min), Walkontable, Firefox and WebKit in `tools/in-playwright-docker.sh`.
EOF
)"
```

- [ ] **Step 5: CI green**

Run: `gh pr checks --watch`
Expected: `checks`, `docs` and all `browser` jobs pass.
