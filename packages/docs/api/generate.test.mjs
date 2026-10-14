import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventSection, methodSection, safe, settingSection, unlinkMissing } from './generate.mjs';

test('keeps HTML tags in text from being parsed, but not inside code', () => {
  assert.equal(safe('Adds a <td> element, see `<td class="x">` and {{ value }}.'),
    'Adds a &lt;td&gt; element, see `<td class="x">` and &#123;&#123; value &#125;&#125;.');
});

test('writes a method with its signature, anchor, parameters table, return value and example', () => {
  const text = methodSection({
    name: 'alter',
    anchor: 'alter',
    description: 'Inserts or removes rows.',
    params: [
      { name: 'action', type: 'String', optional: false, description: 'One of `insert_row` | `remove_row`.' },
      { name: 'amount', type: 'Number', optional: true, default: '1', description: 'How many.' },
    ],
    returns: { type: 'Array|undefined', description: 'Changes.' },
    examples: ['```js\nhot.alter(\'insert_row\', 0);\n```'],
  });

  assert.match(text, /^### alter\(action, \[amount\]\) \{#alter\}$/m);
  assert.match(text, /^\| `action` \| `String` \| One of `insert_row` \\\| `remove_row`\. \|$/m);
  assert.match(text, /^\| `amount` \| `Number` \| Optional, default `1`\. How many\. \|$/m);
  assert.match(text, /^\*\*Returns\*\* `Array \| undefined` — Changes\.$/m);
  assert.match(text, /```js\nhot\.alter\('insert_row', 0\);\n```/);
});

test('writes a setting with its type and default', () => {
  const text = settingSection({ name: 'colWidths', anchor: 'colwidths', type: 'Number|Function', default: 'undefined',
    description: 'Column widths.', params: [], examples: [] });

  assert.match(text, /^### colWidths \{#colwidths\}$/m);
  assert.match(text, /^Type: `Number \| Function` · Default: `undefined`$/m);
});

test('closes an example whose closing fence is on the code\'s last line', () => {
  const text = methodSection({ name: 'x', anchor: 'x', description: '', params: [], examples: ['```js\nfoo: [1]```'] });

  assert.match(text, /```js\nfoo: \[1\]\n```/);
});

test('keeps a backslash before a pipe from breaking a table cell', () => {
  const text = methodSection({ name: 'x', anchor: 'x', description: '', returns: undefined, examples: [],
    params: [{ name: 'pattern', type: 'String', optional: false, description: 'Splits on `\\|` or on `,`.' }] });
  const row = text.split('\n').find(line => line.startsWith('| `pattern`'));

  // Three cells: the pipes inside the description are all escaped, and so is the backslash before one of them.
  assert.equal(row.split(/(?<!\\)\|/).length - 2, 3);
  assert.match(row, /Splits on `\\\\\\\|` or on `,`\./);
});

test('puts the examples in a collapsible "Example" block', () => {
  const text = methodSection({ name: 'x', anchor: 'x', description: '', params: [], examples: ['```js\nfoo();\n```'] });

  assert.match(text, /^::: details Example\n```js\nfoo\(\);\n```\n:::$/m);
});

test('writes a collapsible "Usage" example where the source code has none', () => {
  const method = methodSection({ name: 'getDataAtCell', anchor: 'getdataatcell', description: '', examples: [],
    params: [{ name: 'row', optional: false }, { name: 'column', optional: false }, { name: 'source', optional: true }],
    returns: { type: '*', description: '' } });
  const plugin = methodSection({ name: 'sort', owner: 'ColumnSorting', anchor: 'columnsorting-sort', description: '',
    examples: [], params: [{ name: 'sortConfig', optional: false }] }, 'ColumnSorting.sort');
  const event = eventSection({ name: 'afterChange', anchor: 'afterchange', description: '', examples: [],
    params: [{ name: 'changes' }, { name: 'source' }] });
  const setting = settingSection({ name: 'fillHandle', anchor: 'fillhandle', type: 'Boolean|String|Object',
    default: 'true', description: '', params: [], examples: [] });

  assert.match(method, /::: details Usage\n```js\nconst result = grid\.getDataAtCell\(row, column\);\n```\n:::/);
  assert.match(plugin, /::: details Usage\n```js\ngrid\.getPlugin\('columnSorting'\)\.sort\(sortConfig\);\n```\n:::/);
  assert.match(event, /::: details Usage\n```js\nnew FreeSheet\(element, \{\n {2}afterChange\(changes, source\) \{\n {4}\/\/ …\n {2}\},\n\}\);\n\n\/\/ or later\ngrid\.addHook\('afterChange', \(changes, source\) => \{\n {2}\/\/ …\n\}\);\n```\n:::/);
  assert.match(setting, /::: details Usage\n```js\nnew FreeSheet\(element, \{\n {2}fillHandle: false,\n\}\);\n\n\/\/ or later\ngrid\.updateSettings\(\{ fillHandle: false \}\);\n```\n:::/);
});

test('turns links to entries the reference does not have into plain text', () => {
  const anchors = { methods: new Set(['getdata']), plugins: new Set(['columnsorting-sort']) };

  assert.equal(unlinkMissing('See [getData()](./methods#getdata), [DataMap.get()](./plugins#datamap-get) and '
    + '[sort](./plugins#columnsorting-sort).', anchors),
  'See [getData()](./methods#getdata), DataMap.get() and [sort](./plugins#columnsorting-sort).');
});
