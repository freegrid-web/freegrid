/**
 * Walking the DOM tree: parents, ancestors and positions. Shadow DOM boundaries are crossed through `host`.
 */

// Globals of the legacy Polymer polyfill, present only when a page loads it.
declare const Polymer: unknown;
declare const wrap: ((node: unknown) => unknown) | undefined;
declare const unwrap: ((node: unknown) => unknown) | undefined;

// Nodes as the JavaScript callers pass them: any node, or a shadow root (a document fragment with a `host`).
type TreeNode = (Node & { host?: TreeNode }) | null;

const isShadowRoot = (node: NonNullable<TreeNode>): boolean => !!node.host && node.nodeType === Node.DOCUMENT_FRAGMENT_NODE;

/**
 * Returns the ancestor `level` steps up (0: the parent), crossing shadow roots; `null` when there is none.
 */
export const getParent = (element: TreeNode, level = 0): TreeNode => {
  let iteration = -1;
  let elementToCheck = element;

  while (elementToCheck !== null) {
    if (iteration === level) {
      return elementToCheck;
    }

    if (isShadowRoot(elementToCheck)) {
      elementToCheck = elementToCheck.host ?? null;

    } else {
      iteration += 1;
      elementToCheck = elementToCheck.parentNode;
    }
  }

  return null;
};

/**
 * Returns the element itself or its closest ancestor (below `until`) that matches one of `nodes`: a node name
 * (`'TD'`) or a node object.
 */
export const closest = (element: TreeNode, nodes: ReadonlyArray<string | Node>, until?: Node | null): TreeNode => {
  let elementToCheck = element;

  while (elementToCheck !== null && elementToCheck !== until) {
    if (elementToCheck.nodeType === Node.ELEMENT_NODE &&
        (nodes.indexOf(elementToCheck.nodeName) > -1 || nodes.indexOf(elementToCheck) > -1)) {
      return elementToCheck;
    }
    if (isShadowRoot(elementToCheck)) {
      elementToCheck = elementToCheck.host ?? null;

    } else {
      elementToCheck = elementToCheck.parentNode;
    }
  }

  return null;
};

/**
 * Like `closest`, but returns the outermost match inside `until`.
 */
export const closestDown = (element: TreeNode, nodes: ReadonlyArray<string | Node>, until?: Node | null): TreeNode => {
  const matched: Array<NonNullable<TreeNode>> = [];
  let elementToCheck = element;

  while (elementToCheck) {
    elementToCheck = closest(elementToCheck, nodes, until);

    if (!elementToCheck || (until && !until.contains(elementToCheck))) {
      break;
    }
    matched.push(elementToCheck);

    if (isShadowRoot(elementToCheck)) {
      elementToCheck = elementToCheck.host ?? null;

    } else {
      elementToCheck = elementToCheck.parentNode;
    }
  }
  const length = matched.length;

  return length ? matched[length - 1] : null;
};

/**
 * Checks if `child` is inside `parent`: a node, or a CSS selector matching any of the ancestors.
 */
export const isChildOf = (child: Node, parent: Node | string): boolean => {
  let node = child.parentNode;
  const queriedParents: Node[] = typeof parent === 'string' ? Array.from(document.querySelectorAll(parent)) : [parent];

  while (node !== null) {
    if (queriedParents.indexOf(node) > -1) {
      return true;
    }
    node = node.parentNode;
  }

  return false;
};

/**
 * Checks if the element is inside a `<hot-table>` web component (the legacy Polymer wrapper).
 */
export const isChildOfWebComponentTable = (element: TreeNode): boolean => {
  const hotTableName = 'hot-table';
  let result = false;
  let parentNode = polymerWrap(element);

  const isHotTable = (testElement: Node): boolean =>
    testElement.nodeType === Node.ELEMENT_NODE && testElement.nodeName === hotTableName.toUpperCase();

  while (parentNode !== null) {
    if (isHotTable(parentNode)) {
      result = true;
      break;
    } else if (parentNode.host && parentNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      result = isHotTable(parentNode.host);

      if (result) {
        break;
      }
      parentNode = parentNode.host;
    }
    parentNode = parentNode.parentNode;
  }

  return result;
};

/**
 * Wraps a node with Polymer's `wrap()` when the Polymer polyfill is loaded; otherwise returns it unchanged.
 */
export const polymerWrap = <T>(element: T): T => (typeof Polymer !== 'undefined' && typeof wrap === 'function' ? wrap(element) as T : element);

/**
 * Unwraps a node with Polymer's `unwrap()` when the Polymer polyfill is loaded; otherwise returns it unchanged.
 */
export const polymerUnwrap = <T>(element: T): T => (typeof Polymer !== 'undefined' && typeof unwrap === 'function' ? unwrap(element) as T : element);

/**
 * Returns the position of the node among its siblings (text nodes included).
 */
export const index = (element: Node): number => {
  let i = 0;
  let elementToCheck: Node | null = element.previousSibling;

  while (elementToCheck) {
    i += 1;
    elementToCheck = elementToCheck.previousSibling;
  }

  return i;
};

/**
 * Checks if the element is inside the overlay clone of the given type (`'top'`, `'left'`, `'top_left_corner'`, …);
 * `null` when that overlay does not exist.
 */
export const overlayContainsElement = (overlayType: string, element: Node): boolean | null => {
  const overlayElement = document.querySelector(`.fs-clone-${overlayType.replace(/_/g, '-')}`);

  return overlayElement ? overlayElement.contains(element) : null;
};
