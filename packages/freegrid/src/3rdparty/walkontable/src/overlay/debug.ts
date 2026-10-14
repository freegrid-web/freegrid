import type { OverlayEngine } from './types';
import type Walkontable from '../core';
import { addClass } from './../../../../helpers/dom/element';
import Overlay from './_base';

/**
 * A overlay that renders ALL available rows & columns positioned on top of the original Walkontable instance and all other overlays.
 * Used for debugging purposes to see if the other overlays (that render only part of the rows & columns) are positioned correctly
 *
 * @class DebugOverlay
 */
class DebugOverlay extends Overlay {
  declare clone: OverlayEngine;
  /**
   * @param {Walkontable} wotInstance
   */
  constructor(wotInstance: Walkontable) {
    super(wotInstance);

    this.clone = this.makeClone(Overlay.CLONE_DEBUG);
    this.clone.wtTable.holder.style.opacity = 0.4 as unknown as string;
    this.clone.wtTable.holder.style.textShadow = '0 0 2px #ff0000';

    addClass(this.clone.wtTable.holder.parentNode, 'fg-debug-visible');
  }
}

Overlay.registerOverlay(Overlay.CLONE_DEBUG, DebugOverlay);

export default DebugOverlay;
