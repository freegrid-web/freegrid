import { polymerWrap, closest } from './helpers/dom/element';
import { hasOwnProperty } from './helpers/object';
import { stopImmediatePropagation as _stopImmediatePropagation } from './helpers/dom/event';

/** An event as listeners get it: with the element it happened on (`realTarget`; inside a `<hot-table>` too). */
export type ExtendedEvent = Event & {
  realTarget: EventTarget | null;
  isTargetWebComponent: boolean;
  path?: (Element & { shadowRoot?: ShadowRoot | null })[];
};

/** A registered listener. */
type Listener = {
  element: EventTarget;
  event: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- listeners take the event type they listen to
  callback: (event: any) => void;
  callbackProxy: (event: Event) => void;
};

/** The object that keeps the listeners: a grid, a plugin, Walkontable or the manager itself. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a grid, a plugin (`hot`) or Walkontable (`wtTable`), told apart by duck typing
type Context = { eventListeners?: Listener[]; [key: string]: any };

/**
 * Counter which tracks unregistered listeners (useful for detecting memory leaks).
 */
let listenersCounter = 0;

/**
 * Event DOM manager for internal use in FreeGrid.
 *
 * @class EventManager
 * @util
 */
class EventManager {
  /** Whether the grid is inside a `<hot-table>` web component (set by the grid). */
  static isHotTableEnv = false;

  /** The object whose `eventListeners` keep the listeners. */
  context: Context | null;

  // Set when the manager keeps its own listeners.
  declare eventListeners?: Listener[];

  /**
   * @param [context=null] The object whose `eventListeners` keep the listeners (e.g. a grid, which removes
   * them when it is destroyed); the manager itself by default.
   */
  constructor(context: object | null = null) {
    this.context = (context || this) as Context;

    if (!this.context.eventListeners) {
      this.context.eventListeners = [];
    }
  }

  /** The registered listeners. */
  get #listeners(): Listener[] {
    return this.context!.eventListeners!;
  }

  /**
   * Register specified listener (`eventName`) to the element.
   *
   * @param element Target element (an element, the document or the window).
   * @param eventName Event name.
   * @param callback Function which will be called after event occur.
   * @returns Returns function which you can easily call to remove that event
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- listeners take the event type they listen to
  addEventListener(element: EventTarget, eventName: string, callback: (event: any) => void): () => void {
    const { context } = this;

    // A function, not an arrow: `this` is the element.
    function callbackProxy(this: EventTarget, event: Event) {
      callback.call(this, extendEvent(context!, event));
    }

    this.#listeners.push({
      element,
      event: eventName,
      callback,
      callbackProxy,
    });

    element.addEventListener(eventName, callbackProxy, false);
    listenersCounter += 1;

    return () => {
      this.removeEventListener(element, eventName, callback);
    };
  }

  /**
   * Remove the event listener previously registered.
   *
   * @param element Target element.
   * @param eventName Event name.
   * @param [callback] Function to remove from the event target. It must be the same as during registration
   * listener. Without it, every listener of the event is removed.
   */
  removeEventListener(element: EventTarget, eventName: string, callback?: Listener['callback']): void {
    const listeners = this.#listeners;

    for (let len = listeners.length - 1; len >= 0; len -= 1) {
      const tmpEvent = listeners[len];

      if (tmpEvent.event === eventName && tmpEvent.element === element &&
        (!callback || callback === tmpEvent.callback)) {
        listeners.splice(len, 1);
        tmpEvent.element.removeEventListener(tmpEvent.event, tmpEvent.callbackProxy, false);
        listenersCounter -= 1;
      }
    }
  }

  /**
   * Clear all previously registered events.
   *
   * @private
   * @since 0.15.0-beta3
   */
  clearEvents(): void {
    if (!this.context) {
      return;
    }
    const listeners = this.#listeners;

    for (let len = listeners.length - 1; len >= 0; len -= 1) {
      const event = listeners[len];

      if (event) {
        this.removeEventListener(event.element, event.event, event.callback);
      }
    }
  }

  /**
   * Clear all previously registered events.
   */
  clear(): void {
    this.clearEvents();
  }

  /**
   * Destroy instance of EventManager.
   */
  destroy(): void {
    this.clearEvents();
    this.context = null;
  }

  /**
   * Trigger event at the specified target element.
   *
   * @param element Target element.
   * @param eventName Event name.
   */
  fireEvent(element: Element, eventName: string): void {
    const options = {
      bubbles: true,
      cancelable: (eventName !== 'mousemove'),
      view: window,
      detail: 0,
      screenX: 0,
      screenY: 0,
      clientX: 1,
      clientY: 1,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      button: 0,
      relatedTarget: undefined,
    };
    const event = document.createEvent('MouseEvents');

    event.initMouseEvent(eventName, options.bubbles, options.cancelable,
      options.view, options.detail,
      options.screenX, options.screenY, options.clientX, options.clientY,
      options.ctrlKey, options.altKey, options.shiftKey, options.metaKey,
      options.button, (options.relatedTarget || document.body.parentNode) as EventTarget);

    element.dispatchEvent(event);
  }
}

/**
 * The event with `realTarget` (the element it happened on, also inside a `<hot-table>` web component) and a
 * `stopImmediatePropagation()` that FreeGrid's handlers see too.
 *
 * @private
 */
const extendEvent = (context: Context, nativeEvent: Event): ExtendedEvent => {
  const componentName = 'HOT-TABLE';
  let event = nativeEvent as ExtendedEvent;
  let isHotTableSpotted = false;
  let fromElement: Element | null = null;
  let target: EventTarget | null | undefined;

  event.isTargetWebComponent = false;
  event.realTarget = event.target;

  const nativeStopImmediatePropagation = event.stopImmediatePropagation;

  event.stopImmediatePropagation = function stopImmediatePropagation(this: Event) {
    nativeStopImmediatePropagation.apply(this);
    _stopImmediatePropagation(this);
  };

  if (!EventManager.isHotTableEnv) {
    return event;
  }
  event = polymerWrap(event) as ExtendedEvent;

  const path = event.path || [];

  for (let len = path.length - 1; len >= 0; len -= 1) {
    if (path[len].nodeName === componentName) {
      isHotTableSpotted = true;

    } else if (isHotTableSpotted && path[len].shadowRoot) {
      target = path[len];

      break;
    }
    if (len === 0 && !target) {
      target = path[len];
    }
  }
  if (!target) {
    target = event.target;
  }
  event.isTargetWebComponent = true;

  // Native Shadow DOM v0 no longer exists, so FreeGrid resolves the real target itself.
  if (hasOwnProperty(context, 'hot') || context.isHotTableEnv || context.wtTable) {
    // Polymer doesn't support `event.target` property properly we must emulate it ourselves
    if (hasOwnProperty(context, 'hot')) {
      // Custom element
      fromElement = context.hot ? context.hot.view.wt.wtTable.TABLE : null;

    } else if (context.isHotTableEnv) {
      // FreeGrid.Core
      fromElement = context.view.activeWt.wtTable.TABLE.parentNode.parentNode;

    } else if (context.wtTable) {
      // Walkontable
      fromElement = context.wtTable.TABLE.parentNode.parentNode;
    }
    const realTarget = closest(event.target as Node, [componentName], fromElement);

    if (realTarget) {
      event.realTarget = fromElement!.querySelector(componentName) || event.target;
    } else {
      event.realTarget = event.target;
    }
  }

  Object.defineProperty(event, 'target', {
    get() {
      return polymerWrap(target);
    },
    enumerable: true,
    configurable: true,
  });

  return event;
};

export default EventManager;

/** How many listeners are registered and not removed (useful for detecting memory leaks). */
export const getListenersCounter = (): number => listenersCounter;
