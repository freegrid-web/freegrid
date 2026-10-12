import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Vite resolves extensionless imports by trying `.js` before `.ts`, so a `.js` left next to its converted
// `.ts` would silently replace the TypeScript module everywhere.
describe('source files', () => {
  it('never keep a .js module next to a .ts module of the same name', () => {
    const files = readdirSync(resolve(import.meta.dirname, '../../src'), { recursive: true }).map(String);
    const tsModules = new Set(files.filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts')).map(f => f.slice(0, -3)));
    const shadowing = files.filter(f => f.endsWith('.js') && tsModules.has(f.slice(0, -3)));

    expect(shadowing).toEqual([]);
  });
});
