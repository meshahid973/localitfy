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
  let paused = false;
  let active = null;

  function schedule(delay = delayMs) {
    if (paused || active !== null || timer !== null || size() === 0) return;
    timer = setTimer(() => {
      timer = null;
      if (paused) return;
      const filePath = visible.values().next().value ?? background.values().next().value;
      if (filePath === undefined) return;
      visible.delete(filePath);
      background.delete(filePath);
      active = filePath;
      const finish = () => { active = null; schedule(); };
      try {
        const result = processFile(filePath);
        if (result && typeof result.then === "function") {
          Promise.resolve(result).catch(onError).finally(finish);
        } else finish();
      } catch (error) { onError(error); finish(); }
    }, delay);
  }

  function enqueue(filePath, { lowPriority = false } = {}) {
    if (!filePath || active === filePath || visible.has(filePath)) return false;
    if (background.has(filePath)) {
      if (lowPriority) return false;
      background.delete(filePath);
      visible.add(filePath);
      return true;
    }
    if (size() >= 500) {
      if (lowPriority || !background.size) return false;
      background.delete(background.values().next().value);
    }
    (lowPriority ? background : visible).add(filePath);
    schedule();
    return true;
  }

  function setPaused(next) {
    paused = Boolean(next);
    if (paused) {
      if (timer !== null) clearTimer(timer);
      timer = null;
    } else schedule();
  }

  function clear() {
    visible.clear();
    background.clear();
    if (timer !== null) clearTimer(timer);
    timer = null;
  }

  return {
    enqueue, clear, setPaused,
    has: (filePath) => active === filePath || visible.has(filePath) || background.has(filePath),
    get size() { return size(); }
  };
}

module.exports = { createThumbnailScheduler };
