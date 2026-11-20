import { useCallback, useSyncExternalStore } from "react";

export type ThumbnailSize = 96 | 256 | 512;
type ThumbnailResult = {source: string; url: string; size?: ThumbnailSize};
const urls = new Map<string, string>();
const listeners = new Map<string, Set<() => void>>();
const requests = new Map<string, Promise<ThumbnailResult | null>>();
let attached = false;

export function artworkSize(width: number, height: number, pixelRatio: number): ThumbnailSize {
  const physical = Math.max(width, height) * Math.min(3, Math.max(1, pixelRatio || 1));
  return physical > 256 ? 512 : physical > 96 ? 256 : 96;
}
const keyOf = (source: string, size: ThumbnailSize) => source ? JSON.stringify([source, size]) : "";
export function rememberCompletedThumbnail({ source, url, size = 256 }: ThumbnailResult) {
  if (!source || !url) return;
  const key = keyOf(source, size);
  const previous = urls.get(key);
  urls.delete(key);
  urls.set(key, url);
  while (urls.size > 2048) {
    const oldest = urls.keys().next().value;
    if (oldest === undefined) break;
    urls.delete(oldest);
    listeners.get(oldest)?.forEach(notify => notify());
  }
  if (previous !== url) listeners.get(key)?.forEach(notify => notify());
}
function attach() {
  if (attached || !window.localitfy?.onCoverThumbnailReady) return;
  attached = true;
  window.localitfy.onCoverThumbnailReady(rememberCompletedThumbnail);
}
function subscribe(key: string, notify: () => void) {
  attach();
  if (!key) return () => {};
  let group = listeners.get(key);
  if (!group) { group = new Set(); listeners.set(key, group); }
  group.add(notify);
  return () => {
    group.delete(notify);
    if (!group.size) listeners.delete(key);
  };
}
export function useCompletedThumbnail(source: string, size: ThumbnailSize = 256) {
  const key = keyOf(source, size);
  const connect = useCallback((notify: () => void) => subscribe(key, notify), [key]);
  const snapshot = useCallback(() => urls.get(key) || "", [key]);
  return useSyncExternalStore(connect, snapshot, () => "");
}
export function requestThumbnail(id: string, source: string, size: ThumbnailSize, failed?: string) {
  attach();
  const key = JSON.stringify([source,size,failed || ""]);
  const pending = requests.get(key);
  if (pending) return pending;
  if (!window.localitfy?.requestCoverThumbnail || requests.size >= 64) return Promise.resolve(null);
  const job = window.localitfy.requestCoverThumbnail({id,source,size,failed})
    .then(result => { if (result) rememberCompletedThumbnail(result); return result; })
    .catch(() => null).finally(() => requests.delete(key));
  requests.set(key, job);
  return job;
}

// One observer for artwork across all mounted lists, not one observer per row.
const viewportListeners = new Map<Element, (near: boolean, size: ThumbnailSize) => void>();
let viewportObserver: IntersectionObserver | null = null;
export function observeArtwork(element: Element, callback: (near: boolean, size: ThumbnailSize) => void) {
  if (typeof IntersectionObserver === "undefined") {
    const box = element.getBoundingClientRect();
    callback(true, artworkSize(box.width, box.height, window.devicePixelRatio));
    return () => {};
  }
  viewportObserver ??= new IntersectionObserver(entries => {
    for (const entry of entries) {
      const box = entry.boundingClientRect;
      viewportListeners.get(entry.target)?.(entry.isIntersecting, artworkSize(box.width, box.height, window.devicePixelRatio));
    }
  }, {rootMargin: "160px"});
  viewportListeners.set(element, callback);
  viewportObserver.observe(element);
  return () => {
    viewportListeners.delete(element);
    viewportObserver?.unobserve(element);
    if (!viewportListeners.size) { viewportObserver?.disconnect(); viewportObserver = null; }
  };
}
