/**
 * `setImmediate`/`clearImmediate` for browsers. FreeGrid 6.2.2 used the globals that
 * `@babel/polyfill` installed; FreeGrid has no polyfills, so it provides this helper.
 *
 * Callbacks queued during the same turn run together in one later macrotask (as Node's setImmediate
 * does), so a `setTimeout(fn, 0)` scheduled after them cannot interleave between them. As with
 * separate tasks, `clearImmediate` still cancels a sibling from inside the batch, and an exception in
 * one callback does not stop the others (it is re-thrown asynchronously). The task is
 * triggered by both MessageChannel and `setTimeout(0)`, whichever comes first.
 */
let nextId = 1;
const pending = new Map();
let flushScheduled = false;
let channel = null;

function flush() {
  if (!flushScheduled) {
    return; // Already flushed by the other trigger (see scheduleFlush).
  }
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
  }
  // Also schedule a timer: Firefox and WebKit may deliver the message after timers that are already
  // due, and callers expect immediates to run before any timer scheduled after them. Whichever
  // trigger fires first flushes; the other finds nothing scheduled.
  setTimeout(flush, 0);
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
