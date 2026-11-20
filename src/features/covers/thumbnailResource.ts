import { useCallback, useSyncExternalStore } from "react";

const urls = new Map<string, string>();
const listeners = new Map<string, Set<() => void>>();
let attached = false;
export function rememberCompletedThumbnail({ source, url }: {source: string; url: string}) {
    if (!source || !url) return;
    urls.delete(source);
    urls.set(source, url);
    while (urls.size > 2048) {
      const oldest = urls.keys().next().value;
      if (oldest === undefined) break;
      urls.delete(oldest);
      listeners.get(oldest)?.forEach(notify => notify());
    }
    listeners.get(source)?.forEach(notify => notify());
}
function attach() {
  if (attached || !window.localitfy?.onCoverThumbnailReady) return;
  attached = true;
  window.localitfy.onCoverThumbnailReady(rememberCompletedThumbnail);
}
function subscribe(source: string, notify: () => void) {
  attach();
  if (!source) return () => {};
  let group = listeners.get(source);
  if (!group) { group = new Set(); listeners.set(source, group); }
  group.add(notify);
  return () => {
    group.delete(notify);
    if (!group.size) listeners.delete(source);
  };
}
export function useCompletedThumbnail(source: string) {
  const connect = useCallback((notify: () => void) => subscribe(source, notify), [source]);
  const snapshot = useCallback(() => urls.get(source) || "", [source]);
  return useSyncExternalStore(connect, snapshot, () => "");
}
