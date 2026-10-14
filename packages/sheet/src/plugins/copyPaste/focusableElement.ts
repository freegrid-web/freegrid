import EventManager from './../../eventManager';
import localHooks from './../../mixins/localHooks';
import type { LocalHooks } from './../../mixins/localHooks';
import { mixin } from './../../helpers/object';
import { isMobileBrowser } from './../../helpers/browser';

/** The element that gets the keyboard focus, so that the browser's copy, cut and paste events reach the grid. */
type Focusable = HTMLTextAreaElement | HTMLInputElement;

/** How many wrappers exist: the shared secondary element is removed with the last one. */
let refCounter = 0;

/** The shared textarea used when the grid has no element to focus. */
let secondaryElement: HTMLTextAreaElement | null = null;

/** Runs the wrapper's local hook `eventName` with the event. */
const runLocalHooks = (eventName: string, subject: FocusableWrapper) => (event: Event) => subject.runLocalHooks(eventName, event);

/**
 * Register copy/cut/paste events and forward their actions to the subject local hooks system.
 */
const forwardEventsToLocalHooks = (eventManager: EventManager, element: Focusable, subject: FocusableWrapper): void => {
  ['copy', 'cut', 'paste'].forEach((eventName) => {
    eventManager.addEventListener(element, eventName, runLocalHooks(eventName, subject));
  });
};

/**
 * Create and attach newly created focusable element to the DOM.
 */
const createOrGetSecondaryElement = (): HTMLTextAreaElement => {
  if (secondaryElement) {
    if (!secondaryElement.parentElement) {
      document.body.appendChild(secondaryElement);
    }

    return secondaryElement;
  }
  const element = document.createElement('textarea');

  secondaryElement = element;
  element.id = 'HandsontableCopyPaste';
  element.className = 'copyPaste';
  element.tabIndex = -1;
  element.autocomplete = 'off';
  element.wrap = 'hard';
  element.value = ' ';

  document.body.appendChild(element);

  return element;
};

/**
 * @class FocusableWrapper
 *
 * @plugin CopyPaste
 *
 * The element that gets the keyboard focus for copy and paste: the editor's textarea, or a shared hidden one. Its
 * copy, cut and paste events run the `copy`, `cut` and `paste` local hooks.
 */
class FocusableWrapper {
  // From the localHooks mixin (on the prototype): `declare` keeps class fields from hiding them.
  declare addLocalHook: LocalHooks['addLocalHook'];

  declare runLocalHooks: LocalHooks['runLocalHooks'];

  declare clearLocalHooks: LocalHooks['clearLocalHooks'];

  /**
   * The main/operational focusable element.
   */
  mainElement: Focusable | null = null;

  /**
   * Instance of EventManager.
   */
  eventManager = new EventManager(this);

  /**
   * The elements whose events are forwarded already.
   */
  listenersCount = new WeakSet<Focusable>();

  /**
   * Switch to the secondary focusable element. Used when no any main focusable element is provided.
   */
  useSecondaryElement(): void {
    this.setFocusableElement(createOrGetSecondaryElement());
  }

  /**
   * Switch to the main focusable element.
   */
  setFocusableElement(element: Focusable): void {
    if (!this.listenersCount.has(element)) {
      this.listenersCount.add(element);
      forwardEventsToLocalHooks(this.eventManager, element, this);
    }

    this.mainElement = element;
  }

  /**
   * Get currently set focusable element.
   */
  getFocusableElement(): Focusable | null {
    return this.mainElement;
  }

  /**
   * Set focus to the focusable element.
   */
  focus(): void {
    // A space in the element: Safari enables "Copy" in its menu bar only then.
    this.mainElement!.value = ' ';

    if (!isMobileBrowser()) {
      this.mainElement!.select();
    }
  }
}

mixin(FocusableWrapper, localHooks);

/**
 * Create and return the FocusableWrapper instance.
 */
export const createElement = (): FocusableWrapper => {
  refCounter += 1;

  return new FocusableWrapper();
};

/**
 * Deactivate the FocusableWrapper instance.
 */
export const deactivateElement = (wrapper: FocusableWrapper): void => {
  wrapper.eventManager.clear();
};

/**
 * Destroy the FocusableWrapper instance (the last one also removes the secondary element).
 */
export const destroyElement = (wrapper: unknown): void => {
  if (!(wrapper instanceof FocusableWrapper)) {
    return;
  }
  if (refCounter > 0) {
    refCounter -= 1;
  }

  deactivateElement(wrapper);

  if (refCounter <= 0) {
    refCounter = 0;

    // Detach secondary element from the DOM.
    if (secondaryElement?.parentNode) {
      secondaryElement.parentNode.removeChild(secondaryElement);
      secondaryElement = null;
    }
    wrapper.mainElement = null;
  }
};

export type { FocusableWrapper };
