/**
 * Replacing the content of elements quickly.
 */

/**
 * Removes the text nodes (whitespace) between table elements, recursively from `element`.
 */
export const removeTextNodes = (element: Node, parent: Node): void => {
  if (element.nodeType === 3) {
    parent.removeChild(element);

  } else if (['TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR'].indexOf(element.nodeName) > -1) {
    const children = element.childNodes;

    for (let i = children.length - 1; i >= 0; i--) {
      removeTextNodes(children[i], element);
    }
  }
};

/**
 * Removes all children of the element (faster than `innerHTML = ''`).
 */
export const empty = (element: Node): void => {
  let child = element.lastChild;

  while (child) {
    element.removeChild(child);
    child = element.lastChild;
  }
};

export const HTML_CHARACTERS = /(<(.*)>|&(.*);)/;

/**
 * Sets the content as HTML when it contains tags or entities, otherwise as text (faster).
 */
export const fastInnerHTML = (element: Element, content: string): void => {
  if (HTML_CHARACTERS.test(content)) {
    element.innerHTML = content;
  } else {
    fastInnerText(element, content);
  }
};

/**
 * Sets the text content, reusing the existing single text node when there is one.
 */
export const fastInnerText = (element: Node, content: string): void => {
  const child = element.firstChild;

  if (child && child.nodeType === 3 && child.nextSibling === null) {
    // fast lane - replace existing text node
    child.textContent = content;
  } else {
    // slow lane - empty element and insert a text node
    empty(element);
    element.appendChild(document.createTextNode(content));
  }
};
