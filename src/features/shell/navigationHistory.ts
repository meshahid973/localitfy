import type { View } from "./view.types";

/** A page inside a section: one album, artist, genre, playlist or daily mix. */
export type PageDetail = { kind: "album" | "artist" | "genre" | "playlist" | "mix"; id: string };
export type HistoryEntry = { view: View; detail: PageDetail | null; scrollTop: number };
export type HistoryState = { entries: HistoryEntry[]; index: number };

export const DETAIL_VIEWS: Record<PageDetail["kind"], View> = { album: "albums", artist: "artists", genre: "genres", playlist: "playlists", mix: "playlists" };
const MAX_ENTRIES = 80;

export const artistDetailId = (name: string) => name.trim().toLocaleLowerCase();

function sameEntry(entry: HistoryEntry, view: View, detail: PageDetail | null) {
  return entry.view === view && entry.detail?.kind === detail?.kind && entry.detail?.id === detail?.id;
}

/** Opens a page: forward history is dropped and the page being left remembers its scroll position. */
export function pushHistory(state: HistoryState, view: View, detail: PageDetail | null, scrollTop: number): HistoryState {
  const current = state.entries[state.index];
  if (sameEntry(current, view, detail)) return state;
  const kept = state.entries.slice(0, state.index + 1);
  kept[kept.length - 1] = { ...current, scrollTop };
  const entries = [...kept, { view, detail, scrollTop: 0 }].slice(-MAX_ENTRIES);
  return { entries, index: entries.length - 1 };
}

/** Back (-1) or forward (1); unchanged at either end. */
export function stepHistory(state: HistoryState, delta: -1 | 1, scrollTop: number): HistoryState {
  if (!state.entries[state.index + delta]) return state;
  const entries = [...state.entries];
  entries[state.index] = { ...entries[state.index], scrollTop };
  return { entries, index: state.index + delta };
}

type WheelLike = { deltaX: number; deltaY: number; ctrlKey: boolean; timeStamp: number; target: EventTarget | null };
const SWIPE_DISTANCE = 140, SWIPE_GAP_MS = 180;

/**
 * Turns a two-finger horizontal trackpad swipe (a burst of horizontal wheel events) into one back (-1)
 * or forward (1). Fingers moving right scroll with a negative deltaX and go back, like Safari. Swipes over
 * something that can still scroll sideways (a shelf) scroll it instead, and the momentum after a swipe
 * never triggers a second step.
 */
export function createSwipeDetector(onSwipe: (delta: -1 | 1) => void, scrollsSideways: (target: EventTarget | null, deltaX: number) => boolean) {
  let total = 0, lastAt = -Infinity, done = false;
  return (event: WheelLike) => {
    if (event.ctrlKey) return; // pinch to zoom
    if (event.timeStamp - lastAt > SWIPE_GAP_MS) { total = 0; done = false; }
    lastAt = event.timeStamp;
    if (done || Math.abs(event.deltaX) <= Math.abs(event.deltaY) * 1.5) return;
    if (scrollsSideways(event.target, event.deltaX)) { done = true; return; }
    total += event.deltaX;
    if (Math.abs(total) < SWIPE_DISTANCE) return;
    done = true;
    onSwipe(total < 0 ? -1 : 1);
  };
}
