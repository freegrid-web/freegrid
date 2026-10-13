import { test } from 'node:test';
import assert from 'node:assert/strict';
import { methodSection, safe, settingSection } from './generate.mjs';

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
