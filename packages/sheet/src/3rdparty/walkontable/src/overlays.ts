import type { OverlayEngine } from './overlay/types';
import type Walkontable from './core';
import type TopOverlay from './overlay/top';
import type LeftOverlay from './overlay/left';
import type BottomOverlay from './overlay/bottom';
import type TopLeftCornerOverlay from './overlay/topLeftCorner';
import type BottomLeftCornerOverlay from './overlay/bottomLeftCorner';
import type DebugOverlay from './overlay/debug';
import type { ExtendedEvent } from '../../../eventManager';

/** Old wheel properties are still read for callers which supply synthetic events. */
type OverlayEvent = ExtendedEvent & {
  target: Node | Window;
  realTarget: Node;
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  wheelDeltaX: number;
  wheelDeltaY: number;
  keyCode: number;
};
type Listener = [EventTarget, string, (event: OverlayEvent) => void];
type DisabledOverlay = { needFullRender: false; updateStateOfRendering(): false; clone?: undefined };

import {
  getScrollableElement,
  getScrollbarWidth,
} from './../../../helpers/dom/element';
import { arrayEach } from './../../../helpers/array';
import { isKey } from './../../../helpers/unicode';
import { isChrome } from './../../../helpers/browser';
import EventManager from './../../../eventManager';
import Overlay from './overlay/_base';

/**
 * @class Overlays
 */
class Overlays {
  #engine: OverlayEngine;
  declare instance: OverlayEngine;
  #eventManager: EventManager;
  declare scrollableElement: HTMLElement | Window;
  declare topOverlay: TopOverlay;
  declare leftOverlay: LeftOverlay;
  declare bottomOverlay: BottomOverlay | DisabledOverlay;
  declare topLeftCornerOverlay?: TopLeftCornerOverlay;
  declare bottomLeftCornerOverlay?: BottomLeftCornerOverlay | DisabledOverlay;
  declare debug?: DebugOverlay;
  #destroyed: boolean;
  #keyPressed: boolean;
  #spreaderLastSize: { width: number | null; height: number | null };
  #verticalScrolling: boolean;
  #horizontalScrolling: boolean;
  #registeredListeners: Listener[];
  #browserLineHeight: number;

  /**
   * @param {Walkontable} wotInstance
   */
  constructor(wotInstance: Walkontable) {
    /**
     * Sometimes `line-height` might be set to 'normal'. In that case, a default `font-size` should be multiplied by roughly 1.2.
     * https://developer.mozilla.org/pl/docs/Web/CSS/line-height#Values
     */
    const BODY_LINE_HEIGHT = parseInt(getComputedStyle(document.body).lineHeight, 10);
    const FALLBACK_BODY_LINE_HEIGHT = parseInt(getComputedStyle(document.body).fontSize, 10) * 1.2;

    this.#engine = wotInstance as unknown as OverlayEngine;

    // legacy support
    this.instance = this.#engine;
    this.#eventManager = new EventManager(this.#engine);

    this.#engine.update('scrollbarWidth', getScrollbarWidth());
    this.#engine.update('scrollbarHeight', getScrollbarWidth());

    this.scrollableElement = getScrollableElement(this.#engine.wtTable.TABLE);

    this.prepareOverlays();

    this.#destroyed = false;
    this.#keyPressed = false;
    this.#spreaderLastSize = {
      width: null,
      height: null,
    };


    this.#verticalScrolling = false;
    this.#horizontalScrolling = false;

    this.#registeredListeners = [];

    this.#browserLineHeight = BODY_LINE_HEIGHT || FALLBACK_BODY_LINE_HEIGHT;

    this.registerListeners();
  }

  /**
   * Prepare overlays based on user settings.
   *
   * @returns {Boolean} Returns `true` if changes applied to overlay needs scroll synchronization.
   */
  prepareOverlays() {
    let syncScroll = false;

    if (this.topOverlay) {
      syncScroll = this.topOverlay.updateStateOfRendering() || syncScroll;
    } else {
      this.topOverlay = Overlay.createOverlay<TopOverlay>(Overlay.CLONE_TOP, this.#engine);
    }

    if (!Overlay.hasOverlay(Overlay.CLONE_BOTTOM)) {
      this.bottomOverlay = {
        needFullRender: false,
        updateStateOfRendering: () => false,
      };
    }
    if (!Overlay.hasOverlay(Overlay.CLONE_BOTTOM_LEFT_CORNER)) {
      this.bottomLeftCornerOverlay = {
        needFullRender: false,
        updateStateOfRendering: () => false,
      };
    }

    if (this.bottomOverlay) {
      syncScroll = this.bottomOverlay.updateStateOfRendering() || syncScroll;
    } else {
      this.bottomOverlay = Overlay.createOverlay<BottomOverlay>(Overlay.CLONE_BOTTOM, this.#engine);
    }

    if (this.leftOverlay) {
      syncScroll = this.leftOverlay.updateStateOfRendering() || syncScroll;
    } else {
      this.leftOverlay = Overlay.createOverlay<LeftOverlay>(Overlay.CLONE_LEFT, this.#engine);
    }

    if (this.topOverlay.needFullRender && this.leftOverlay.needFullRender) {
      if (this.topLeftCornerOverlay) {
        syncScroll = this.topLeftCornerOverlay.updateStateOfRendering() || syncScroll;
      } else {
        this.topLeftCornerOverlay = Overlay.createOverlay<TopLeftCornerOverlay>(Overlay.CLONE_TOP_LEFT_CORNER, this.#engine);
      }
    }

    if (this.bottomOverlay.needFullRender && this.leftOverlay.needFullRender) {
      if (this.bottomLeftCornerOverlay) {
        syncScroll = this.bottomLeftCornerOverlay.updateStateOfRendering() || syncScroll;
      } else {
        this.bottomLeftCornerOverlay = Overlay.createOverlay<BottomLeftCornerOverlay>(Overlay.CLONE_BOTTOM_LEFT_CORNER, this.#engine);
      }
    }

    if (this.#engine.getSetting('debug') && !this.debug) {
      this.debug = Overlay.createOverlay<DebugOverlay>(Overlay.CLONE_DEBUG, this.#engine);
    }

    return syncScroll;
  }

  /**
   * Refresh and redraw table
   */
  refreshAll() {
    if (!this.#engine.drawn) {
      return;
    }
    if (!this.#engine.wtTable.holder.parentNode) {
      // Walkontable was detached from DOM, but this handler was not removed
      this.destroy();

      return;
    }
    this.#engine.draw(true);

    if (this.#verticalScrolling) {
      this.leftOverlay.onScroll();
    }

    if (this.#horizontalScrolling) {
      this.topOverlay.onScroll();
    }

    this.#verticalScrolling = false;
    this.#horizontalScrolling = false;
  }

  /**
   * Register all necessary event listeners.
   */
  registerListeners() {
    const topOverlayScrollable = this.topOverlay.mainTableScrollableElement;
    const leftOverlayScrollable = this.leftOverlay.mainTableScrollableElement;

    const listenersToRegister: Listener[] = [];
    listenersToRegister.push([document.documentElement, 'keydown', event => this.onKeyDown(event)]);
    listenersToRegister.push([document.documentElement, 'keyup', () => this.onKeyUp()]);
    listenersToRegister.push([document, 'visibilitychange', () => this.onKeyUp()]);
    listenersToRegister.push([topOverlayScrollable, 'scroll', event => this.onTableScroll(event)]);

    if (topOverlayScrollable !== leftOverlayScrollable) {
      listenersToRegister.push([leftOverlayScrollable, 'scroll', event => this.onTableScroll(event)]);
    }

    const isHighPixelRatio = window.devicePixelRatio && window.devicePixelRatio > 1;

    if (isHighPixelRatio || !isChrome()) {
      listenersToRegister.push([this.instance.wtTable.wtRootElement.parentNode, 'wheel', event => this.onCloneWheel(event)]);

    } else {
      if (this.topOverlay.needFullRender) {
        listenersToRegister.push([this.topOverlay.clone.wtTable.holder, 'wheel', event => this.onCloneWheel(event)]);
      }

      if (this.bottomOverlay.needFullRender) {
        listenersToRegister.push([this.bottomOverlay.clone.wtTable.holder, 'wheel', event => this.onCloneWheel(event)]);
      }

      if (this.leftOverlay.needFullRender) {
        listenersToRegister.push([this.leftOverlay.clone.wtTable.holder, 'wheel', event => this.onCloneWheel(event)]);
      }

      if (this.topLeftCornerOverlay && this.topLeftCornerOverlay.needFullRender) {
        listenersToRegister.push([this.topLeftCornerOverlay.clone.wtTable.holder, 'wheel', event => this.onCloneWheel(event)]);
      }

      if (this.bottomLeftCornerOverlay && this.bottomLeftCornerOverlay.needFullRender) {
        listenersToRegister.push([this.bottomLeftCornerOverlay.clone.wtTable.holder, 'wheel', event => this.onCloneWheel(event)]);
      }
    }

    if (this.topOverlay.trimmingContainer !== window && this.leftOverlay.trimmingContainer !== window) {
      // This is necessary?
      // eventManager.addEventListener(window, 'scroll', (event) => this.refreshAll(event));
      listenersToRegister.push([window, 'wheel', (event) => {
        let overlay;
        const deltaY = event.wheelDeltaY || event.deltaY;
        const deltaX = event.wheelDeltaX || event.deltaX;

        if (this.topOverlay.clone.wtTable.holder.contains(event.realTarget)) {
          overlay = 'top';

        } else if (this.bottomOverlay.clone && this.bottomOverlay.clone.wtTable.holder.contains(event.realTarget)) {
          overlay = 'bottom';

        } else if (this.leftOverlay.clone.wtTable.holder.contains(event.realTarget)) {
          overlay = 'left';

        } else if (this.topLeftCornerOverlay && this.topLeftCornerOverlay.clone && this.topLeftCornerOverlay.clone.wtTable.holder.contains(event.realTarget)) {
          overlay = 'topLeft';

        } else if (this.bottomLeftCornerOverlay && this.bottomLeftCornerOverlay.clone && this.bottomLeftCornerOverlay.clone.wtTable.holder.contains(event.realTarget)) {
          overlay = 'bottomLeft';
        }

        if ((overlay === 'top' && deltaY !== 0) ||
          (overlay === 'left' && deltaX !== 0) ||
          (overlay === 'bottom' && deltaY !== 0) ||
          ((overlay === 'topLeft' || overlay === 'bottomLeft') && (deltaY !== 0 || deltaX !== 0))) {

          event.preventDefault();
        }
      }]);
    }

    while (listenersToRegister.length) {
      const listener = listenersToRegister.pop()!;
      this.#eventManager.addEventListener(listener[0], listener[1], listener[2]);

      this.#registeredListeners.push(listener);
    }
  }

  /**
   * Deregister all previously registered listeners.
   */
  deregisterListeners() {
    while (this.#registeredListeners.length) {
      const listener = this.#registeredListeners.pop()!;
      this.#eventManager.removeEventListener(listener[0], listener[1], listener[2]);
    }
  }

  /**
   * Scroll listener
   *
   * @param {Event} event
   */
  onTableScroll(event: OverlayEvent) {
    // There was if statement which controlled flow of this function. It avoided the execution of the next lines
    // on mobile devices. It was changed. Broader description of this case is included within issue #4856.

    const masterHorizontal = this.leftOverlay.mainTableScrollableElement;
    const masterVertical = this.topOverlay.mainTableScrollableElement;
    const target = event.target;

    // For key press, sync only master -> overlay position because while pressing Walkontable.render is triggered
    // by hot.refreshBorder
    if (this.#keyPressed) {
      if ((masterVertical !== window && target !== window && !(event.target as Node).contains(masterVertical as Node)) ||
          (masterHorizontal !== window && target !== window && !(event.target as Node).contains(masterHorizontal as Node))) {
        return;
      }
    }

    (this.syncScrollPositions as (event: OverlayEvent) => void)(event);
  }

  /**
   * Wheel listener for cloned overlays.
   *
   * @param {Event} event
   */
  onCloneWheel(event: OverlayEvent) {
    if (this.scrollableElement !== window) {
      event.preventDefault();
    }
    // There was if statement which controlled flow of this function. It avoided the execution of the next lines
    // on mobile devices. It was changed. Broader description of this case is included within issue #4856.

    const masterHorizontal = this.leftOverlay.mainTableScrollableElement;
    const masterVertical = this.topOverlay.mainTableScrollableElement;
    const target = event.target;

    // For key press, sync only master -> overlay position because while pressing Walkontable.render is triggered
    // by hot.refreshBorder
    const shouldNotWheelVertically = masterVertical !== window && target !== window && !(event.target as Node).contains(masterVertical as Node);
    const shouldNotWheelHorizontally = masterHorizontal !== window && target !== window && !(event.target as Node).contains(masterHorizontal as Node);

    if (this.#keyPressed && (shouldNotWheelVertically || shouldNotWheelHorizontally)) {
      return;
    }

    this.translateMouseWheelToScroll(event);
  }

  /**
   * Key down listener
   */
  onKeyDown(event: OverlayEvent) {
    this.#keyPressed = isKey(event.keyCode, 'ARROW_UP|ARROW_RIGHT|ARROW_DOWN|ARROW_LEFT');
  }

  /**
   * Key up listener
   */
  onKeyUp() {
    this.#keyPressed = false;
  }

  /**
   * Translate wheel event into scroll event and sync scroll overlays position
   *
   * @private
   * @param {Event} event
   * @returns {Boolean}
   */
  translateMouseWheelToScroll(event: OverlayEvent) {
    let deltaY = isNaN(event.deltaY) ? (-1) * event.wheelDeltaY : event.deltaY;
    let deltaX = isNaN(event.deltaX) ? (-1) * event.wheelDeltaX : event.deltaX;

    if (event.deltaMode === 1) {
      deltaX += deltaX * this.#browserLineHeight;
      deltaY += deltaY * this.#browserLineHeight;
    }

    this.scrollVertically(deltaY);
    this.scrollHorizontally(deltaX);

    return false;
  }

  scrollVertically(distance: number) {
    if (distance === 0) {
      return 0;
    }
    (this.scrollableElement as HTMLElement).scrollTop += distance;
  }

  scrollHorizontally(distance: number) {
    if (distance === 0) {
      return 0;
    }
    (this.scrollableElement as HTMLElement).scrollLeft += distance;
  }

  /**
   * Synchronize scroll position between master table and overlay table.
   *
   * @private
   * @param {Event|Object} event
   */
  syncScrollPositions() {
    if (this.#destroyed) {
      return;
    }

    const topHolder = this.topOverlay.clone.wtTable.holder;
    const leftHolder = this.leftOverlay.clone.wtTable.holder;

    const [scrollLeft, scrollTop] = [(this.scrollableElement as HTMLElement).scrollLeft, (this.scrollableElement as HTMLElement).scrollTop];

    this.#horizontalScrolling = topHolder.scrollLeft !== scrollLeft;
    this.#verticalScrolling = leftHolder.scrollTop !== scrollTop;

    if (this.#horizontalScrolling) {
      topHolder.scrollLeft = scrollLeft;

      const bottomHolder = this.bottomOverlay.needFullRender ? this.bottomOverlay.clone.wtTable.holder : null;

      if (bottomHolder) {
        bottomHolder.scrollLeft = scrollLeft;
      }
    }

    if (this.#verticalScrolling) {
      leftHolder.scrollTop = scrollTop;
    }

    this.refreshAll();
  }

  /**
   * Synchronize overlay scrollbars with the master scrollbar
   */
  syncScrollWithMaster() {
    const master = this.topOverlay.mainTableScrollableElement;
    const { scrollLeft, scrollTop } = master as HTMLElement;

    if (this.topOverlay.needFullRender) {
      this.topOverlay.clone.wtTable.holder.scrollLeft = scrollLeft;
    }
    if (this.bottomOverlay.needFullRender) {
      this.bottomOverlay.clone.wtTable.holder.scrollLeft = scrollLeft;
    }
    if (this.leftOverlay.needFullRender) {
      this.leftOverlay.clone.wtTable.holder.scrollTop = scrollTop;
    }
  }

  /**
   * Update the main scrollable elements for all the overlays.
   */
  updateMainScrollableElements() {
    this.deregisterListeners();

    this.leftOverlay.updateMainScrollableElement();
    this.topOverlay.updateMainScrollableElement();

    if (this.bottomOverlay.needFullRender) {
      this.bottomOverlay.updateMainScrollableElement();
    }

    this.scrollableElement = getScrollableElement(this.#engine.wtTable.TABLE);

    this.registerListeners();
  }

  /**
   *
   */
  destroy() {
    this.#eventManager.destroy();
    this.topOverlay.destroy();

    if (this.bottomOverlay.clone) {
      this.bottomOverlay.destroy();
    }
    this.leftOverlay.destroy();

    if (this.topLeftCornerOverlay) {
      this.topLeftCornerOverlay.destroy();
    }

    if (this.bottomLeftCornerOverlay && this.bottomLeftCornerOverlay.clone) {
      this.bottomLeftCornerOverlay.destroy();
    }

    if (this.debug) {
      this.debug.destroy();
    }
    this.#destroyed = true;
  }

  /**
   * @param {Boolean} [fastDraw=false]
   */
  refresh(fastDraw = false) {
    if (this.topOverlay.areElementSizesAdjusted && this.leftOverlay.areElementSizesAdjusted) {
      const container = this.#engine.wtTable.wtRootElement.parentNode || this.#engine.wtTable.wtRootElement;
      const width = container.clientWidth;
      const height = container.clientHeight;

      if (width !== this.#spreaderLastSize.width || height !== this.#spreaderLastSize.height) {
        this.#spreaderLastSize.width = width;
        this.#spreaderLastSize.height = height;
        this.adjustElementsSize();
      }
    }

    if (this.bottomOverlay.clone) {
      this.bottomOverlay.refresh(fastDraw);
    }

    this.leftOverlay.refresh(fastDraw);
    this.topOverlay.refresh(fastDraw);

    if (this.topLeftCornerOverlay) {
      this.topLeftCornerOverlay.refresh(fastDraw);
    }

    if (this.bottomLeftCornerOverlay && this.bottomLeftCornerOverlay.clone) {
      this.bottomLeftCornerOverlay.refresh(fastDraw);
    }

    if (this.debug) {
      this.debug.refresh(fastDraw);
    }
  }

  /**
   * Adjust overlays elements size and master table size
   *
   * @param {Boolean} [force=false]
   */
  adjustElementsSize(force = false) {
    const totalColumns = this.#engine.getSetting('totalColumns');
    const totalRows = this.#engine.getSetting('totalRows');
    const headerRowSize = this.#engine.wtViewport.getRowHeaderWidth();
    const headerColumnSize = this.#engine.wtViewport.getColumnHeaderHeight();
    const hiderStyle = this.#engine.wtTable.hider.style;

    hiderStyle.width = `${headerRowSize + this.leftOverlay.sumCellSizes(0, totalColumns)}px`;
    hiderStyle.height = `${headerColumnSize + this.topOverlay.sumCellSizes(0, totalRows) + 1}px`;

    this.topOverlay.adjustElementsSize(force);
    this.leftOverlay.adjustElementsSize(force);

    if (this.bottomOverlay.clone) {
      this.bottomOverlay.adjustElementsSize(force);
    }
  }

  /**
   *
   */
  applyToDOM() {
    if (!this.topOverlay.areElementSizesAdjusted || !this.leftOverlay.areElementSizesAdjusted) {
      this.adjustElementsSize();
    }
    this.topOverlay.applyToDOM();

    if (this.bottomOverlay.clone) {
      this.bottomOverlay.applyToDOM();
    }

    this.leftOverlay.applyToDOM();
  }

  /**
   * Get the parent overlay of the provided element.
   *
   * @param {HTMLElement} element
   * @returns {Object|null}
   */
  getParentOverlay(element: HTMLElement | null | undefined): Walkontable | null {
    if (!element) {
      return null;
    }

    const overlays = [
      this.topOverlay,
      this.leftOverlay,
      this.bottomOverlay,
      this.topLeftCornerOverlay,
      this.bottomLeftCornerOverlay
    ];
    let result: Walkontable | null = null;

    arrayEach(overlays, (elem) => {
      if (!elem) {
        return;
      }

      if (elem.clone && elem.clone.wtTable.TABLE.contains(element!)) {
        result = elem.clone;
      }
    });

    return result;
  }
}

export default Overlays;
