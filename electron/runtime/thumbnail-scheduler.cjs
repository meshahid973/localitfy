"use strict";

/**
 * Cooperative thumbnail queue: one small image job per timer turn.
 * Produces identical thumbnails; avoids timer storms and startup bursts.
 */
function createThumbnailScheduler({
  processFile,
  delayMs = 160,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  onError = () => {}
}) {
  if (typeof processFile !== "function") throw new TypeError("processFile is required");
  const pending = new Set();
  let timer = null;

  function schedule(delay = delayMs) {
    if (timer !== null || pending.size === 0) return;
    timer = setTimer(() => {
      timer = null;
      const filePath = pending.values().next().value;
      if (filePath === undefined) return;
      pending.delete(filePath);
      try { processFile(filePath); } catch (error) { onError(error); }
      schedule();
    }, delay);
  }

  function enqueue(filePath) {
    if (!filePath || pending.has(filePath) || pending.size >= 500) return false;
    pending.add(filePath);
    schedule();
    return true;
  }

  function clear() {
    pending.clear();
    if (timer !== null) clearTimer(timer);
    timer = null;
  }

  return {
    enqueue, clear,
    has: (filePath) => pending.has(filePath),
    get size() { return pending.size; }
  };
}

module.exports = { createThumbnailScheduler };
