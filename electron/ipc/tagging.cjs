"use strict";

const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const path = require("node:path");
const { createTagAuditor, albumGroupKey } = require("../musicbrainz/audit.cjs");
const { createMusicBrainzClient } = require("../musicbrainz/client.cjs");
const { createTaggingLookup } = require("../musicbrainz/lookup.cjs");
const { canWriteTags, writeMusicBrainzTags } = require("../musicbrainz/tag-writer.cjs");

const loadParseFile = async (...args) => (await import("music-metadata")).parseFile(...args);

// Security gate: keep file writes disabled until atomic replacement and recovery tests pass.
// Metadata-only tagging in the SQLite library remains available.
const MUSICBRAINZ_FILE_WRITES_ENABLED = false;

/**
 * MusicBrainz tagging inside the app: find songs without MusicBrainz IDs, look them up,
 * show the proposed tags, then write the accepted ones into the files and the library.
 * Covers are downloaded during lookup, so previews and applied covers are local files.
 */
function registerTaggingIpc(router, deps) {
  const { app, songs: repository, getSettings, readLocalAudioMetadata, listSongsShaped, safeMediaUrl, clearFileInfoCache, getWindow } = deps;
  const parseFile = deps.parseFile || loadParseFile;
  const shell = deps.shell || require("electron").shell;
  const ffmpegPath = deps.ffmpegPath || String(require("ffmpeg-static") || "").replace("app.asar", "app.asar.unpacked");
  const userAgent = `localtify/${app.getVersion()} ( https://github.com/meshahid973/localitfy )`;
  const fetchImpl = deps.fetchImpl || fetch;
  const auditor = createTagAuditor({ parseFile });
  const lookup = createTaggingLookup({ client: deps.musicBrainzClient || createMusicBrainzClient({ userAgent, fetchImpl, ...deps.clientOptions }), coverDir: path.join(app.getPath("userData"), "musicbrainz-covers"), userAgent, fetchImpl });
  // Proposals stay in the main process; the renderer only ever sends song IDs back.
  const proposals = new Map();
  const snapshots = new WeakMap();
  const snapshotKeys = ["title", "artist", "album", "genre", "filePath", "coverPath", "coverSource", "coverUpdatedAt"];
  const snapshot = song => {
    const stat = fs.statSync(song.filePath);
    return { fields: Object.fromEntries(snapshotKeys.map(key => [key, song[key] ?? null])), size: stat.size, mtimeMs: stat.mtimeMs };
  };
  const remember = (proposal, before, manual = false) => {
    proposal.previewId = randomUUID();
    if (manual) proposal.manual = true;
    snapshots.set(proposal, before);
    proposals.set(proposal.songId, proposal);
  };

  const MAX_UNDO_TRACKS = 10000;
  let lastUndo = null;
  const notifyChanges = (count) => {
    clearFileInfoCache?.();
    const window = getWindow();
    if (count && window && !window.isDestroyed()) window.webContents.send("library:watched-change", { importedCount: 0, libraryChanged: true, songs: listSongsShaped() });
  };
  const requireEnabled = () => { if (getSettings()?.musicbrainzTagging !== true) throw new Error("Turn on MusicBrainz tagging first"); };
  const songsFor = (ids) => [...new Set((Array.isArray(ids) ? ids : []).map(String))].map((id) => repository.get(id)).filter((song) => song?.filePath && fs.existsSync(song.filePath));

  const view = (proposal) => {
    const song = repository.get(proposal.songId);
    return {
      songId: proposal.songId, groupKey: song ? albumGroupKey(song) : "", confidence: proposal.confidence, current: proposal.current, tags: proposal.tags,
      coverUrl: proposal.coverPath ? safeMediaUrl(proposal.coverPath) : "",
      musicbrainzUrl: `https://musicbrainz.org/recording/${proposal.ids.recordingId}`,
      writable: MUSICBRAINZ_FILE_WRITES_ENABLED && canWriteTags(song?.filePath)
    };
  };

  // Lookups finished while the panel was closed are still waiting here.
  // Hand-picked matches belong to their dialog, so they never reappear in the settings panel.
  router.handle("tagging:pending", () => { requireEnabled(); return [...proposals.values()].filter((proposal) => !proposal.manual && repository.get(proposal.songId)).map(view); });

  router.handle("tagging:audit", async () => { requireEnabled(); return auditor.audit(repository.list()); });

  router.handle("tagging:lookup", async (_event, payload = {}) => {
    requireEnabled();
    const groups = new Map();
    for (const song of songsFor(payload.songIds)) {
      const key = albumGroupKey(song);
      groups.set(key, [...(groups.get(key) || []), song]);
    }
    const found = [];
    const missed = [];
    for (const songs of groups.values()) {
      const before = new Map(songs.map(song => [song.id, snapshot(song)]));
    const result = await lookup.lookupGroup(songs);
      for (const proposal of result.proposals) { remember(proposal, before.get(proposal.songId)); found.push(view(proposal)); }
      missed.push(...result.missed);
    }
    return { proposals: found, missed };
  });

  // Right-click → "find on MusicBrainz": the user types the search and picks the release.
  router.handle("tagging:search", async (_event, payload = {}) => {
    requireEnabled();
    const [song] = songsFor([payload.songId]);
    if (!song) throw new Error("This song's file could not be found");
    return lookup.searchCandidates(song, { title: String(payload.title || song.title || ""), artist: String(payload.artist ?? song.artist ?? "") });
  });

  router.handle("tagging:choose", async (_event, payload = {}) => {
    requireEnabled();
    const [song] = songsFor([payload.songId]);
    if (!song) throw new Error("This song's file could not be found");
    const before = snapshot(song);
    const proposal = await lookup.proposalFor(song, { recordingId: String(payload.recordingId || ""), releaseId: String(payload.releaseId || "") });
    remember(proposal, before, true);
    return view(proposal);
  });

  // Album right-click → "find on MusicBrainz": the whole album is matched to the release the user picks.
  router.handle("tagging:search-album", async (_event, payload = {}) => {
    requireEnabled();
    const songs = songsFor(payload.songIds);
    if (!songs.length) throw new Error("None of this album's files could be found");
    return lookup.searchAlbumCandidates(songs, { album: String(payload.album || songs[0].album || ""), artist: String(payload.artist ?? songs[0].artist ?? "") });
  });

  router.handle("tagging:choose-album", async (_event, payload = {}) => {
    requireEnabled();
    const songs = songsFor(payload.songIds);
    if (!songs.length) throw new Error("None of this album's files could be found");
    const before = new Map(songs.map(song => [song.id, snapshot(song)]));
    const result = await lookup.albumProposalsFor(songs, String(payload.releaseId || ""));
    for (const proposal of result.proposals) remember(proposal, before.get(proposal.songId), true);
    return { proposals: result.proposals.map(view), missed: result.missed };
  });

  // "Complete album": the release's whole track list, with what's already in the library marked.
  // From an album ({ songIds }), a Discover song ({ title, artist }), or another edition ({ releaseId }).
  router.handle("tagging:album-tracks", async (_event, payload = {}) => {
    requireEnabled();
    const songs = songsFor(payload.songIds);
    let releaseId = String(payload.releaseId || "");
    if (!releaseId && songs.length) releaseId = await lookup.releaseForSongs(songs, await Promise.all(songs.map(async (song) => (await auditor.idsFor(song.filePath))?.releaseId)));
    if (!releaseId && payload.title) releaseId = await lookup.releaseForSong({ title: String(payload.title), artist: String(payload.artist || ""), durationMs: Number(payload.durationMs || 0) });
    if (!releaseId) return null;
    const result = await lookup.albumTracks({ releaseId, songs, library: repository.list() });
    return { ...result, coverUrl: result.coverPath ? safeMediaUrl(result.coverPath) : "", coverPath: undefined };
  });

  router.handle("tagging:apply", async (_event, payload = {}) => {
    requireEnabled();
    const writeFiles = MUSICBRAINZ_FILE_WRITES_ENABLED && getSettings()?.musicbrainzWriteFiles === true;
    let applied = 0;
    let written = 0;
    const failed = [];
    const undoEntries = [];
    for (const id of new Set((Array.isArray(payload.songIds) ? payload.songIds : []).map(String))) {
      const song = repository.get(id);
      const proposal = proposals.get(id);
      if (!song?.filePath || !fs.existsSync(song.filePath) || !proposal) {
        failed.push({ songId: id, title: song?.title || id, error: "Song or matching proposal is no longer available" });
        continue;
      }
      try {
        if (!proposal.previewId || payload.previewIds?.[id] !== proposal.previewId) throw new Error("Preview changed since it was shown; look up the song again before applying");
        const baseline = snapshots.get(proposal);
        const keys = proposal.coverPath ? snapshotKeys : snapshotKeys.slice(0, 5);
        if (!baseline || keys.some(key => (song[key] ?? null) !== baseline.fields[key])) {
          throw new Error("Metadata changed since preview; look up the song again before applying");
        }
        const currentFile = fs.statSync(song.filePath);
        if (currentFile.size !== baseline.size || currentFile.mtimeMs !== baseline.mtimeMs) throw new Error("Audio file changed since preview; look up the song again before applying");
        const write = writeFiles && canWriteTags(song.filePath);
        if (write) {
          await writeMusicBrainzTags({ filePath: song.filePath, tags: proposal.tags, ids: proposal.ids, cover: proposal.coverPath, ffmpegPath, parseFile, trashItem: (file) => shell.trashItem(file) });
          written += 1;
        }
        const patch = Object.fromEntries(["title", "artist", "album", "genre"].map((key) => [key, proposal.tags[key]]).filter(([, value]) => value));
        if (write && proposal.coverPath) {
          const metadata = await readLocalAudioMetadata(song.filePath, { readCover: true });
          if (metadata?.embeddedCoverPath) Object.assign(patch, { coverPath: metadata.embeddedCoverPath, coverSource: "embedded", coverUpdatedAt: new Date().toISOString() });
        } else if (proposal.coverPath) {
          Object.assign(patch, { coverPath: proposal.coverPath, coverSource: "custom", coverUpdatedAt: new Date().toISOString() });
        }
        const before = Object.fromEntries(Object.keys(patch).map(key => [key, song[key] ?? null]));
        repository.patch(song.id, patch);
        const after = repository.get(song.id);
        if (!after) throw new Error("Song disappeared during save");
        if (!write && undoEntries.length <= MAX_UNDO_TRACKS) undoEntries.push({ songId: song.id, filePath: song.filePath, fileSize: currentFile.size, fileMtimeMs: currentFile.mtimeMs, before, after: Object.fromEntries(Object.keys(patch).map(key => [key, after[key] ?? null])) });
        proposals.delete(song.id);
        applied += 1;
      } catch (error) {
        failed.push({ songId: song.id, title: song.title, error: error?.message || "tagging failed" });
      }
    }
    if (applied) lastUndo = written === 0 && undoEntries.length && undoEntries.length <= MAX_UNDO_TRACKS ? { id: randomUUID(), entries: undoEntries } : null;
    notifyChanges(applied);
    return { applied, written, failed, ...(applied && lastUndo ? { undoId: lastUndo.id } : {}) };
  });

  // Only the last successful library-only save can be undone. The native journal
  // prevents a renderer from supplying arbitrary restore values or overwriting later edits.
  router.handle("tagging:undo-state", () => {
    requireEnabled();
    return lastUndo ? { id: lastUndo.id, count: lastUndo.entries.length } : null;
  });
  router.handle("tagging:undo", (_event, payload = {}) => {
    requireEnabled();
    if (!lastUndo || payload.id !== lastUndo.id) throw new Error("This undo is no longer available");
    const { entries } = lastUndo;
    lastUndo = null;
    let restored = 0;
    const failed = [];
    for (const entry of entries) {
      const song = repository.get(entry.songId);
      try {
        if (!song || song.filePath !== entry.filePath || Object.keys(entry.after).some(key => (song[key] ?? null) !== entry.after[key])) throw new Error("Song changed after save; newer edits were kept");
        const currentFile = fs.statSync(song.filePath);
        if (currentFile.size !== entry.fileSize || currentFile.mtimeMs !== entry.fileMtimeMs) throw new Error("Audio file changed after save; newer files were kept");
        repository.patch(entry.songId, entry.before);
        proposals.delete(entry.songId);
        restored += 1;
      } catch (error) {
        failed.push({ songId: entry.songId, title: song?.title || entry.songId, error: error?.message || "Undo failed" });
      }
    }
    notifyChanges(restored);
    return { restored, failed };
  });
}

module.exports = { registerTaggingIpc };
