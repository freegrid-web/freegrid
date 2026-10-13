# Roadmap

FreeGrid is developed in stages. Each stage gets its own design document in the repository.

| Stage | What |
| --- | --- |
| **0** ✅ | Repository with the full history of the MIT code, a modern toolchain (Vite, Vitest, Playwright, Node 24), every upstream test passing, CI and this site. |
| **1** | First npm release, `0.1.0`. Bug fixes, Firefox and Safari test fixes, FreeGrid CSS class names (with a transition period), React, Vue and Angular wrappers, release automation. |
| **2** | TypeScript rewrite, module by module. Fine-grained reactivity with signals (not a virtual DOM). Theming with CSS variables, including a dark theme and an optional Tailwind preset. Replace moment with FreeGrid's own date module and date picker. A generated API reference. |
| **3+** | Features that were never part of the MIT release, written from scratch: filters, column dropdown menu, hidden rows and columns, nested headers, export, formulas. |

`1.0.0` will mark FreeGrid's own stable API. The Handsontable compatibility layer is removed then.

Ideas and help are welcome on [GitHub](https://github.com/freegrid-web/freegrid/issues).
