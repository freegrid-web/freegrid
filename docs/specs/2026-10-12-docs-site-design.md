# FreeGrid documentation site (VitePress)

- **Status:** Approved in conversation, 2026-10-12
- **Replaces:** the single-page demo in `demo/`

## Goal

A clean, simple documentation site in the style of the Vue docs, on GitHub Pages at
`https://freegrid-web.github.io/freegrid/`. It has live examples that run the current build. It is English
only and written from scratch: nothing is copied from Handsontable documentation (clean-room).

## Decisions

- **VitePress 1.6.x** (latest stable) with the **VitePress Carbon** theme (`vitepress-carbon`, MIT,
  GitHub-style; chosen 2026-10-12 instead of the default theme), a green brand color and a simple logo.
  Light and dark mode and local search are built in.
- **Home page:** hero, install commands, a quick start with code and a live grid, "Why FreeGrid" and
  links into the guide.
- **Workspace package `packages/docs`** (`@freegrid/docs`, private) depends on `freegrid: workspace:*`. The
  root `docs/` folder stays for internal design documents and is not part of the site.
- **Base path:** `/freegrid/`.
- **Live examples:** each example is a single file, `packages/docs/examples/<name>.js`, written like user
  code (`import FreeGrid from 'freegrid'`). It default-exports `(container) => instance`.
  - A global `<LiveExample name="…">` component imports the file in the browser only (`onMounted`,
    `import.meta.glob`), renders it, and destroys the grid on unmount.
  - Pages show the same file with `<<< @/../examples/<name>.js`, so the code and the demo cannot drift
    apart.
- **Pages workflow** builds FreeGrid, then the docs, and deploys `packages/docs/.vitepress/dist`.
  `demo/` and `tools/build-site.mjs` are removed.
- **CI job `docs`** builds the site and runs a Playwright smoke test. The test loads every example
  page, asserts that each live example renders a grid, and asserts that the console has no errors.

## Site map

- **Guide:**
  - Introduction
  - Getting started
  - Migrating from Handsontable 6
  - Configuration
  - Cell types
  - Data and events
  - Plugins
  - Localization
  - Styling
- **Examples** (each with a live example and its code):
  - Basics
  - Cell types
  - Merged cells and comments
  - 10,000 rows
  - Search and languages
- **API:** the constructor, the most-used instance methods and settings. The full reference will be
  generated from TypeScript types in Stage 2.
- **Project:**
  - Roadmap
  - Contributing
  - Changelog
  - Origin and license

## Known limitation

The grid CSS has light styles only, so grids stay light in the docs' dark mode. This is tracked as an issue
and fixed with CSS-variable theming (Stage 2).

## Tasks

1. Scaffold `packages/docs`: config, theme, the `LiveExample` component, and scripts.
2. Example files and example pages. The smoke test is written first and fails until the pages exist.
3. Guide, API and Project pages.
4. Replace `demo/` in the Pages workflow. Add the `docs` CI job.
5. README link and the dark-mode issue. Open a PR and merge it when its checks pass.
