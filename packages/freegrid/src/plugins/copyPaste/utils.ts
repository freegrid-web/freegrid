import { isEmpty } from './../../helpers/mixed';

/**
 * Converts javascript array into HTMLTable.
 *
 * @param input Input array which will be converted to HTMLTable
 * @returns `<table><tbody><tr><td>…` with the values as text (HTML escaped).
 */
export const arrayToTable = (input: unknown[][]): string => {
  const result = ['<table>'];
  // Escapes the values: an element's innerHTML after setting its innerText.
  const tempElement = document.createElement('div');

  document.documentElement.appendChild(tempElement);

  input.forEach((rowData, row) => {
    if (row === 0) {
      result.push('<tbody>');
    }
    const columnsResult = rowData.map((value) => {
      tempElement.innerText = `${isEmpty(value) ? '' : value}`;

      return `<td>${tempElement.innerHTML}</td>`;
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
 * Converts HTMLTable or string into array.
 *
 * @param element Node element or string, which should contain `<table>...</table>`.
 * @returns The cells' text, by rows (a `<br>` is a new line).
 */
export const tableToArray = (element: Element | string | null): string[][] => {
  let checkElement: Element | null = element as Element | null;

  if (typeof element === 'string') {
    const tempElem = document.createElement('div');

    tempElem.innerHTML = element.replace(/\n/g, '');
    checkElement = tempElem.querySelector('table');
  }

  if (!isHTMLTable(checkElement)) {
    return [];
  }

  return Array.from(checkElement.rows, row => Array.from(row.cells, (cell) => {
    cell.innerHTML = cell.innerHTML.trim().replace(/<br(.|)>(\n?)/, '\n');

    return cell.innerText;
  }));
};
