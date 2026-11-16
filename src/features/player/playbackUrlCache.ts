import type { PlaybackUrlCacheEntry } from "../library/song.types";
import { PLAYBACK_URL_CACHE_TTL_MS } from "../library/library.constants";

/** Bounded LRU. Expiration is checked on access; no background timer is needed. */
export class PlaybackUrlCache {
  private entries = new Map<string, PlaybackUrlCacheEntry>();

  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(maxEntries = 512, now = Date.now) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new RangeError("Invalid playback URL cache capacity");
    this.maxEntries = maxEntries;
    this.now = now;
  }

  get size() { return this.entries.size; }

  get(key: string): PlaybackUrlCacheEntry | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    if (this.now() - entry.checkedAt >= PLAYBACK_URL_CACHE_TTL_MS) return undefined;
    this.entries.set(key, entry);
    return entry;
  }

  set(key: string, entry: PlaybackUrlCacheEntry) {
    this.entries.delete(key);
    this.entries.set(key, entry);
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }

  delete(key: string) { return this.entries.delete(key); }
  clear() { this.entries.clear(); }
}
