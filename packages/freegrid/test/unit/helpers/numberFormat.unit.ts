import { createRequire } from 'node:module';
import numbro from 'numbro';
import { formatNumber } from '../../../src/helpers/numberFormat';

// numbro is the reference: FreeGrid's number module must write numericFormat patterns the way FreeGrid did with
// numbro, for the cultures whose separators numbro and the browser (Intl) agree on.
const require = createRequire(import.meta.url);

numbro.registerLanguage(require('numbro/languages/de-DE.js'));
numbro.registerLanguage(require('numbro/languages/en-GB.js'));

const VALUES = [0, 1, -1, 0.5, -0.4, 12, 1.005, 999.995, 2456.22, -1000.23, 1234567.891, -98765432.1, 0.000123,
  1250000000, 3e12, 2048, 86399, 3661.4];
const PATTERNS = ['0', '0,0', '0,0.00', '0.00', '0.0000', '000.00', '.00', '0[.]00', '0,0[.]00', '$0,0.00',
  '0,0.00 $', '$ 0,0.00', '$0', '0%', '0.00%', '0 %', '0.0a', '0a', '0,0.0 a', '3a', '(0,0.00)', '+0,0', '+0.0%',
  '-0,0', '0o', '0 o', '00:00:00', '0b', '0.0 b', '0.00bd', '0d', '{x}0,0{y}', '{EUR }0.00', '$0.0a'];
const CULTURES = ['en-US', 'de-DE', 'en-GB'];

const reference = (value: number, pattern: string, culture: string) => {
  numbro.setLanguage(culture);

  return numbro(value).format(pattern);
};

describe('numberFormat', () => {
  describe('formatNumber with a numbro pattern', () => {
    it('writes numbers like numbro', () => {
      const mismatches: string[] = [];

      CULTURES.forEach((culture) => {
        PATTERNS.forEach((pattern) => {
          VALUES.forEach((value) => {
            const expected = reference(value, pattern, culture);
            const actual = formatNumber(value, { pattern, culture });

            if (actual !== expected) {
              mismatches.push(`${culture} ${pattern} ${value}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
            }
          });
        });
      });

      expect(mismatches).toEqual([]);
    });

    it('uses en-US without a culture, or with one the browser does not know', () => {
      expect(formatNumber(2456.22, { pattern: '$0,0.00' })).toBe('$2,456.22');
      expect(formatNumber(2456.22, { pattern: '$0,0.00', culture: 'xx-invalid-' })).toBe('$2,456.22');
      expect(formatNumber(1.5)).toBe('1.5');
    });

    it('takes separators and the currency from the browser for any culture', () => {
      expect(formatNumber(2456.22, { pattern: '0,0.00 $', culture: 'lt-LT' })).toMatch(/^2\s456,22 €$/);
      expect(formatNumber(2456.22, { pattern: '$0,0.00', culture: 'en-IN' })).toBe('₹2,456.22');
      expect(formatNumber(2456.22, { pattern: '0,0.00 $', culture: 'pl-PL' })).toMatch(/^2\s456,22 zł$/);
    });

    it('differs from numbro only where the browser\'s data does: symbols, and k/m/b/t for every culture', () => {
      expect(formatNumber(2456.22, { pattern: '$0,0.00', culture: 'ja-JP' })).toBe('￥2,456.22');
      expect(formatNumber(1234567, { pattern: '0.0a', culture: 'ja-JP' })).toBe('1.2m');
    });

    it('leaves numbers that are not finite as they are', () => {
      expect(formatNumber(Infinity, { pattern: '0,0' })).toBe('Infinity');
      expect(formatNumber(NaN, { pattern: '0,0' })).toBe('NaN');
    });
  });

  describe('formatNumber with Intl options', () => {
    it('passes options other than pattern and culture to Intl.NumberFormat', () => {
      expect(formatNumber(2456.2, { culture: 'de-DE', style: 'currency', currency: 'EUR' }))
        .toBe(new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(2456.2));
      expect(formatNumber(0.256, { style: 'percent', maximumFractionDigits: 1 })).toBe('25.6%');
      expect(formatNumber(1234567, { notation: 'compact' })).toBe('1.2M');
    });
  });
});
