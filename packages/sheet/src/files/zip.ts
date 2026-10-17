import { inflate } from './inflate';

/** A file in a ZIP archive: its path and its bytes. */
export type ZipEntry = { name: string; data: Uint8Array };

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let n = 0; n < 256; n += 1) {
    let c = n;

    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }

  return table;
})();

export const crc32 = (data: Uint8Array): number => {
  let crc = 0xffffffff;

  for (let i = 0; i < data.length; i += 1) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
};

const streamBytes = async(data: Uint8Array, stream: { writable: WritableStream<BufferSource>;
  readable: ReadableStream<Uint8Array> }): Promise<Uint8Array> => {
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];

  writer.write(data as BufferSource);
  writer.close();
  for (;;) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }
    chunks.push(value);
  }
  const result = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let at = 0;

  chunks.forEach((chunk) => {
    result.set(chunk, at);
    at += chunk.length;
  });

  return result;
};

/** Whether the browser compresses and decompresses raw DEFLATE itself. */
const supportsDeflateRaw = (kind: 'CompressionStream' | 'DecompressionStream'): boolean => {
  const Stream = (globalThis as Record<string, unknown>)[kind] as (new (format: string) => unknown) | undefined;

  if (typeof Stream !== 'function') {
    return false;
  }
  try {
    // Only checks that the format is known.
    new Stream('deflate-raw');

    return true;
  } catch {
    return false;
  }
};

const deflateRaw = async(data: Uint8Array): Promise<Uint8Array | null> => (supportsDeflateRaw('CompressionStream') ?
  streamBytes(data, new CompressionStream('deflate-raw' as CompressionFormat)) : null);

const inflateRaw = async(data: Uint8Array): Promise<Uint8Array> => (supportsDeflateRaw('DecompressionStream') ?
  streamBytes(data, new DecompressionStream('deflate-raw' as CompressionFormat)) : inflate(data));

const encoder = new TextEncoder();

/**
 * A ZIP archive of the entries: deflated where the browser can compress (and it is smaller), stored otherwise.
 */
export const writeZip = async(entries: ZipEntry[]): Promise<Uint8Array> => {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const compressed = entry.data.length > 64 ? await deflateRaw(entry.data) : null;
    const deflated = !!compressed && compressed.length < entry.data.length;
    const body = deflated ? compressed! : entry.data;
    const header = (signature: number, central: boolean) => {
      const size = central ? 46 : 30;
      const view = new DataView(new ArrayBuffer(size + name.length));
      let at = 0;
      const u16 = (value: number) => {
        view.setUint16(at, value, true);
        at += 2;
      };
      const u32 = (value: number) => {
        view.setUint32(at, value >>> 0, true);
        at += 4;
      };

      u32(signature);
      if (central) {
        u16(20); // version made by
      }
      u16(20); // version needed
      u16(0x0800); // UTF-8 names
      u16(deflated ? 8 : 0);
      u16(0); // time
      u16(0x21); // date: 1980-01-01
      u32(crc);
      u32(body.length);
      u32(entry.data.length);
      u16(name.length);
      u16(0); // extra field
      if (central) {
        u16(0); // comment
        u16(0); // disk
        u16(0); // internal attributes
        u32(0); // external attributes
        u32(offset);
      }
      new Uint8Array(view.buffer).set(name, size);

      return new Uint8Array(view.buffer);
    };
    const local = header(0x04034b50, false);

    centrals.push(header(0x02014b50, true));
    locals.push(local, body);
    offset += local.length + body.length;
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));

  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  const parts = [...locals, ...centrals, new Uint8Array(end.buffer)];
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;

  parts.forEach((part) => {
    result.set(part, at);
    at += part.length;
  });

  return result;
};

/** The files of a ZIP archive (stored and deflated entries), by path. */
export const readZip = async(bytes: Uint8Array): Promise<Map<string, Uint8Array>> => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;

  // The end of central directory record: within the last 64 KB (a comment may follow it).
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end === -1) {
    throw new Error('Not a ZIP file (no end of central directory).');
  }
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const files = new Map<string, Uint8Array>();

  for (let i = 0; i < count; i += 1) {
    if (view.getUint32(at, true) !== 0x02014b50) {
      throw new Error('Damaged ZIP file (central directory).');
    }
    const method = view.getUint16(at + 10, true);
    const compressedSize = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const localOffset = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const data = bytes.subarray(start, start + compressedSize);

    if (method === 0) {
      files.set(name, data.slice());
    } else if (method === 8) {
      files.set(name, await inflateRaw(data));
    } else {
      throw new Error(`Unsupported ZIP compression (method ${method}) for ${name}.`);
    }
    at += 46 + nameLength + extraLength + commentLength;
  }

  return files;
};
