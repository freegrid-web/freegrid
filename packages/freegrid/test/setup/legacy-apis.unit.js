import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// APIs that only Internet Explorer (or Shadow DOM v0) had. FreeGrid supports Chrome 80+, Firefox 74+ and Safari 14+,
// so code using them is dead. `cancelBubble` is not listed: it is also a standard alias for stopping propagation.
const IE_ONLY = [
  /\battachEvent\b/, /\bdetachEvent\b/, /\bcreateEventObject\b/, /\.currentStyle\b/, /\bdocument\.selection\b/,
  /\bcreateTextRange\b/, /\bdocumentMode\b/, /\bcreateShadowRoot\b/, /Trident/,
];

describe('source files', () => {
  it('do not use IE-only APIs', () => {
    const src = resolve(import.meta.dirname, '../../src');
    const files = readdirSync(src, { recursive: true }).map(String)
      .filter(f => /\.(js|ts)$/.test(f) && !/(^|[\\/])(test|dist)[\\/]/.test(f));
    const found = files.flatMap((file) => {
      const code = readFileSync(resolve(src, file), 'utf8');

      return IE_ONLY.filter(api => api.test(code)).map(api => `${file}: ${api.source}`);
    });

    expect(found).toEqual([]);
  });
});
