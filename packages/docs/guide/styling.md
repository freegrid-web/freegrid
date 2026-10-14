# Styling

Include one of the stylesheets:

- `@freegrid/sheet/dist/freesheet.full.css` also contains the date picker styles.
- `@freegrid/sheet/dist/freesheet.css` contains the grid only (bring your own Pikaday styles).

To change colors and fonts, or to use the dark theme, see [Theming](./theming).

## Classes

FreeSheet's class names use the `fg-` prefix. The root element has the class `freegrid`.

Add classes to cells, columns or the whole grid with `className`. Several helper classes are built in:

| Class | Effect |
| --- | --- |
| `fg-left`, `fg-center`, `fg-right`, `fg-justify` | Horizontal alignment |
| `fg-top`, `fg-middle`, `fg-bottom` | Vertical alignment |
| `fg-dimmed` | Read-only look |
| `fg-invalid` | Added automatically to invalid cells |
| `fg-search-result` | Added by the search plugin to matching cells |

```js
columns: [{ className: 'fg-center' }, { className: 'my-highlight' }]
```

```css
.freegrid td.my-highlight {
  background: #fff3b0;
}
```

The `cells` setting and custom renderers can set classes per cell, based on the value.

## Legacy class names

FreeSheet started from Handsontable 6, whose classes were named `handsontable`, `htCore`, `htCenter` and so on.
During FreeSheet `0.x` **both names work**:

- every element FreeSheet creates carries both its FreeSheet and its legacy class, so stylesheets written for
  the old names keep matching;
- FreeSheet's CSS styles both names, so `className: 'htCenter'` still centers text.

The legacy names are removed in FreeSheet `1.0`. To prepare, switch your selectors and `className` values to
the names below. Class names without a brand prefix (such as `current`, `area` or `manualColumnResizer`) are
unchanged.

::: details All class names
| FreeSheet | Legacy (until 1.0) |
| --- | --- |
| `fg-active-highlight` | `ht__active_highlight` |
| `fg-auto-size` | `htAutoSize` |
| `fg-autocomplete` | `htAutocomplete` |
| `fg-autocomplete-arrow` | `htAutocompleteArrow` |
| `fg-autocomplete-wrapper` | `htAutocompleteWrapper` |
| `fg-bad-value` | `htBadValue` |
| `fg-border` | `htBorder` |
| `fg-bordered` | `htBordered` |
| `fg-borders` | `htBorders` |
| `fg-bottom` | `htBottom` |
| `fg-bottom-border-solid` | `htBottomBorderSolid` |
| `fg-center` | `htCenter` |
| `fg-checkbox-renderer-input` | `htCheckboxRendererInput` |
| `fg-checkbox-renderer-label` | `htCheckboxRendererLabel` |
| `fg-clone-bottom` | `ht_clone_bottom` |
| `fg-clone-bottom-left-corner` | `ht_clone_bottom_left_corner` |
| `fg-clone-corner` | `ht_clone_corner` |
| `fg-clone-debug` | `ht_clone_debug` |
| `fg-clone-left` | `ht_clone_left` |
| `fg-clone-top` | `ht_clone_top` |
| `fg-clone-top-left-corner` | `ht_clone_top_left_corner` |
| `fg-collapse-button` | `htCollapseButton` |
| `fg-comment-cell` | `htCommentCell` |
| `fg-comment-text-area` | `htCommentTextArea` |
| `fg-comments` | `htComments` |
| `fg-comments-container` | `htCommentsContainer` |
| `fg-context-menu` | `htContextMenu` |
| `fg-core` | `htCore` |
| `fg-custom-menu-renderer` | `htCustomMenuRenderer` |
| `fg-datepicker-holder` | `htDatepickerHolder` |
| `fg-debug-visible` | `wtDebugVisible` |
| `fg-dimmed` | `htDimmed` |
| `fg-disabled` | `htDisabled` |
| `fg-editor-grid` | `handsontableEditor` |
| `fg-editor-holder` | `handsontableInputHolder` |
| `fg-editor-input` | `handsontableInput` |
| `fg-expand-button` | `htExpandButton` |
| `fg-fill-border` | `htFillBorder` |
| `fg-ghost-table` | `htGhostTable` |
| `fg-group-indicator-container` | `htGroupIndicatorContainer` |
| `fg-hidden` | `htHidden` |
| `fg-hider` | `wtHider` |
| `fg-highlight` | `ht__highlight` |
| `fg-holder` | `wtHolder` |
| `fg-invalid` | `htInvalid` |
| `fg-item-wrapper` | `htItemWrapper` |
| `fg-justify` | `htJustify` |
| `fg-left` | `htLeft` |
| `fg-left-border-solid` | `htLeftBorderSolid` |
| `fg-mac-scroll` | `htMacScroll` |
| `fg-manual-column-move` | `ht__manualColumnMove` |
| `fg-manual-column-move--backlight` | `ht__manualColumnMove--backlight` |
| `fg-manual-column-move--guideline` | `ht__manualColumnMove--guideline` |
| `fg-manual-row-move` | `ht__manualRowMove` |
| `fg-manual-row-move--backlight` | `ht__manualRowMove--backlight` |
| `fg-manual-row-move--guideline` | `ht__manualRowMove--guideline` |
| `fg-master` | `ht_master` |
| `fg-menu` | `htMenu` |
| `fg-middle` | `htMiddle` |
| `fg-mobile-editor-container` | `htMobileEditorContainer` |
| `fg-no-frame` | `htNoFrame` |
| `fg-no-wrap` | `htNoWrap` |
| `fg-numeric` | `htNumeric` |
| `fg-placeholder` | `htPlaceholder` |
| `fg-right` | `htRight` |
| `fg-right-border-solid` | `htRightBorderSolid` |
| `fg-row-headers` | `htRowHeaders` |
| `fg-search-result` | `htSearchResult` |
| `fg-select-editor` | `htSelectEditor` |
| `fg-selection--columns` | `ht__selection--columns` |
| `fg-selection--rows` | `ht__selection--rows` |
| `fg-selection-border` | `wtBorder` |
| `fg-selection-disabled` | `htSelectionDisabled` |
| `fg-separator` | `htSeparator` |
| `fg-spreader` | `wtSpreader` |
| `fg-submenu` | `htSubmenu` |
| `fg-top` | `htTop` |
| `fg-top-border-solid` | `htTopBorderSolid` |
| `freegrid` | `handsontable` |
:::

::: info Coming next
Theming with CSS variables (including a dark theme) is on the [roadmap](../project/roadmap).
:::
