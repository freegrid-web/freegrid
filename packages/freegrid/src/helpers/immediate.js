/**
 * `setImmediate`/`clearImmediate` for browsers. Handsontable 6.2.2 used the globals that
 * `@babel/polyfill` installed; FreeGrid targets ES2020 without polyfills, so it ships this helper.
 * Like the polyfill, it runs callbacks in a later macrotask via MessageChannel, falling back to
 * `setTimeout` where MessageChannel is unavailable.
 */
let nextId = 1;
const pending = new Map();
let channel = null;

function run(id) {
  const callback = pending.get(id);

  if (callback) {
    pending.delete(id);
    callback();
  }
}

function getChannel() {
  if (!channel && typeof MessageChannel === 'function') {
    channel = new MessageChannel();
    channel.port1.onmessage = event => run(event.data);

    if (typeof channel.port1.unref === 'function') {
      channel.port1.unref(); // Node (unit tests): don't keep the process alive.
    }
  }

  return channel;
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

  const messageChannel = getChannel();

  if (messageChannel) {
    messageChannel.port2.postMessage(id);
  } else {
    setTimeout(() => run(id), 0);
  }

  return id;
}

/**
 * @param {Number} id Handle returned by `setImmediate`.
 */
export function clearImmediate(id) {
  pending.delete(id);
}
