/**
 * Raw DEFLATE decompression (RFC 1951), for browsers whose `DecompressionStream` lacks `deflate-raw`. A small,
 * straightforward decoder: stored, fixed-Huffman and dynamic-Huffman blocks.
 */

/** A canonical Huffman code: how many codes of each length, and the symbols in code order. */
type Huffman = { counts: Uint16Array; symbols: Uint16Array };

const LENGTH_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131,
  163, 195, 227, 258];
const LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DISTANCE_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537,
  2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DISTANCE_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13,
  13];
/** The order the code length code lengths come in. */
const CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

const buildHuffman = (lengths: ArrayLike<number>): Huffman => {
  const counts = new Uint16Array(16);
  const offsets = new Uint16Array(16);
  const symbols = new Uint16Array(lengths.length);

  for (let i = 0; i < lengths.length; i += 1) {
    counts[lengths[i]] += 1;
  }
  counts[0] = 0;
  for (let length = 1; length < 16; length += 1) {
    offsets[length] = offsets[length - 1] + counts[length - 1];
  }
  for (let symbol = 0; symbol < lengths.length; symbol += 1) {
    if (lengths[symbol]) {
      symbols[offsets[lengths[symbol]]] = symbol;
      offsets[lengths[symbol]] += 1;
    }
  }

  return { counts, symbols };
};

class BitReader {
  bytes: Uint8Array;
  position = 0;
  #bitBuffer = 0;
  #bitCount = 0;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
  }

  bits(count: number): number {
    while (this.#bitCount < count) {
      if (this.position >= this.bytes.length) {
        throw new Error('Unexpected end of compressed data.');
      }
      this.#bitBuffer |= this.bytes[this.position] << this.#bitCount;
      this.position += 1;
      this.#bitCount += 8;
    }
    const value = this.#bitBuffer & ((1 << count) - 1);

    this.#bitBuffer >>>= count;
    this.#bitCount -= count;

    return value;
  }

  /** Drops the bits left in the current byte (stored blocks start on a byte). */
  align(): void {
    this.#bitBuffer = 0;
    this.#bitCount = 0;
  }

  decode({ counts, symbols }: Huffman): number {
    let code = 0;
    let first = 0;
    let index = 0;

    for (let length = 1; length < 16; length += 1) {
      code |= this.bits(1);
      const count = counts[length];

      if (code - count < first) {
        return symbols[index + (code - first)];
      }
      index += count;
      first += count;
      first <<= 1;
      code <<= 1;
    }
    throw new Error('Invalid Huffman code in compressed data.');
  }
}

let fixedTables: [Huffman, Huffman] | null = null;

const fixed = (): [Huffman, Huffman] => {
  if (!fixedTables) {
    const lengths = new Uint8Array(288);

    lengths.fill(8, 0, 144);
    lengths.fill(9, 144, 256);
    lengths.fill(7, 256, 280);
    lengths.fill(8, 280, 288);
    fixedTables = [buildHuffman(lengths), buildHuffman(new Uint8Array(30).fill(5))];
  }

  return fixedTables;
};

const dynamic = (reader: BitReader): [Huffman, Huffman] => {
  const literalCount = reader.bits(5) + 257;
  const distanceCount = reader.bits(5) + 1;
  const codeLengthCount = reader.bits(4) + 4;
  const codeLengths = new Uint8Array(19);

  for (let i = 0; i < codeLengthCount; i += 1) {
    codeLengths[CODE_LENGTH_ORDER[i]] = reader.bits(3);
  }
  const codeLengthCode = buildHuffman(codeLengths);
  const lengths = new Uint8Array(literalCount + distanceCount);

  for (let i = 0; i < lengths.length;) {
    const symbol = reader.decode(codeLengthCode);

    if (symbol < 16) {
      lengths[i] = symbol;
      i += 1;
    } else {
      let repeat = 0;
      let value = 0;

      if (symbol === 16) {
        if (i === 0) {
          throw new Error('Invalid code lengths in compressed data.');
        }
        value = lengths[i - 1];
        repeat = 3 + reader.bits(2);
      } else if (symbol === 17) {
        repeat = 3 + reader.bits(3);
      } else {
        repeat = 11 + reader.bits(7);
      }
      lengths.fill(value, i, i + repeat);
      i += repeat;
    }
  }

  return [buildHuffman(lengths.subarray(0, literalCount)), buildHuffman(lengths.subarray(literalCount))];
};

/** Decompresses raw DEFLATE data. */
export const inflate = (data: Uint8Array): Uint8Array => {
  const reader = new BitReader(data);
  let output = new Uint8Array(Math.max(1024, data.length * 4));
  let size = 0;
  const reserve = (more: number) => {
    if (size + more > output.length) {
      const larger = new Uint8Array(Math.max(output.length * 2, size + more));

      larger.set(output.subarray(0, size));
      output = larger;
    }
  };
  let last = 0;

  while (!last) {
    last = reader.bits(1);
    const type = reader.bits(2);

    if (type === 0) {
      reader.align();
      const at = reader.position;
      const length = data[at] | (data[at + 1] << 8);

      reserve(length);
      output.set(data.subarray(at + 4, at + 4 + length), size);
      size += length;
      reader.position = at + 4 + length;
    } else if (type === 1 || type === 2) {
      const [literals, distances] = type === 1 ? fixed() : dynamic(reader);

      for (;;) {
        const symbol = reader.decode(literals);

        if (symbol < 256) {
          reserve(1);
          output[size] = symbol;
          size += 1;
        } else if (symbol === 256) {
          break;
        } else {
          const lengthIndex = symbol - 257;
          const length = LENGTH_BASE[lengthIndex] + reader.bits(LENGTH_EXTRA[lengthIndex]);
          const distanceIndex = reader.decode(distances);
          const distance = DISTANCE_BASE[distanceIndex] + reader.bits(DISTANCE_EXTRA[distanceIndex]);

          if (distance > size) {
            throw new Error('Invalid distance in compressed data.');
          }
          reserve(length);
          for (let i = 0; i < length; i += 1) {
            output[size] = output[size - distance];
            size += 1;
          }
        }
      }
    } else {
      throw new Error('Invalid block type in compressed data.');
    }
  }

  return output.slice(0, size);
};
