import jsonpatch from './../../../lib/jsonpatch/json-patch-duplex';
import localHooks from '../../mixins/localHooks';
import type { LocalHooks } from '../../mixins/localHooks';
import { mixin } from '../../helpers/object';
import { cleanPatches } from './utils';
import type { Patch } from './utils';

/**
 * @class DataObserver
 * @plugin ObserveChanges
 *
 * Watches the source data for changes made outside the grid; runs the `change` local hook with the patches.
 */
class DataObserver {
  // From the localHooks mixin (on the prototype): `declare` keeps class fields from hiding them.
  declare addLocalHook: LocalHooks['addLocalHook'];

  declare runLocalHooks: LocalHooks['runLocalHooks'];

  declare clearLocalHooks: LocalHooks['clearLocalHooks'];

  /**
   * Observed source data.
   */
  observedData: unknown = null;

  /**
   * JsonPatch observer.
   */
  observer: object | null = null;

  /**
   * Flag which determines if observer is paused or not. Paused observer doesn't emit `change` hooks.
   */
  paused = false;

  constructor(observedData: unknown) {
    this.setObservedData(observedData);
  }

  /**
   * Set data to observe.
   */
  setObservedData(observedData: unknown): void {
    if (this.observer) {
      jsonpatch.unobserve(this.observedData, this.observer);
    }
    this.observedData = observedData;
    this.observer = jsonpatch.observe(this.observedData, (patches: Patch[]) => this.onChange(patches));
  }

  /**
   * Check if observer was paused.
   */
  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Pause observer (stop emitting all detected changes).
   */
  pause(): void {
    this.paused = true;
  }

  /**
   * Resume observer (emit all detected changes).
   */
  resume(): void {
    this.paused = false;
  }

  /**
   * JsonPatch on change listener.
   *
   * @private
   */
  onChange(patches: Patch[]): void {
    this.runLocalHooks('change', cleanPatches(patches));
  }

  /**
   * Destroy observer instance.
   */
  destroy(): void {
    jsonpatch.unobserve(this.observedData, this.observer);
    this.observedData = null;
    this.observer = null;
  }
}

mixin(DataObserver, localHooks);

export default DataObserver;
