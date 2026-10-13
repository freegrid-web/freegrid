import { isNumeric } from './../../../helpers/number';

import type { PluginHost } from './../../_base';

const STATE_INITIALIZED = 0;
const STATE_BUILT = 1;
const STATE_APPENDED = 2;
const UNIT = 'px';

/**
 * @class
 * @private
 */
class BaseUI {
  /**
   * Instance of FreeGrid.
   */
  hot: PluginHost;

  /**
   * DOM element representing the ui element (after `build()`).
   *
   * @private
   */
  _element: HTMLDivElement = null!;

  /**
   * Build state of the element: initialized, built or appended.
   */
  state = STATE_INITIALIZED;

  constructor(hotInstance: PluginHost) {
    this.hot = hotInstance;
  }

  /**
   * Add created UI elements to table.
   *
   * @param wrapper Element which are parent for our UI element.
   */
  appendTo(wrapper: HTMLElement): void {
    wrapper.appendChild(this._element);

    this.state = STATE_APPENDED;
  }

  /**
   * Method for create UI element. Only create, without append to table.
   */
  build(): void {
    this._element = document.createElement('div');
    this.state = STATE_BUILT;
  }

  /**
   * Method for remove UI element.
   */
  destroy(): void {
    if (this.isAppended()) {
      this._element.remove();
    }

    this._element = null!;
    this.state = STATE_INITIALIZED;
  }

  /**
   * Check if UI element are appended.
   */
  isAppended(): boolean {
    return this.state === STATE_APPENDED;
  }

  /**
   * Check if UI element are built.
   */
  isBuilt(): boolean {
    return this.state >= STATE_BUILT;
  }

  /**
   * Setter for position.
   *
   * @param [top] New top position of the element.
   * @param [left] New left position of the element.
   */
  setPosition(top?: number, left?: number): void {
    if (isNumeric(top)) {
      this._element.style.top = `${top}${UNIT}`;
    }
    if (isNumeric(left)) {
      this._element.style.left = `${left}${UNIT}`;
    }
  }

  /**
   * Getter for the element position.
   *
   * @returns Object contains left and top position of the element.
   */
  getPosition(): { top: number; left: number } {
    return {
      top: this._element.style.top ? parseInt(this._element.style.top, 10) : 0,
      left: this._element.style.left ? parseInt(this._element.style.left, 10) : 0
    };
  }

  /**
   * Setter for the element size.
   *
   * @param [width] New width of the element.
   * @param [height] New height of the element.
   */
  setSize(width?: number, height?: number): void {
    if (isNumeric(width)) {
      this._element.style.width = `${width}${UNIT}`;
    }
    if (isNumeric(height)) {
      this._element.style.height = `${height}${UNIT}`;
    }
  }

  /**
   * Getter for the element position.
   *
   * @returns Object contains height and width of the element.
   */
  getSize(): { width: number; height: number } {
    return {
      width: this._element.style.width ? parseInt(this._element.style.width, 10) : 0,
      height: this._element.style.height ? parseInt(this._element.style.height, 10) : 0
    };
  }

  /**
   * Setter for the element offset. Offset means marginTop and marginLeft of the element.
   *
   * @param [top] New margin top of the element.
   * @param [left] New margin left of the element.
   */
  setOffset(top?: number, left?: number): void {
    if (isNumeric(top)) {
      this._element.style.marginTop = `${top}${UNIT}`;
    }
    if (isNumeric(left)) {
      this._element.style.marginLeft = `${left}${UNIT}`;
    }
  }

  /**
   * Getter for the element offset.
   *
   * @returns Object contains top and left offset of the element.
   */
  getOffset(): { top: number; left: number } {
    return {
      top: this._element.style.marginTop ? parseInt(this._element.style.marginTop, 10) : 0,
      left: this._element.style.marginLeft ? parseInt(this._element.style.marginLeft, 10) : 0
    };
  }
}

export default BaseUI;
