import BasePlugin from './../_base';
import type { PluginHost } from './../_base';
import EventManager from './../../eventManager';
import { registerPlugin } from './../../plugins';

/** Called with how far the mouse is outside the boundaries, horizontally and vertically (negative: left or above). */
type ScrollCallback = (diffX: number, diffY: number) => void;

/**
 * @description
 * Plugin used to scroll FreeGrid by selecting a cell and dragging outside of the visible viewport.
 *
 *
 * @class DragToScroll
 * @plugin DragToScroll
 */
class DragToScroll extends BasePlugin {
  /**
   * Instance of {@link EventManager}.
   *
   * @private
   */
  eventManager: EventManager;

  /**
   * Size of an element and its position relative to the viewport,
   * e.g. {bottom: 449, height: 441, left: 8, right: 814, top: 8, width: 806, x: 8, y:8}.
   */
  boundaries: DOMRect | null = null;

  /**
   * Callback function.
   *
   * @private
   */
  callback: ScrollCallback | null = null;

  /**
   * Flag indicates mouseDown/mouseUp.
   *
   * @private
   */
  listening = false;

  constructor(hotInstance: PluginHost) {
    super(hotInstance);
    this.eventManager = new EventManager(this);
  }

  /**
   * Checks if the plugin is enabled in the FreeGrid settings. This method is executed in {@link Hooks#beforeInit}
   * hook and if it returns `true` than the {@link DragToScroll#enablePlugin} method is called.
   */
  isEnabled(): boolean {
    return !!this.hot.getSettings().dragToScroll;
  }

  /**
   * Enables the plugin functionality for this FreeGrid instance.
   */
  enablePlugin(): void {
    if (this.enabled) {
      return;
    }

    this.addHook('afterOnCellMouseDown', () => this.setupListening());
    this.addHook('afterOnCellCornerMouseDown', () => this.setupListening());

    this.registerEvents();

    super.enablePlugin();
  }

  /**
   * Updates the plugin state. This method is executed when {@link Core#updateSettings} is invoked.
   */
  updatePlugin(): void {
    this.disablePlugin();
    this.enablePlugin();

    super.updatePlugin();
  }

  /**
   * Disables the plugin functionality for this FreeGrid instance.
   */
  disablePlugin(): void {
    this.unregisterEvents();

    super.disablePlugin();
  }

  /**
   * Sets the value of the visible element.
   *
   * @param boundaries An object with coordinates compatible with DOMRect.
   */
  setBoundaries(boundaries: DOMRect): void {
    this.boundaries = boundaries;
  }

  /**
   * Changes callback function.
   *
   * @param callback Called with the distance of the mouse from the boundaries, horizontally and vertically.
   */
  setCallback(callback: ScrollCallback): void {
    this.callback = callback;
  }

  /**
   * Checks if the mouse position (X, Y) is outside of the viewport and fires a callback with calculated X an Y diffs
   * between passed boundaries.
   *
   * @param x Mouse X coordinate to check.
   * @param y Mouse Y coordinate to check.
   */
  check(x: number, y: number): void {
    const { top, bottom, left, right } = this.boundaries as DOMRect;
    let diffX = 0;
    let diffY = 0;

    if (y < top) {
      diffY = y - top;
    } else if (y > bottom) {
      diffY = y - bottom;
    }

    if (x < left) {
      diffX = x - left;
    } else if (x > right) {
      diffX = x - right;
    }

    this.callback?.(diffX, diffY);
  }

  /**
   * Registers dom listeners.
   *
   * @private
   */
  registerEvents(): void {
    this.eventManager.addEventListener(document, 'mouseup', () => this.onMouseUp());
    this.eventManager.addEventListener(document, 'mousemove', (event: MouseEvent) => this.onMouseMove(event));
  }

  /**
   * Unbinds the events used by the plugin.
   *
   * @private
   */
  unregisterEvents(): void {
    this.eventManager.clear();
  }

  /**
   * On after on cell/cellCorner mouse down listener: scrolls the grid while the mouse is outside it.
   *
   * @private
   */
  setupListening(): void {
    const scrollHandler: HTMLElement = this.hot.view.wt.wtTable.holder;

    // The window scrolls: nothing to do.
    if ((scrollHandler as unknown) === window) {
      return;
    }

    this.setBoundaries(scrollHandler.getBoundingClientRect());
    this.setCallback((scrollX, scrollY) => {
      scrollHandler.scrollLeft += Math.sign(scrollX) * 50;
      scrollHandler.scrollTop += Math.sign(scrollY) * 20;
    });

    this.listening = true;
  }

  /**
   * 'mouseMove' event callback.
   *
   * @private
   * @param event `mousemove` event properties.
   */
  onMouseMove(event: MouseEvent): void {
    if (this.listening) {
      this.check(event.clientX, event.clientY);
    }
  }

  /**
   * `onMouseUp` hook callback.
   *
   * @private
   */
  onMouseUp(): void {
    this.listening = false;
  }

  /**
   * Destroys the plugin instance.
   */
  destroy(): void {
    super.destroy();
  }
}

registerPlugin('dragToScroll', DragToScroll);

export default DragToScroll;
