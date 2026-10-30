"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_ALBUM = "local files";

/** A song counts as tagged only when it carries a MusicBrainz recording ID (not a release-track ID). */
async function readMusicBrainzIds(filePath, parseFile) {
  try {
    const { common = {} } = await parseFile(filePath, { duration: false, skipCovers: true });
    return { recordingId: String(common.musicbrainz_recordingid || ""), releaseId: String(common.musicbrainz_albumid || "") };
  } catch (error) {
    return { recordingId: "", releaseId: "", error: error?.message || "unreadable" };
  }
}

function albumGroupKey(song) {
  const folder = path.dirname(String(song.filePath || ""));
  const album = String(song.album || DEFAULT_ALBUM).trim();
  // Downloads all share "local files", so group those singles by artist instead.
  return album.toLocaleLowerCase() === DEFAULT_ALBUM ? `singles\0${String(song.artist || "").toLocaleLowerCase()}\0${folder}` : `${album.toLocaleLowerCase()}\0${folder}`;
}

function summarizeAudit(songs, idsBySongId) {
  const groups = new Map();
  let tagged = 0;
  let missing = 0;
  for (const song of songs) {
    const ids = idsBySongId.get(song.id);
    if (!ids) { missing += 1; continue; }
    if (ids.recordingId) tagged += 1;
    const key = albumGroupKey(song);
    if (!groups.has(key)) {
      const singles = key.startsWith("singles\0");
      groups.set(key, { key, album: singles ? "" : song.album, artist: song.artist, folder: path.dirname(song.filePath), songIds: [], untaggedIds: [], releases: new Set() });
    }
    const group = groups.get(key);
    group.songIds.push(song.id);
    if (!ids.recordingId) group.untaggedIds.push(song.id);
    else if (ids.releaseId) group.releases.add(ids.releaseId);
  }
  const albums = [...groups.values()].map(({ releases, ...group }) => ({ ...group, releaseCount: releases.size }));
  return {
    total: songs.length,
    tagged,
    missing,
    untaggedCount: albums.reduce((sum, group) => sum + group.untaggedIds.length, 0),
    untagged: albums.filter((group) => group.untaggedIds.length).sort((a, b) => b.untaggedIds.length - a.untaggedIds.length),
    // An album whose tracks point at different MusicBrainz releases was matched track by track, not as one album.
    splitAlbums: albums.filter((group) => group.album && !group.untaggedIds.length && group.releaseCount > 1).sort((a, b) => b.releaseCount - a.releaseCount)
  };
}

function createTagAuditor({ parseFile, stat = fs.promises.stat, concurrency = 8 }) {
  const cache = new Map();
  async function idsFor(filePath) {
    let info;
    try { info = await stat(filePath); } catch { return null; }
    const cached = cache.get(filePath);
    if (cached && cached.mtimeMs === info.mtimeMs && cached.size === info.size) return cached.ids;
    const ids = await readMusicBrainzIds(filePath, parseFile);
    cache.set(filePath, { mtimeMs: info.mtimeMs, size: info.size, ids });
    return ids;
  }
  return {
    idsFor,
    async audit(songs) {
      const idsBySongId = new Map();
      let next = 0;
      const worker = async () => {
        while (next < songs.length) {
          const song = songs[next++];
          const ids = song.filePath ? await idsFor(song.filePath) : null;
          if (ids) idsBySongId.set(song.id, ids);
        }
      };
      await Promise.all(Array.from({ length: Math.min(concurrency, songs.length) }, worker));
      return summarizeAudit(songs, idsBySongId);
    }
  };
}

module.exports = { albumGroupKey, readMusicBrainzIds, summarizeAudit, createTagAuditor };
