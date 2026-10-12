/* global FreeGrid */
(function() {
  'use strict';

  var eventLog = document.getElementById('event-log');

  document.getElementById('version').textContent = 'version ' + FreeGrid.version + ' (built ' + FreeGrid.buildDate + ')';

  function logChanges(gridName) {
    return function(changes, source) {
      if (!changes || source === 'loadData') {
        return;
      }
      changes.forEach(function(change) {
        var item = document.createElement('li');

        item.textContent = gridName + ': row ' + change[0] + ', ' + change[1] + ': ' +
          JSON.stringify(change[2]) + ' → ' + JSON.stringify(change[3]) + ' (' + source + ')';
        eventLog.insertBefore(item, eventLog.firstChild);
      });
      while (eventLog.children.length > 12) {
        eventLog.removeChild(eventLog.lastChild);
      }
    };
  }

  // 1. Spreadsheet basics
  var basic = new FreeGrid(document.getElementById('grid-basic'), {
    data: [
      ['', 'Tesla', 'Volvo', 'Toyota', 'Ford'],
      ['2022', 10, 11, 12, 13],
      ['2023', 20, 11, 14, 13],
      ['2024', 30, 15, 12, 13],
      ['2025', 35, 18, 16, 15],
      ['2026', 42, 21, 19, 14]
    ],
    rowHeaders: true,
    colHeaders: true,
    contextMenu: true,
    columnSorting: true,
    manualColumnResize: true,
    manualRowResize: true,
    manualColumnMove: true,
    manualRowMove: true,
    stretchH: 'all',
    minSpareRows: 1,
    afterChange: logChanges('basics')
  });

  document.getElementById('basic-undo').addEventListener('click', function() { basic.undo(); });
  document.getElementById('basic-redo').addEventListener('click', function() { basic.redo(); });
  document.getElementById('basic-export').addEventListener('click', function() {
    var output = document.getElementById('basic-output');

    output.hidden = false;
    output.textContent = JSON.stringify(basic.getData(), null, 2);
  });

  // 2. Cell types
  new FreeGrid(document.getElementById('grid-types'), {
    data: [
      { product: 'Laptop', price: 1299.99, released: '2026-03-14', inStock: true, category: 'Computers', city: 'Vilnius', code: 'secret1' },
      { product: 'Monitor', price: 249.5, released: '2025-11-02', inStock: false, category: 'Displays', city: 'Kaunas', code: 'secret2' },
      { product: 'Keyboard', price: 79, released: '2024-06-21', inStock: true, category: 'Accessories', city: 'Klaipėda', code: 'secret3' },
      { product: 'Mouse', price: 39.9, released: '2025-01-09', inStock: true, category: 'Accessories', city: 'Riga', code: 'secret4' }
    ],
    colHeaders: ['Product', 'Price', 'Released', 'In stock', 'Category', 'City', 'Code'],
    columns: [
      { data: 'product' },
      { data: 'price', type: 'numeric', numericFormat: { pattern: '0,0.00 $' } },
      { data: 'released', type: 'date', dateFormat: 'YYYY-MM-DD', correctFormat: true },
      { data: 'inStock', type: 'checkbox', className: 'htCenter' },
      { data: 'category', type: 'dropdown', source: ['Computers', 'Displays', 'Accessories', 'Software'] },
      { data: 'city', type: 'autocomplete', source: ['Vilnius', 'Kaunas', 'Klaipėda', 'Šiauliai', 'Panevėžys', 'Riga', 'Tallinn', 'Warsaw'], strict: false },
      { data: 'code', type: 'password' }
    ],
    rowHeaders: true,
    stretchH: 'all',
    contextMenu: true,
    afterChange: logChanges('cell types')
  });

  // 3. Merged cells, comments and borders
  new FreeGrid(document.getElementById('grid-merge'), {
    data: FreeGrid.helper.createSpreadsheetData(8, 8),
    rowHeaders: true,
    colHeaders: true,
    contextMenu: true,
    stretchH: 'all',
    mergeCells: [
      { row: 1, col: 1, rowspan: 2, colspan: 3 },
      { row: 4, col: 4, rowspan: 3, colspan: 2 }
    ],
    comments: true,
    cell: [
      { row: 0, col: 0, comment: { value: 'Comments are free too.' } },
      { row: 5, col: 1, comment: { value: 'Right-click to edit or delete this comment.' } }
    ],
    customBorders: [
      {
        range: { from: { row: 1, col: 1 }, to: { row: 2, col: 3 } },
        top: { width: 2, color: '#1a7f37' },
        bottom: { width: 2, color: '#1a7f37' },
        left: { width: 2, color: '#1a7f37' },
        right: { width: 2, color: '#1a7f37' }
      }
    ],
    afterChange: logChanges('merged cells')
  });

  // 4. Large data set
  var rows = 10000;
  var cols = 20;
  var largeData = [];
  var r;
  var c;

  for (r = 0; r < rows; r += 1) {
    var row = ['Item ' + (r + 1)];

    for (c = 1; c < cols; c += 1) {
      row.push((r * 7 + c * 13) % 1000);
    }
    largeData.push(row);
  }

  var started = performance.now();

  new FreeGrid(document.getElementById('grid-large'), {
    data: largeData,
    rowHeaders: true,
    colHeaders: true,
    fixedColumnsLeft: 1,
    fixedRowsTop: 1,
    columnSorting: true,
    contextMenu: true,
    afterChange: logChanges('10,000 rows')
  });
  document.getElementById('large-metric').textContent = 'Rendered ' + rows.toLocaleString('en') + ' × ' + cols +
    ' cells in ' + Math.round(performance.now() - started) + ' ms.';

  // 5. Search and languages
  var searchGrid = new FreeGrid(document.getElementById('grid-search'), {
    data: [
      ['Vilnius', 'Lithuania', 588412, 'EUR'],
      ['Riga', 'Latvia', 605273, 'EUR'],
      ['Tallinn', 'Estonia', 457572, 'EUR'],
      ['Warsaw', 'Poland', 1861975, 'PLN'],
      ['Helsinki', 'Finland', 674500, 'EUR'],
      ['Stockholm', 'Sweden', 984748, 'SEK'],
      ['Copenhagen', 'Denmark', 660842, 'DKK'],
      ['Berlin', 'Germany', 3878100, 'EUR']
    ],
    colHeaders: ['City', 'Country', 'Population', 'Currency'],
    columns: [{}, {}, { type: 'numeric', numericFormat: { pattern: '0,0' } }, {}],
    rowHeaders: true,
    stretchH: 'all',
    search: true,
    contextMenu: true,
    afterChange: logChanges('search')
  });

  document.getElementById('search-input').addEventListener('input', function(event) {
    var results = searchGrid.getPlugin('search').query(event.target.value);

    document.getElementById('search-count').textContent = event.target.value ? results.length + ' match(es)' : '';
    searchGrid.render();
  });

  var select = document.getElementById('language-select');

  Object.keys(FreeGrid.languages.getLanguagesDictionaries().reduce(function(acc, dictionary) {
    acc[dictionary.languageCode] = true;
    return acc;
  }, {})).sort().forEach(function(code) {
    var option = document.createElement('option');

    option.value = code;
    option.textContent = code;
    option.selected = code === 'en-US';
    select.appendChild(option);
  });
  select.addEventListener('change', function() {
    searchGrid.updateSettings({ language: select.value });
  });
}());
