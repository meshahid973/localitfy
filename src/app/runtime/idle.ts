export function runLocaltifyIdleTask(task: () => void, timeout = 1400) {
  const requestIdleCallback = (window as typeof window & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  }).requestIdleCallback;

  if (typeof requestIdleCallback === "function") {
    let cancelled = false;
    const id = window.requestIdleCallback(() => { if (!cancelled) task(); }, { timeout });
    return () => { cancelled = true; window.cancelIdleCallback?.(id); };
  }

  const timer = window.setTimeout(task, 0);
  return () => window.clearTimeout(timer);
}
