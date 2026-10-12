# Styling

Include one of the stylesheets:

- `freegrid/dist/freegrid.full.css` also contains the date picker styles.
- `freegrid/dist/freegrid.css` contains the grid only (bring your own Pikaday styles).

## Classes

Add classes to cells, columns or the whole grid with `className`. Several helper classes are built in:

| Class | Effect |
| --- | --- |
| `htLeft`, `htCenter`, `htRight`, `htJustify` | Horizontal alignment |
| `htTop`, `htMiddle`, `htBottom` | Vertical alignment |
| `htDimmed` | Read-only look |
| `htInvalid` | Added automatically to invalid cells |

```js
columns: [{ className: 'htCenter' }, { className: 'my-highlight' }]
```

```css
.handsontable td.my-highlight {
  background: #fff3b0;
}
```

The `cells` setting and custom renderers can set classes per cell, based on the value.

::: info Coming next
The class names still use the `ht` prefix that FreeGrid inherited. FreeGrid's own names and theming with CSS
variables (including a dark theme) are on the [roadmap](../project/roadmap). Both the old and the new names
will work during a transition period.
:::
