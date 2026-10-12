/**
 * `setImmediate`/`clearImmediate` for browsers. Handsontable 6.2.2 used the globals that
 * `@babel/polyfill` installed; FreeGrid targets ES2020 without polyfills, so it ships this helper.
 *
 * Callbacks queued during the same turn run together in one later macrotask (as Node's setImmediate
 * does), so a `setTimeout(fn, 0)` scheduled after them cannot interleave between them. As with
 * separate tasks, `clearImmediate` still cancels a sibling from inside the batch, and an exception in
 * one callback does not stop the others (it is re-thrown asynchronously). The task is
 * posted through MessageChannel, falling back to `setTimeout` where MessageChannel is unavailable.
 */
let nextId = 1;
const pending = new Map();
let flushScheduled = false;
let channel = null;

function flush() {
  // Run only what was queued before this flush; callbacks queued meanwhile go to the next one.
  const ids = Array.from(pending.keys());

  flushScheduled = false;
  ids.forEach((id) => {
    const callback = pending.get(id);

    if (!callback) {
      return; // Cancelled by clearImmediate, possibly from an earlier callback in this batch.
    }
    pending.delete(id);
    try {
      callback();
    } catch (error) {
      // As with separate tasks, one failing callback must not stop the others; report it as uncaught.
      setTimeout(() => { throw error; }, 0);
    }
  });
}

function scheduleFlush() {
  if (flushScheduled) {
    return;
  }
  flushScheduled = true;

  if (!channel && typeof MessageChannel === 'function') {
    channel = new MessageChannel();
    channel.port1.onmessage = flush;

    if (typeof channel.port1.unref === 'function') {
      channel.port1.unref(); // Node (unit tests): don't keep the process alive.
    }
  }

  if (channel) {
    channel.port2.postMessage(null);
  } else {
    setTimeout(flush, 0);
  }
}

/**
 * @param {Function} callback
 * @param {...*} args Arguments passed to the callback.
 * @returns {Number} Handle for `clearImmediate`.
 */
export function setImmediate(callback, ...args) {
  const id = nextId;

  nextId += 1;
  pending.set(id, () => callback(...args));
  scheduleFlush();

  return id;
}

/**
 * @param {Number} id Handle returned by `setImmediate`.
 */
export function clearImmediate(id) {
  pending.delete(id);
}
