import type { PlaybackUrlCacheEntry, PlaybackUrlResult, Song } from "../library/song.types";
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
    if (this.now() - entry.checkedAt >= Math.min(PLAYBACK_URL_CACHE_TTL_MS, entry.ttlMs ?? PLAYBACK_URL_CACHE_TTL_MS)) return undefined;
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

type ResolveOptions = {
  sourceKey: string;
  force: boolean;
  cache: PlaybackUrlCache;
  pending: Map<string, Promise<PlaybackUrlResult>>;
  resolver?: (payload: { songId: string; filePath: string; fallbackUrl: string; force: boolean }) => Promise<PlaybackUrlResult>;
  onMissing: (song: Song, sourceKey: string) => void;
};

/** Shared request ownership; invalidation or forced refresh supersedes older IPC responses. */
export async function resolveCachedPlaybackUrl(song: Song | null | undefined, { sourceKey, force, cache, pending, resolver, onMissing }: ResolveOptions): Promise<PlaybackUrlResult> {
  if (!song) return { ok: false, fileExists: false, error: "missing song" };
  const filePath = String(song.filePath || "");
  if (!sourceKey) return { ok: false, fileExists: false, error: "missing file path" };
  if (song.fileExists === false && !force) return { ok: false, fileExists: false, error: "file marked missing" };

  const forceKey = `${sourceKey}:force`;
  const normalKey = `${sourceKey}:normal`;
  const pendingKey = force ? forceKey : normalKey;
  const forced = pending.get(forceKey);
  if (forced) return forced;
  if (force) { pending.delete(normalKey); cache.delete(sourceKey); }
  const existing = pending.get(pendingKey);
  if (existing) return existing;
  const cached = cache.get(sourceKey);
  if (!force && cached?.url && cached.fileExists) {
    return { ok: true, url: cached.url, filePath, fileExists: true, sizeBytes: cached.sizeBytes, mtimeMs: cached.mtimeMs,
      cacheTtlMs: Math.max(0, Math.min(PLAYBACK_URL_CACHE_TTL_MS, cached.ttlMs ?? PLAYBACK_URL_CACHE_TTL_MS) - (Date.now() - cached.checkedAt)) };
  }
  if (typeof resolver !== "function") {
    return song.url
      ? { ok: true, url: song.url, filePath, fileExists: true, cacheTtlMs: PLAYBACK_URL_CACHE_TTL_MS }
      : { ok: false, filePath, error: "playback resolver unavailable" };
  }

  const staleResult = (): PlaybackUrlResult => ({ ok: false, filePath, error: "playback source changed" });
  const request: Promise<PlaybackUrlResult> = Promise.resolve().then(() => resolver({
    songId: song.id, filePath, fallbackUrl: song.url || "", force
  })).then((result): PlaybackUrlResult => {
    if (pending.get(pendingKey) !== request) return staleResult();
    const fileExists = typeof result?.fileExists === "boolean" ? result.fileExists :
      typeof result?.exists === "boolean" ? result.exists : result?.ok ? true : undefined;
    if (result?.ok && result?.url && fileExists !== false) {
      const ttlMs = typeof result.cacheTtlMs === "number" && Number.isFinite(result.cacheTtlMs)
        ? Math.max(0, Math.min(result.cacheTtlMs, PLAYBACK_URL_CACHE_TTL_MS)) : PLAYBACK_URL_CACHE_TTL_MS;
      const entry: PlaybackUrlCacheEntry = {
        url: String(result.url), checkedAt: Date.now(), fileExists: true, ttlMs,
        sizeBytes: typeof result.sizeBytes === "number" ? result.sizeBytes : undefined,
        mtimeMs: typeof result.mtimeMs === "number" ? result.mtimeMs : undefined
      };
      if (ttlMs > 0) cache.set(sourceKey, entry);
      return { ok: true, url: entry.url, filePath: result.filePath || filePath, fileExists: true,
        sizeBytes: entry.sizeBytes, mtimeMs: entry.mtimeMs, cacheTtlMs: ttlMs };
    }
    cache.delete(sourceKey);
    if ((result?.fileExists === false || result?.exists === false) && song.id) onMissing(song, sourceKey);
    return { ok: false, filePath, fileExists, error: String(result?.error || "could not resolve playback url") };
  }).catch((error: unknown): PlaybackUrlResult => {
    if (pending.get(pendingKey) !== request) return staleResult();
    cache.delete(sourceKey);
    return { ok: false, filePath, error: error instanceof Error ? error.message : String(error || "could not resolve playback url") };
  }).finally(() => {
    if (pending.get(pendingKey) === request) pending.delete(pendingKey);
  });
  pending.set(pendingKey, request);
  return request;
}
