import type { Song } from "../../features/library/song.types";
import type { Settings } from "../../features/settings/settings.types";
import type { PlayEvent } from "../../features/player/listeningHistory";
import { LocaltifyNative } from "./native";
import { readValue, writeValues } from "./store";
import type { SyncPlaylist, SyncSongFields } from "./syncMerge";
import type { SyncBatch } from "./syncExchange";

export type FileInfo = { size: number; mtimeMs: number; ext: string };
/** A song as the Mac sends it: library fields plus the versions of its audio and cover files. */
export type RemoteSong = SyncSongFields & Record<string, unknown> & { file: FileInfo; cover: FileInfo | null };
/** `platform` is the computer's process.platform ("darwin", "win32", "linux"), for calling it a Mac or a PC. */
export type Pairing = { url: string; token: string; name: string; platform?: string; sequence?: number };
export type SyncRecord = { at: number; ok: boolean; message: string };
type Saved = "remoteSongs" | "edits" | "base" | "playlists" | "settings" | "macFeatures" | "pendingEvents" | "listeningCounts" | "files" | "pairing" | "lastSync" | "pendingSync" | "likeClock" | "clockOffset";

type LocalFiles = Record<string, { audio?: string; audioExt?: string; cover?: string; coverExt?: string }>;

export const fileKey = (info: FileInfo | null | undefined) => (info ? `${info.size}-${info.mtimeMs}` : "");

/** The phone's copy of the library. Everything persists in IndexedDB; audio and covers live in app storage. */
export class PhoneLibrary {
  paths = { files: "", mediaPrefix: "https://localhost/_localtify_media_/", deviceName: "Android phone" };
  remoteSongs: RemoteSong[] = [];
  /** Phone-side values of the editable fields, keyed by song ID. */
  edits: Record<string, Partial<Song>> = {};
  base: { songs: Record<string, SyncSongFields>; playlists: SyncPlaylist[] } = { songs: {}, playlists: [] };
  playlists: SyncPlaylist[] = [];
  settings: Partial<Settings> = {};
  /** Feature switches set on the Mac (lyrics, analysis, discover); they win over the phone's own settings. */
  macFeatures: Partial<Settings> = {};
  pendingEvents: PlayEvent[] = [];
  listeningCounts: Array<[string, number, number]> = [];
  files: LocalFiles = {};
  pairing: Pairing | null = null;
  lastSync: SyncRecord | null = null;
  pendingSync: SyncBatch | null = null;
  /** When each song's like last changed (Mac clock): a tap here, or one adopted from the Mac. The newest wins. */
  likeClock: Record<string, number> = {};
  /** Mac clock minus phone clock, measured on the live connection; used for likes tapped while away. */
  clockOffset = 0;
  /** Bumped by every local edit, so a sync can tell whether the phone changed while it was running. */
  revision = 0;
  private loading: Promise<void> | null = null;
  private checkpointDirty = false;

  load() {
    this.loading ??= (async () => {
      try { this.paths = await LocaltifyNative.getPaths(); } catch { /* keep defaults outside the app */ }
      const [remoteSongs, edits, base, playlists, settings, macFeatures, pendingEvents, listeningCounts, files, pairing, lastSync, pendingSync, likeClock, clockOffset] = await Promise.all([
        readValue<RemoteSong[]>("remoteSongs", []),
        readValue<Record<string, Partial<Song>>>("edits", {}),
        readValue("base", this.base),
        readValue<SyncPlaylist[]>("playlists", []),
        // Phone defaults: no idle screensaver, no desktop window behaviour.
        readValue<Partial<Settings>>("settings", { idleScreensaverEnabled: false, minimizeToTray: false, startWithWindows: false }),
        readValue<Partial<Settings>>("macFeatures", {}),
        readValue<PlayEvent[]>("pendingEvents", []),
        readValue<Array<[string, number, number]>>("listeningCounts", []),
        readValue<LocalFiles>("files", {}),
        readValue<Pairing | null>("pairing", null),
        readValue<SyncRecord | null>("lastSync", null),
        readValue<SyncBatch | null>("pendingSync", null),
        readValue<Record<string, number>>("likeClock", {}),
        readValue<number>("clockOffset", 0)
      ]);
      Object.assign(this, { remoteSongs, edits, base, playlists, settings, macFeatures, pendingEvents, listeningCounts, files, pairing, lastSync, pendingSync, likeClock, clockOffset });
    })();
    return this.loading;
  }

  save(keys: Saved[]) {
    const selected = this.checkpointDirty ? [...new Set([...keys, ...this.checkpointKeys])] : keys;
    return writeValues(Object.fromEntries(selected.map((key) => [key, this[key]])));
  }

  private readonly checkpointKeys = ["remoteSongs", "playlists", "listeningCounts", "base", "edits", "pendingEvents", "macFeatures", "pairing", "pendingSync"] as const;

  async saveSyncCheckpoint() {
    // Until this commit succeeds, concurrent edit saves must carry the same baseline/acknowledgement with them.
    // Otherwise a failed checkpoint followed by a successful edit write could persist edits against an older baseline.
    this.checkpointDirty = true;
    await this.save([...this.checkpointKeys]);
    this.checkpointDirty = false;
  }

  effectiveSettings(): Partial<Settings> {
    return { ...this.settings, ...this.macFeatures };
  }

  audioPath(id: string, ext: string) {
    return `library/${id}.${ext}`;
  }

  coverPath(id: string, ext: string) {
    return `covers/${id}.${ext}`;
  }

  /** Songs shaped like the Mac's bootstrap payload, pointing at local files. */
  songs(): Song[] {
    return this.remoteSongs.map((remote) => {
      const local = this.files[remote.id] || {};
      const hasAudio = Boolean(local.audio);
      const cover = local.cover && local.coverExt ? this.coverPath(remote.id, local.coverExt) : "";
      const coverUrl = cover ? `${this.paths.mediaPrefix}${cover}?v=${local.cover}` : "";
      const { file: _file, cover: _cover, ...fields } = remote;
      return {
        ...(fields as unknown as Song),
        ...this.edits[remote.id],
        filePath: hasAudio ? `${this.paths.files}/${this.audioPath(remote.id, local.audioExt || remote.file.ext)}` : "",
        url: "",
        fileExists: hasAudio,
        coverPath: cover ? `${this.paths.files}/${cover}` : "",
        coverUrl,
        coverThumbUrl: coverUrl,
        coverThumbnailUrl: coverUrl,
        thumbnailUrl: coverUrl,
        coverFullUrl: coverUrl,
        fileSizeBytes: remote.file.size
      } as Song;
    });
  }

  /** Current phone values for merging: Mac fields with phone edits on top. */
  phoneSongFields(): SyncSongFields[] {
    return this.remoteSongs.map((remote) => ({ ...remote, ...this.edits[remote.id] } as SyncSongFields));
  }

  patchSong(id: string, patch: Partial<Song>) {
    const remote = this.remoteSongs.find((song) => song.id === id);
    if (!remote) return null;
    this.edits[id] = { ...this.edits[id], ...patch };
    if (typeof patch.liked === "boolean") this.likeClock[id] = Date.now() + this.clockOffset;
    this.revision += 1;
    void this.save(typeof patch.liked === "boolean" ? ["edits", "likeClock"] : ["edits"]);
    return this.songs().find((song) => song.id === id) || null;
  }

  /**
   * A like the Mac has: one it just confirmed from this phone, or one made on the Mac or another phone. It becomes
   * part of the Mac's copy, so the next batch sync doesn't send it again. A newer tap here that is still on its
   * way keeps its place. Returns whether the song's like changed.
   */
  adoptMacLike(id: string, liked: boolean, changedAt: number) {
    const remote = this.remoteSongs.find((song) => song.id === id);
    if (!remote || (this.likeClock[id] || 0) > changedAt) return false;
    const before = this.edits[id]?.liked ?? remote.liked;
    remote.liked = liked;
    if (this.base.songs[id]) this.base.songs[id] = { ...this.base.songs[id], liked };
    if (this.edits[id] && "liked" in this.edits[id]) {
      const { liked: _liked, ...rest } = this.edits[id];
      if (Object.keys(rest).length) this.edits[id] = rest;
      else delete this.edits[id];
    }
    this.likeClock[id] = changedAt;
    void this.save(["remoteSongs", "base", "edits", "likeClock"]);
    return before !== liked;
  }

  savePlaylists(playlists: SyncPlaylist[]) {
    this.playlists = playlists.map(({ id, name, songIds, createdAt, rules }) => ({ id, name, songIds: [...songIds], createdAt, ...(rules ? { rules } : {}) }));
    this.revision += 1;
    void this.save(["playlists"]);
    return this.playlists;
  }

  recordPlayEvent(event: PlayEvent) {
    const index = this.pendingEvents.findIndex((item) => item.id === event.id);
    if (index >= 0) this.pendingEvents[index] = event;
    else this.pendingEvents.push(event);
    this.revision += 1;
    void this.save(["pendingEvents"]);
    return true;
  }
}

export const phoneLibrary = new PhoneLibrary();
