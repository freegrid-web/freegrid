import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveModule, liveName, liveOptions } from './liveSnippets.mjs';
import { playgroundCode } from './theme/playground.js';

const block = `import FreeSheet from '@freegrid/sheet';

const grid = new FreeSheet(document.getElementById('grid'), { data: [[1]] });
`;

test('a live block becomes a module that makes its grid in the given container', () => {
  const module = liveModule(block);

  assert.match(module, /^import FreeSheet from '@freegrid\/sheet';/);
  assert.match(module, /export default async function create\(container\) \{\n {2}const grid = new FreeSheet\(container,/);
  assert.match(module, /return grid;\n\}/);
  assert.equal(new Function(`${module.match(/export const source = (.*);/)[1]}`.replace(/^/, 'return '))(), block);
});

test('a live block without a grid is an error', () => {
  assert.throws(() => liveModule("import FreeSheet from '@freegrid/sheet';\nnew FreeSheet(document.body);\n"), /makes no `grid`/);
});

test('live block names and options', () => {
  assert.equal(liveName('guide/row-groups.md', 2), 'guide-row-groups-2');
  assert.deepEqual(liveOptions(' height=300px'), { height: '300px' });
});

test('the playground runs an example file with the page\'s #grid', () => {
  const code = 'import X from "x";\n\nexport default async function createGrid(container) {\n  return 1;\n}\n';

  assert.equal(playgroundCode(code), 'import X from "x";\n\nasync function createGrid(container) {\n  return 1;\n}\n\ncreateGrid(document.getElementById(\'grid\'));\n');
  assert.equal(playgroundCode(block), block);
});
