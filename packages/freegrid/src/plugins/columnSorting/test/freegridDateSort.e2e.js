// FreeSheet: more date sorting specs with valid formats (next to the date spec in columnSorting.e2e.js).
describe('ColumnSorting (FreeSheet) data type: date with a valid format', () => {
  const id = 'testContainer';

  beforeEach(function() {
    this.$container = $(`<div id="${id}" style="overflow: auto; width: 300px; height: 200px;"></div>`).appendTo('body');
  });

  afterEach(function() {
    if (this.$container) {
      destroy();
      this.$container.remove();
    }
  });

  it('should sort date columns along with empty and null values', () => {
    handsontable({
      data: [
        ['Mercedes', 'A 160', '01/14/2006', 6999.9999],
        ['Citroen', 'C4 Coupe', '12/01/2008', 8330],
        ['Citroen', 'C4 Coupe null', null, 8330],
        ['Citroen', 'C4 Coupe empty', '', 8330],
        ['Audi', 'A4 Avant', '11/19/2011', 33900],
        ['Opel', 'Astra', '02/02/2004', 7000],
        ['BMW', '320i Coupe', '07/24/2011', 30500]
      ],
      columns: [
        {},
        {},
        {
          type: 'date',
          dateFormat: 'MM/DD/YYYY'
        },
        {
          type: 'numeric'
        }
      ],
      colHeaders: true,
      columnSorting: true
    });

    getPlugin('columnSorting').sort({ column: 2, sortOrder: 'asc' });

    expect(getDataAtCol(2)).toEqual(['02/02/2004', '01/14/2006', '12/01/2008', '07/24/2011', '11/19/2011', null, '']);

    getPlugin('columnSorting').sort({ column: 2, sortOrder: 'desc' });

    expect(getDataAtCol(2)).toEqual(['11/19/2011', '07/24/2011', '12/01/2008', '01/14/2006', '02/02/2004', null, '']);
  });
});
