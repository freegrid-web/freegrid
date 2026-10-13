import * as Handsontable from 'handsontable';

// The names before 0.3.0 are gone (Editor*, Renderer* and Validator* replace them).
// @ts-expect-error
Handsontable.editors.TextEditor;
// @ts-expect-error
Handsontable.renderers.TextRenderer;
// @ts-expect-error
Handsontable.validators.DateValidator;
