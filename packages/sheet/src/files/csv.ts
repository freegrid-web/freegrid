/** CSV (RFC 4180): values separated by a delimiter, quoted when they need it, rows ended by CRLF. */

const needsQuotes = (text: string, delimiter: string): boolean => text.indexOf(delimiter) !== -1 ||
  /["\r\n]/.test(text) || /^\s|\s$/.test(text);

/** Rows of values as CSV text. */
export const toCsv = (rows: unknown[][], delimiter = ','): string => rows.map(row => row.map((value) => {
  const text = value === null || value === void 0 ? '' : String(value);

  return needsQuotes(text, delimiter) ? `"${text.replace(/"/g, '""')}"` : text;
}).join(delimiter)).join('\r\n');

/** The delimiter of CSV text: the one of `,`, `;` and tab found most often in its first line (outside quotes). */
export const guessDelimiter = (text: string): string => {
  const firstLine = text.replace(/"(?:[^"]|"")*"/g, '').split(/\r?\n/)[0] || '';
  const counts = [',', ';', '\t'].map(delimiter => [delimiter, firstLine.split(delimiter).length - 1] as const);

  return counts.sort((a, b) => b[1] - a[1])[0][1] > 0 ? counts[0][0] : ',';
};

/** CSV text as rows of text values. */
export const parseCsv = (text: string, delimiter = guessDelimiter(text)): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];

    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        value += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"' && value === '') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(value);
      value = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') {
        i += 1;
      }
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }
  if (value !== '' || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows;
};
