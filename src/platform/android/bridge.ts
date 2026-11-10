import type { ArtistBio } from "../../features/discover/discover.types";
import type { Song } from "../../features/library/song.types";
import type { LyricsResult } from "../../features/lyrics/lyrics.types";
import type { Settings } from "../../features/settings/settings.types";
import type { PlayEvent } from "../../features/player/listeningHistory";
import type { ScrobbleStatus } from "../../features/scrobbling/scrobble.types";
import { phoneLibrary } from "./library";
import { fromMac, fromMacOrKept } from "./macFeatures";
import { LocaltifyNative } from "./native";
import { writeValues } from "./store";
import { setLibraryChangedHandler } from "./sync";
import type { SyncPlaylist } from "./syncMerge";

type Bridge = Window["localitfy"];
type Listener = (payload: never) => void;

const UNAVAILABLE = "Not available in the Android app. Use the Mac app for this.";

/** Desktop-only calls that return a song list; on the phone they leave the library as it is. */
const RETURNS_SONGS = new Set(["importSongs", "deleteSong", "clearLibrary", "randomizeAllSongCovers", "randomizeMissingSongCovers", "randomizeSelectedSongCovers", "rescanPixelArt"]);
const RETURNS_LIST = new Set(["listPixelArt", "listPixelCovers", "listBrokenCovers", "getPendingMusicBrainzTags", "searchMusicBrainz", "getMusicBrainzAlbumTracks"]);

/** A lyrics choice made from the phone replaces the copy kept for offline use. */
async function keepLyrics(id: string, answer: Promise<LyricsResult>) {
  const result = await answer;
  await writeValues({ [`mac:lyrics:${id}`]: result }).catch(() => undefined);
  return result;
}

export function createAndroidBridge(): Bridge {
  const listeners = new Map<string, Set<Listener>>();
  const emit = (event: string, payload: unknown) => {
    for (const listener of listeners.get(event) || []) (listener as (value: unknown) => void)(payload);
  };
  const subscribe = (event: string) => (listener: Listener) => {
    const bucket = listeners.get(event) ?? new Set<Listener>();
    bucket.add(listener);
    listeners.set(event, bucket);
    return () => { bucket.delete(listener); };
  };

  // After a sync, hand the open UI the new library the same way the Mac app reports watched-folder changes.
  setLibraryChangedHandler(() => {
    emit("songs", { importedCount: 0, libraryChanged: true, songs: phoneLibrary.songs() });
    emit("playlists", phoneLibrary.playlists);
  });

  // Android back, innermost first: menus and dialogs close the way Escape closes them on the Mac, then the phone's
  // own sheets (full-screen player, "more"), then the app's history (the hidden title-bar button), then leave the app.
  window.addEventListener("localtifyback", () => {
    // Native <dialog>s (similar songs, tagging…) close through their cancel event, the one Escape sends.
    const modal = Array.from(document.querySelectorAll("dialog[open]")).pop();
    if (modal) {
      modal.dispatchEvent(new Event("cancel", { cancelable: true }));
      return;
    }
    if (document.querySelector(".songContextMenuLayer, [role='menu'], [role='dialog']:not(.phonePlayerSheet):not(.phoneMoreSheet):not(.lyricsView)")) {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return;
    }
    if (!window.dispatchEvent(new Event("localtifyuiback", { cancelable: true }))) return;
    const back = document.querySelector<HTMLButtonElement>(".titleHistoryNav button");
    if (back && !back.disabled) emit("appMenu", { type: "back" });
    else void LocaltifyNative.moveToBackground();
  });

  const implemented: Partial<Bridge> = {
    bootstrap: async () => {
      await phoneLibrary.load();
      return { songs: phoneLibrary.songs(), settings: phoneLibrary.effectiveSettings(), playlists: phoneLibrary.playlists };
    },
    resolvePlaybackUrl: async ({ filePath }) => {
      const prefix = `${phoneLibrary.paths.files}/`;
      if (!filePath || !filePath.startsWith(prefix)) return { ok: false, fileExists: false, error: "song not copied to this phone yet" };
      return { ok: true, filePath, fileExists: true, url: `${phoneLibrary.paths.mediaPrefix}${filePath.slice(prefix.length)}`, cacheTtlMs: 24 * 60 * 60 * 1000 };
    },
    getSettings: async () => phoneLibrary.effectiveSettings(),
    saveSettings: async (settings: Partial<Settings>) => {
      phoneLibrary.settings = { ...phoneLibrary.settings, ...settings };
      await phoneLibrary.save(["settings"]);
      return phoneLibrary.effectiveSettings();
    },
    getPlaylists: async () => phoneLibrary.playlists,
    savePlaylists: async (playlists) => phoneLibrary.savePlaylists(playlists as SyncPlaylist[]),
    patchSong: async (id: string, patch: Partial<Song>) => phoneLibrary.patchSong(id, patch),
    recordPlayEvent: async (event: PlayEvent) => phoneLibrary.recordPlayEvent(event),
    getListeningCounts: async () => phoneLibrary.listeningCounts,
    onWatchedFoldersChange: subscribe("songs") as Bridge["onWatchedFoldersChange"],
    onPlaylistsChanged: subscribe("playlists") as Bridge["onPlaylistsChanged"],
    onAppMenuCommand: subscribe("appMenu") as Bridge["onAppMenuCommand"],
    getWatchedFolderStatus: async () => ({ scanning: false, lastImport: null, folders: [] }),
    // Made on the Mac (audio analysis, lyrics lookups, Last.fm), kept on the phone for when it is away from home.
    getDailyMixes: (payload) => fromMacOrKept("analysis:daily-mixes", payload ?? {}, "mac:daily-mixes", { day: "", edition: 0, generatedAt: 0, eligible: 0, mixes: [] }),
    findSimilarSongs: (query) => fromMacOrKept("analysis:similar-songs", query, `mac:similar:${JSON.stringify(query)}`, {
      seedId: "songId" in query ? query.songId : "seedKey" in query ? query.seedKey : "recent", status: "seed-unavailable", matches: [], compared: 0, seedCount: 0
    }),
    scorePromptSound: (payload) => fromMacOrKept("analysis:prompt-sound", payload, `mac:prompt:${payload.text.trim().toLowerCase()}`, { status: "model-missing", scores: [] }),
    getLyrics: (payload) => fromMacOrKept<LyricsResult>("lyrics:get", payload, `mac:lyrics:${payload.id}`, { status: "offline", source: "none", lines: [] }, (result) => result.status !== "error" && result.status !== "offline"),
    searchLyrics: (payload) => fromMac("lyrics:search", payload, 15000),
    selectLyricsMatch: (payload) => keepLyrics(payload.id, fromMac("lyrics:select-match", payload, 15000)),
    clearLyricsMatch: (payload) => keepLyrics(payload.id, fromMac("lyrics:clear-selection", payload, 15000)),
    setLyricsOffset: (payload) => fromMac("lyrics:set-offset", payload),
    getDiscoveries: (payload) => fromMacOrKept("discover:get", payload ?? {}, "mac:discover", { status: "off" }),
    getArtistBio: async (artist: string) => {
      if (phoneLibrary.effectiveSettings().discoverEnabled !== true) return { status: "off" };
      return fromMacOrKept<ArtistBio>("discover:artist-bio", { artist }, `mac:bio:${artist.trim().toLocaleLowerCase()}`, { status: "none" },
        (result) => result.status === "ready" || result.status === "none");
    },
    // The Mac does the scrobbling: phone plays reach it with each sync and it sends them on.
    getScrobbleStatus: () => fromMacOrKept<ScrobbleStatus>("scrobble:status", null, "mac:scrobble-status", {
      lastfm: { connected: false, username: "", waiting: 0, history: 0 },
      listenbrainz: { connected: false, username: "", waiting: 0, history: 0 },
      sent: 0, lastSentAt: 0, lastError: "", connecting: ""
    }),
    openExternal: async (url: string) => {
      window.open(url, "_blank");
      return { ok: true };
    }
  };

  return new Proxy(implemented as Bridge, {
    get(target, key) {
      if (typeof key !== "string") return undefined;
      if (key in target) return target[key as keyof Bridge];
      if (key.startsWith("on")) return () => () => undefined;
      // Desktop-only features answer "not available" instead of throwing, so the shared UI keeps working.
      if (RETURNS_SONGS.has(key)) return async () => phoneLibrary.songs();
      if (RETURNS_LIST.has(key)) return async () => [];
      return async () => ({ ok: false, error: UNAVAILABLE, message: UNAVAILABLE });
    }
  });
}
