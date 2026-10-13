import { isObject } from './../helpers/object';
import { rangeEach } from './../helpers/number';
import { stringify } from './../helpers/mixed';

/** A cell value to sample, and a length to add to the value's own (e.g. for a dropdown arrow). */
export type SampleData = { value: unknown; bundleCountSeed?: number };
export type DataFactory = (row: number, column: number) => SampleData;
export type IndexRange = { from: number; to: number };
/** A sampled value and where it is (`row` for column samples, `col` for row samples). */
export type SampledValue = { value: unknown; row?: number; col?: number };
export type Sample = { needed: number; strings: SampledValue[] };
/** Samples of one row or column, by value length. */
export type Samples = Map<number, Sample>;

/**
 * Picks, for each row or column, a few values of each length: the size of the longest values is what the auto-size
 * plugins measure, without rendering every cell.
 */
class SamplesGenerator {
  /** Values taken of each length, unless set with `setSampleCount`. */
  static get SAMPLE_COUNT(): number {
    return 3;
  }

  /** Gives the value of a cell. */
  dataFactory: DataFactory;

  #customSampleCount: number | null = null;

  #allowDuplicates = false;

  constructor(dataFactory: DataFactory) {
    this.dataFactory = dataFactory;
  }

  getSampleCount(): number {
    return this.#customSampleCount || SamplesGenerator.SAMPLE_COUNT;
  }

  setSampleCount(sampleCount: number | null): void {
    this.#customSampleCount = sampleCount;
  }

  /** Whether the same value may be taken more than once. */
  setAllowDuplicates(allowDuplicates: boolean): void {
    this.#allowDuplicates = allowDuplicates;
  }

  /** Samples of rows `rowRange` (one row or a range), from the columns of `colRange`. */
  generateRowSamples(rowRange: IndexRange | number, colRange: IndexRange): Map<number, Samples> {
    return this.generateSamples('row', colRange, rowRange);
  }

  /** Samples of columns `colRange` (one column or a range), from the rows of `rowRange`. */
  generateColumnSamples(colRange: IndexRange | number, rowRange: IndexRange): Map<number, Samples> {
    return this.generateSamples('col', rowRange, colRange);
  }

  generateSamples(type: 'row' | 'col', range: IndexRange, specifierRange: IndexRange | number): Map<number, Samples> {
    const samples = new Map<number, Samples>();
    const { from, to } = typeof specifierRange === 'number' ? { from: specifierRange, to: specifierRange } : specifierRange;

    rangeEach(from, to, (index) => {
      samples.set(index, this.generateSample(type, range, index));
    });

    return samples;
  }

  /** Samples of one row or column (`specifierValue`), taken from the cells in `range`. */
  generateSample(type: 'row' | 'col', range: IndexRange, specifierValue: number): Samples {
    if (type !== 'row' && type !== 'col') {
      throw new Error('Unsupported sample type');
    }
    const samples: Samples = new Map();
    const computedKey = type === 'row' ? 'col' : 'row';
    const sampledValues: unknown[] = [];

    rangeEach(range.from, range.to, (index) => {
      const { value, bundleCountSeed = 0 } = type === 'row'
        ? this.dataFactory(specifierValue, index)
        : this.dataFactory(index, specifierValue);
      const hasCustomBundleSeed = bundleCountSeed > 0;
      let length: number;

      if (isObject(value)) {
        length = Object.keys(value as object).length;
      } else if (Array.isArray(value)) {
        length = value.length;
      } else {
        length = stringify(value).length;
      }
      if (hasCustomBundleSeed) {
        length += bundleCountSeed;
      }
      if (!samples.has(length)) {
        samples.set(length, { needed: this.getSampleCount(), strings: [] });
      }
      const sample = samples.get(length) as Sample;

      if (sample.needed && (sampledValues.indexOf(value) === -1 || this.#allowDuplicates || hasCustomBundleSeed)) {
        sample.strings.push({ value, [computedKey]: index });
        sampledValues.push(value);
        sample.needed -= 1;
      }
    });

    return samples;
  }
}

export default SamplesGenerator;
