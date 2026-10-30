import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { View } from "./view.types";
import type { NowPlayingContext } from "../player/playbackSource";
import { artistDetailId, createSwipeDetector, DETAIL_VIEWS, pushHistory, stepHistory, type HistoryState, type PageDetail } from "./navigationHistory";

export type { PageDetail } from "./navigationHistory";
export { artistDetailId } from "./navigationHistory";

const GESTURE_GAP_MS = 350;
const IS_MAC = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);

/** Whether the element under the pointer (or a parent) can still scroll sideways in this direction. */
function scrollsSideways(target: EventTarget | null, deltaX: number) {
  for (let element = target instanceof Element ? target : null; element; element = element.parentElement) {
    if (element.scrollWidth <= element.clientWidth + 1) continue;
    const overflow = getComputedStyle(element).overflowX;
    if (overflow !== "auto" && overflow !== "scroll") continue;
    if (deltaX < 0 ? element.scrollLeft > 0 : element.scrollLeft + element.clientWidth < element.scrollWidth - 1) return true;
  }
  return false;
}

/**
 * Back/forward history across sections and detail pages, like a browser. A view change made
 * anywhere else (menus, settings links) is recorded too, and each entry keeps its scroll position.
 */
export function useNavigationHistory(view: View, changeView: (view: View, source?: "nav" | "unknown") => unknown, contentRef: RefObject<HTMLElement | null>) {
  const [history, setHistory] = useState<HistoryState>(() => ({ entries: [{ view, detail: null, scrollTop: 0 }], index: 0 }));
  const pendingScrollRef = useRef<number | null>(null);
  const entry = history.entries[history.index];

  const push = useCallback((nextView: View, detail: PageDetail | null) => {
    const scrollTop = contentRef.current?.scrollTop ?? 0;
    setHistory((current) => pushHistory(current, nextView, detail, scrollTop));
    pendingScrollRef.current = 0;
  }, [contentRef]);

  const go = useCallback((nextView: View, source: "nav" | "unknown" = "nav") => {
    push(nextView, null);
    changeView(nextView, source);
  }, [push, changeView]);

  const open = useCallback((detail: PageDetail) => {
    if (!detail.id) return;
    push(DETAIL_VIEWS[detail.kind], detail);
    changeView(DETAIL_VIEWS[detail.kind], "unknown");
  }, [push, changeView]);

  const step = useCallback((delta: -1 | 1) => {
    const target = history.entries[history.index + delta];
    if (!target) return;
    const scrollTop = contentRef.current?.scrollTop ?? 0;
    setHistory((current) => stepHistory(current, delta, scrollTop));
    pendingScrollRef.current = target.scrollTop;
    changeView(target.view, "unknown");
  }, [history, contentRef, changeView]);

  const back = useCallback(() => step(-1), [step]);
  const forward = useCallback(() => step(1), [step]);
  // Mouse buttons, keys, swipes and OS commands. Windows reports one mouse side-button press both to the page
  // and as an OS app command, so steps this close together count once.
  const lastGestureRef = useRef(0);
  const gesture = useCallback((delta: -1 | 1) => {
    const now = Date.now();
    if (now - lastGestureRef.current < GESTURE_GAP_MS) return;
    lastGestureRef.current = now;
    step(delta);
  }, [step]);

  // A view change that did not come through here (menus, links inside a page) starts a new entry.
  // (go/open/back/forward update the entry before the view, so their own changes always match here.)
  useLayoutEffect(() => {
    if (view !== entry.view) push(view, null);
  }, [view]);

  // Every page shares the .content scroller: new pages open at the top, back/forward restore the old spot.
  // Pages load lazily, so a restore tries again for a few frames until the content is tall enough.
  useLayoutEffect(() => {
    const top = pendingScrollRef.current;
    const content = contentRef.current;
    if (top === null || !content || entry.view !== view) return;
    pendingScrollRef.current = null;
    content.scrollTo({ top, left: 0, behavior: "instant" });
    if (!top) return;
    let frame = 0, tries = 0;
    const retry = () => {
      if (Math.abs(content.scrollTop - top) < 2 || ++tries > 20) return;
      content.scrollTo({ top, left: 0, behavior: "instant" });
      frame = window.requestAnimationFrame(retry);
    };
    frame = window.requestAnimationFrame(retry);
    return () => window.cancelAnimationFrame(frame);
  }, [view, entry]);

  // Mouse back/forward buttons, ⌘[ ⌘] and Alt+←/→ outside text fields, and on macOS two-finger swipes.
  useEffect(() => {
    const onMouseUp = (event: MouseEvent) => {
      if (event.button !== 3 && event.button !== 4) return;
      event.preventDefault();
      gesture(event.button === 3 ? -1 : 1);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.defaultPrevented || (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']"))) return;
      const bracket = (event.metaKey || event.ctrlKey) && !event.altKey && (event.key === "[" || event.key === "]");
      const arrow = event.altKey && !event.metaKey && !event.ctrlKey && (event.key === "ArrowLeft" || event.key === "ArrowRight");
      if (!bracket && !arrow) return;
      event.preventDefault();
      gesture(event.key === "[" || event.key === "ArrowLeft" ? -1 : 1);
    };
    const onWheel = IS_MAC ? createSwipeDetector(gesture, scrollsSideways) : null;
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("keydown", onKeyDown);
    if (onWheel) window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("keydown", onKeyDown);
      if (onWheel) window.removeEventListener("wheel", onWheel);
    };
  }, [gesture]);

  const detail = entry.view === view ? entry.detail : null;
  return {
    view,
    detail,
    canGoBack: history.index > 0,
    canGoForward: history.index < history.entries.length - 1,
    go,
    open,
    back,
    forward,
    gesture,
    openAlbumPage: (albumId: string) => open({ kind: "album", id: albumId }),
    openArtistPage: (artistName: string) => open({ kind: "artist", id: artistDetailId(artistName) }),
    goToSongAlbum(songId: string, albumIds: Map<string, string>, onMissing: () => void) {
      const albumId = albumIds.get(songId);
      if (albumId) open({ kind: "album", id: albumId });
      else onMissing();
    },
    revealNowPlaying(context: NowPlayingContext) {
      if (context.kind === "library") go("library", "unknown");
      else open({ kind: context.kind, id: context.kind === "artist" ? artistDetailId(context.id) : context.id });
    }
  };
}

export type NavigationHistory = ReturnType<typeof useNavigationHistory>;
