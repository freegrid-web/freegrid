import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/languages/all';
import '@freegrid/sheet/dist/freesheet.full.css';

export default function createGrid(container) {
  const toolbar = document.createElement('div');
  const gridElement = document.createElement('div');

  toolbar.className = 'example-toolbar';
  toolbar.innerHTML = `
    <label>Search <input type="search" placeholder="e.g. EUR or Vilnius"></label>
    <span class="count"></span>
    <label>Context menu language <select></select></label>`;
  container.append(toolbar, gridElement);

  const grid = new FreeSheet(gridElement, {
    data: [
      ['Vilnius', 'Lithuania', 588412, 'EUR'],
      ['Riga', 'Latvia', 605273, 'EUR'],
      ['Tallinn', 'Estonia', 457572, 'EUR'],
      ['Warsaw', 'Poland', 1861975, 'PLN'],
      ['Helsinki', 'Finland', 674500, 'EUR'],
      ['Stockholm', 'Sweden', 984748, 'SEK'],
    ],
    colHeaders: ['City', 'Country', 'Population', 'Currency'],
    columns: [{}, {}, { type: 'numeric', numericFormat: { pattern: '0,0' } }, {}],
    rowHeaders: true,
    stretchH: 'all',
    search: true,
    // Ctrl+F finds, Ctrl+H finds and replaces.
    findAndReplace: true,
    contextMenu: true,
  });

  toolbar.querySelector('input').addEventListener('input', (event) => {
    const results = grid.getPlugin('search').query(event.target.value);

    toolbar.querySelector('.count').textContent = event.target.value ? `${results.length} match(es)` : '';
    grid.render();
  });

  const select = toolbar.querySelector('select');
  const codes = [...new Set(FreeSheet.languages.getLanguagesDictionaries().map(d => d.languageCode))].sort();

  select.innerHTML = codes.map(code => `<option${code === 'en-US' ? ' selected' : ''}>${code}</option>`).join('');
  select.addEventListener('change', () => grid.updateSettings({ language: select.value }));

  return grid;
}
