import { deflateRawSync } from 'node:zlib';
import { inflate } from '../../../src/files/inflate';
import { crc32, readZip, writeZip } from '../../../src/files/zip';

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
const bytes = (value: string) => new TextEncoder().encode(value);

describe('files: inflate and ZIP', () => {
  it('inflates what zlib deflates (stored, fixed and dynamic blocks)', () => {
    const long = Array.from({ length: 2000 }, (_, i) => `row ${i % 37} value ${i * 7}`).join('\n');

    [
      '',
      'a',
      'hello hello hello hello',
      long,
    ].forEach((sample) => {
      [0, 1, 6, 9].forEach((level) => {
        expect(text(inflate(new Uint8Array(deflateRawSync(bytes(sample), { level }))))).toBe(sample);
      });
    });

    const random = new Uint8Array(5000).map((_, i) => (i * 2654435761) % 251);

    expect(inflate(new Uint8Array(deflateRawSync(random))).every((value, i) => value === random[i])).toBe(true);
  });

  it('computes the CRC-32 of the data', () => {
    expect(crc32(bytes('123456789'))).toBe(0xcbf43926);
  });

  it('writes a ZIP archive and reads it back', async() => {
    const content = Array.from({ length: 300 }, (_, i) => `<c r="A${i}"/>`).join('');
    const zip = await writeZip([
      { name: '[Content_Types].xml', data: bytes('<Types/>') },
      { name: 'xl/worksheets/sheet1.xml', data: bytes(content) },
      { name: 'xl/ąčę.xml', data: bytes('unicode name') },
    ]);
    const files = await readZip(zip);

    expect([...files.keys()]).toEqual(['[Content_Types].xml', 'xl/worksheets/sheet1.xml', 'xl/ąčę.xml']);
    expect(text(files.get('xl/worksheets/sheet1.xml')!)).toBe(content);
    expect(text(files.get('xl/ąčę.xml')!)).toBe('unicode name');
  });

  it('refuses what is not a ZIP archive', async() => {
    await expect(readZip(bytes('not a zip file at all, just text'))).rejects.toThrow(/Not a ZIP/);
  });
});
