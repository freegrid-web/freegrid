import * as Handsontable from 'handsontable';

const elem = document.createElement('div');
const hot = new Handsontable(elem, {});

const gridSettings: Handsontable.GridSettings = {
  valid: true,
  className: 'foo'
};

Handsontable.renderers.RendererAutocomplete(hot, new HTMLTableDataCellElement(), 0, 0, 'prop', 1.235, gridSettings);
Handsontable.renderers.RendererBase(hot, new HTMLTableDataCellElement(), 0, 0, 'prop', 1.235, gridSettings);
Handsontable.renderers.RendererCheckbox(hot, new HTMLTableDataCellElement(), 0, 0, 'prop', 1.235, gridSettings);
Handsontable.renderers.RendererHtml(hot, new HTMLTableDataCellElement(), 0, 0, 'prop', 1.235, gridSettings);
Handsontable.renderers.RendererNumeric(hot, new HTMLTableDataCellElement(), 0, 0, 'prop', 1.235, gridSettings);
Handsontable.renderers.RendererPassword(hot, new HTMLTableDataCellElement(), 0, 0, 'prop', 1.235, gridSettings);
Handsontable.renderers.RendererText(hot, new HTMLTableDataCellElement(), 0, 0, 'prop', 1.235, gridSettings);
