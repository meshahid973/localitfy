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
  const visible = new Set();
  const background = new Set();
  const size = () => visible.size + background.size;
  let timer = null;

  function schedule(delay = delayMs) {
    if (timer !== null || size() === 0) return;
    timer = setTimer(() => {
      timer = null;
      const filePath = visible.values().next().value ?? background.values().next().value;
      if (filePath === undefined) return;
      visible.delete(filePath);
      background.delete(filePath);
      try { processFile(filePath); } catch (error) { onError(error); }
      schedule();
    }, delay);
  }

  function enqueue(filePath, { lowPriority = false } = {}) {
    if (!filePath || visible.has(filePath)) return false;
    if (background.has(filePath)) {
      if (lowPriority) return false;
      background.delete(filePath);
      visible.add(filePath);
      return true;
    }
    if (size() >= 500) return false;
    (lowPriority ? background : visible).add(filePath);
    schedule();
    return true;
  }

  function clear() {
    visible.clear();
    background.clear();
    if (timer !== null) clearTimer(timer);
    timer = null;
  }

  return {
    enqueue, clear,
    has: (filePath) => visible.has(filePath) || background.has(filePath),
    get size() { return size(); }
  };
}

module.exports = { createThumbnailScheduler };
