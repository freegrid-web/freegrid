import { addClass, removeClass } from './../../helpers/dom/element';
import BasePlugin from './../_base';
import { registerPlugin } from './../../plugins';
import { isTouchSupported } from './../../helpers/feature';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Walkontable is not typed yet
type Overlay = any;

/**
 * @private
 * @plugin TouchScroll
 * @class TouchScroll
 *
 * On touch devices: hides the fixed parts of the grid (the overlays) while the grid scrolls with momentum, and shows
 * them again, in place, when it stops.
 */
class TouchScroll extends BasePlugin {
  /** The overlays to put in place after scrolling. */
  scrollbars: Overlay[] = [];

  /** The overlays' elements to hide while scrolling. */
  clones: HTMLElement[] = [];

  /** Whether `scrollbars` and `clones` are filled (they are filled again after the settings change). */
  lockedCollection = false;

  /** Whether Walkontable keeps the overlays in place while scrolling. */
  freezeOverlays = false;

  /**
   * Check if plugin is enabled.
   */
  isEnabled(): boolean {
    return isTouchSupported();
  }

  /**
   * Enable the plugin.
   */
  enablePlugin(): void {
    if (this.enabled) {
      return;
    }

    this.addHook('afterRender', () => this.onAfterRender());
    this.registerEvents();

    super.enablePlugin();
  }

  /**
   * Updates the plugin to use the latest options you have specified.
   */
  updatePlugin(): void {
    this.lockedCollection = false;

    super.updatePlugin();
  }

  /**
   * Disable plugin for this FreeGrid instance.
   */
  disablePlugin(): void {
    super.disablePlugin();
  }

  /**
   * Register all necessary events.
   *
   * @private
   */
  registerEvents(): void {
    this.addHook('beforeTouchScroll', () => this.onBeforeTouchScroll());
    this.addHook('afterMomentumScroll', () => this.onAfterMomentumScroll());
  }

  /**
   * After render listener: collects the overlays (once).
   *
   * @private
   */
  onAfterRender(): void {
    if (this.lockedCollection) {
      return;
    }
    const { topOverlay, bottomOverlay, leftOverlay, topLeftCornerOverlay, bottomLeftCornerOverlay } =
      this.hot.view.wt.wtOverlays;
    const element = (overlay: Overlay): HTMLElement => overlay.clone.wtTable.holder.parentNode;

    this.lockedCollection = true;
    this.scrollbars = [
      topOverlay,
      ...(bottomOverlay.clone ? [bottomOverlay] : []),
      leftOverlay,
      ...(topLeftCornerOverlay ? [topLeftCornerOverlay] : []),
      ...(bottomLeftCornerOverlay?.clone ? [bottomLeftCornerOverlay] : []),
    ];
    this.clones = [
      ...[topOverlay, bottomOverlay, leftOverlay].filter(overlay => overlay.needFullRender).map(element),
      ...(topLeftCornerOverlay ? [element(topLeftCornerOverlay)] : []),
      ...(bottomLeftCornerOverlay?.clone ? [element(bottomLeftCornerOverlay)] : []),
    ];
  }

  /**
   * Touch scroll listener.
   *
   * @private
   */
  onBeforeTouchScroll(): void {
    this.freezeOverlays = true;
    this.clones.forEach(clone => addClass(clone, 'hide-tween'));
  }

  /**
   * After momentum scroll listener.
   *
   * @private
   */
  onAfterMomentumScroll(): void {
    this.freezeOverlays = false;

    this.clones.forEach((clone) => {
      removeClass(clone, 'hide-tween');
      addClass(clone, 'show-tween');
    });

    setTimeout(() => {
      this.clones.forEach(clone => removeClass(clone, 'show-tween'));
    }, 400);

    this.scrollbars.forEach((scrollbar) => {
      scrollbar.refresh();
      scrollbar.resetFixedPosition();
    });

    this.hot.view.wt.wtOverlays.syncScrollWithMaster();
  }
}

registerPlugin('touchScroll', TouchScroll);

export default TouchScroll;
