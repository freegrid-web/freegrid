import { isEmpty } from './../../helpers/mixed';
import { formatToCss, type CellFormat } from './formats';

/**
 * Converts javascript array into HTMLTable.
 *
 * @param input Input array which will be converted to HTMLTable
 * @param formats The cells' formatting (bold, colors, alignment), written as inline styles.
 * @returns `<table><tbody><tr><td>…` with the values as text (HTML escaped).
 */
export const arrayToTable = (input: unknown[][], formats?: CellFormat[][]): string => {
  const result = ['<table>'];
  // Escapes the values: an element's innerHTML after setting its innerText.
  const tempElement = document.createElement('div');

  document.documentElement.appendChild(tempElement);

  input.forEach((rowData, row) => {
    if (row === 0) {
      result.push('<tbody>');
    }
    const columnsResult = rowData.map((value, column) => {
      tempElement.innerText = `${isEmpty(value) ? '' : value}`;
      // The formatting as an inline style (made of known properties and normalized colors only).
      const css = formats?.[row]?.[column] ? formatToCss(formats[row][column]) : '';

      return css ? `<td style="${css}">${tempElement.innerHTML}</td>` : `<td>${tempElement.innerHTML}</td>`;
    });

    result.push('<tr>', ...columnsResult, '</tr>');

    if (row + 1 === input.length) {
      result.push('</tbody>');
    }
  });

  document.documentElement.removeChild(tempElement);

  result.push('</table>');

  return result.join('');
};

/**
 * Helper to verify if DOM element is an HTMLTable element.
 */
const isHTMLTable = (element: unknown): element is HTMLTableElement => (
  ((element as Element | null)?.nodeName || '').toLowerCase() === 'table');

/**
 * The text of a pasted cell, read from its nodes (no HTML is written anywhere): the first `<br>` is a new line (and
 * a new line right after it is dropped), other tags are dropped, and the whitespace around the cell's content (in its
 * first and last text nodes) is trimmed.
 */
const cellText = (cell: HTMLTableCellElement): string => {
  const parts: string[] = [];
  const walker = cell.ownerDocument.createTreeWalker(cell, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let brFound = false;
  let afterBr = false;

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) {
      let text = (node as Text).data;

      if (node === cell.firstChild) {
        text = text.trimStart();
      }
      if (node === cell.lastChild) {
        text = text.trimEnd();
      }
      parts.push(afterBr ? text.replace(/^\n/, '') : text);
      afterBr = false;
    } else if (node.nodeName === 'BR' && !brFound) {
      brFound = true;
      afterBr = true;
      parts.push('\n');
    } else {
      afterBr = false;
    }
  }

  return parts.join('');
};

/**
 * Converts HTMLTable or string into array.
 *
 * @param element Node element or string, which should contain `<table>...</table>`.
 * @returns The cells' text, by rows (a `<br>` is a new line).
 */
export const tableToArray = (element: Element | string | null): string[][] => {
  let checkElement: Element | null = element as Element | null;

  if (typeof element === 'string') {
    // A parsed document is inert: pasted HTML runs no code and loads nothing (`innerHTML` of an element would, e.g.
    // an image's `onerror`).
    checkElement = new DOMParser().parseFromString(element.replace(/\n/g, ''), 'text/html').querySelector('table');
  }

  if (!isHTMLTable(checkElement)) {
    return [];
  }

  return Array.from(checkElement.rows, row => Array.from(row.cells, cellText));
};
