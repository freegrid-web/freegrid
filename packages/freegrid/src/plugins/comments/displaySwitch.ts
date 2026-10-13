import { debounce } from '../../helpers/function';
import { mixin } from '../../helpers/object';
import localHooks from '../../mixins/localHooks';
import type { LocalHooks } from '../../mixins/localHooks';

/** A cell, as a range. */
type CellRangeLike = { from: { row: number; col: number } };

const DEFAULT_DISPLAY_DELAY = 250;
const DEFAULT_HIDE_DELAY = 250;

/**
 * Display switch for the Comments plugin. Manages the time of delayed displaying / hiding comments.
 *
 * @class DisplaySwitch
 * @plugin Comments
 */
class DisplaySwitch {
  // From the localHooks mixin (on the prototype): `declare` keeps class fields from hiding them.
  declare addLocalHook: LocalHooks['addLocalHook'];

  declare runLocalHooks: LocalHooks['runLocalHooks'];

  declare clearLocalHooks: LocalHooks['clearLocalHooks'];

  /**
   * Flag to determine if comment can be showed or hidden. State `true` mean that last performed action
   * was an attempt to show comment element. State `false` mean that it was attempt to hide comment element.
   */
  wasLastActionShow = true;

  /**
   * Show comment after predefined delay. It keeps reference to immutable `debounce` function.
   */
  showDebounced: (range: CellRangeLike) => void = () => {};

  /**
   * Reference to timer, run by `setTimeout`, which is hiding comment
   */
  hidingTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(displayDelay?: number) {
    this.updateDelay(displayDelay);
  }

  /**
   * Responsible for hiding comment after proper delay.
   */
  hide(): void {
    this.wasLastActionShow = false;

    this.hidingTimer = setTimeout(() => {
      if (this.wasLastActionShow === false) {
        this.runLocalHooks('hide');
      }
    }, DEFAULT_HIDE_DELAY);
  }

  /**
   * Responsible for showing comment after proper delay.
   *
   * @param range Coordinates of selected cell.
   */
  show(range: CellRangeLike): void {
    this.wasLastActionShow = true;
    this.showDebounced(range);
  }

  /**
   * Cancel hiding comment.
   */
  cancelHiding(): void {
    this.wasLastActionShow = true;

    clearTimeout(this.hidingTimer!);
    this.hidingTimer = null;
  }

  /**
   * Update the switch settings.
   *
   * @param [displayDelay] Delay of showing the comments (in milliseconds).
   */
  updateDelay(displayDelay = DEFAULT_DISPLAY_DELAY): void {
    this.showDebounced = debounce((range: CellRangeLike) => {
      if (this.wasLastActionShow) {
        this.runLocalHooks('show', range.from.row, range.from.col);
      }
    }, displayDelay);
  }

  /**
   * Destroy the switcher.
   */
  destroy(): void {
    this.clearLocalHooks();
  }
}

mixin(DisplaySwitch, localHooks);

export default DisplaySwitch;
