import * as Handsontable from 'handsontable';

const done = (valid: boolean) => {};
const cellProperties: Handsontable.GridSettings = { dateFormat: 'DD/MM/YYYY' };

Handsontable.validators.ValidatorAutocomplete.call(cellProperties, 'a', done);
Handsontable.validators.ValidatorDate.call(cellProperties, '01/02/2026', done);
Handsontable.validators.ValidatorNumeric.call(cellProperties, 1, done);
Handsontable.validators.ValidatorTime.call(cellProperties, '10:00', done);

Handsontable.validators.registerValidator('positive', function(value, callback) {
  callback(this.allowEmpty === true || value > 0);
});
const positive: Handsontable.Validator = Handsontable.validators.getValidator('positive');

Handsontable.renderers.registerRenderer('plain', Handsontable.renderers.getRenderer('text'));
