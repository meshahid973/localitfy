export function runLocaltifyIdleTask(task: () => void, timeout = 1400) {
  const requestIdleCallback = (window as typeof window & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  }).requestIdleCallback;

  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(task, { timeout });
    return;
  }

  window.setTimeout(task, 0);
}
