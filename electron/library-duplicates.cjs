"use strict";

const path = require("node:path");

// Same recording: matching cleaned title and full artist credits, lengths within this many seconds,
// and (when both have audio profiles) at least this audio similarity.
const MAX_DURATION_GAP = 3;
const MIN_AUDIO_MATCH = .9;
const SAME_AUDIO = .97;
const USELESS_ALBUMS = new Set(["", "local files", "unknown album", "untitled album", "unknown", "single", "singles"]);
const FEAT = /\s*[([]\s*(?:feat\.?|ft\.?|featuring|with)\s+([^)\]]+)[)\]]|\s+(?:feat\.?|ft\.?|featuring)\s+(.+)$/i;
// Tags that describe the file rather than the recording. Anything else in brackets ("remix", "live", "solo version") is kept.
const NOISE = /\s*[([]\s*(?:(?:\d{4}\s+)?remaster(?:ed)?(?:\s+\d{4})?(?:\s+version)?|explicit|clean|official\s+(?:audio|video)|lyrics?(?:\s+video)?|audio|hq|hd)\s*[)\]]|\s+-\s+(?:\d{4}\s+)?remaster(?:ed)?.*$/gi;

function fold(text) {
  return String(text || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
function words(text) { return fold(text).replace(/[^\p{L}\p{N}]+/gu, " ").trim(); }
function splitArtists(text) {
  return String(text || "").split(/\s*(?:,|&|\+|\/|;|\s+and\s+|\s+x\s+|\s+feat\.?\s+|\s+ft\.?\s+|\s+featuring\s+|\s+with\s+)\s*/i).map(words).filter(Boolean);
}

/** Cleaned title (version markers kept) plus every credited artist, from both the artist field and "(feat. …)". */
function recordingKey(song) {
  let title = fold(song.title).replace(NOISE, "");
  const featured = [];
  for (let match = title.match(FEAT); match; match = title.match(FEAT)) {
    featured.push(...splitArtists(match[1] || match[2]));
    title = title.replace(match[0], " ");
  }
  const credits = [...new Set([...splitArtists(song.artist), ...featured])].sort();
  const cleaned = words(title);
  return cleaned && credits.length ? `${cleaned}|${credits.join("+")}` : "";
}

function albumName(song) {
  const name = words(song.album);
  return USELESS_ALBUMS.has(name) ? "" : name;
}

/** Folder, album and file variant: `08 Song.m4a`, `08 Song.mp3` and `08 Song (1).mp3` are three copies of an album. */
function copyOf(song) {
  const file = String(song.filePath || "");
  const extension = path.extname(file).toLowerCase();
  const stem = path.basename(file, path.extname(file));
  const copy = stem.match(/\s\((\d{1,2})\)$|\s+copy(?:\s+(\d{1,2}))?$/i);
  const trackMatch = stem.match(/^(\d{1,3})(?=[\s._-])/);
  return {
    key: [path.dirname(file), albumName(song), extension, copy ? `copy${copy[1] || copy[2] || 1}` : ""].join("|"),
    folder: path.dirname(file), album: albumName(song), extension: extension.replace(".", ""), duplicateName: Boolean(copy),
    track: trackMatch ? Number(trackMatch[1]) : null
  };
}

function cosine(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function sameRecording(a, b, vectors) {
  const gap = Math.abs((Number(a.duration) || 0) - (Number(b.duration) || 0));
  const va = vectors.get(a.id); const vb = vectors.get(b.id);
  const audio = va && vb ? cosine(va, vb) : null;
  if (Number(a.duration) > 0 && Number(b.duration) > 0 ? gap > MAX_DURATION_GAP : !(audio >= SAME_AUDIO)) return null;
  // Two numbered tracks of the same album folder are different songs (e.g. a song and its featured version).
  if (a.copy.folder === b.copy.folder && a.copy.album === b.copy.album && a.copy.track && b.copy.track && a.copy.track !== b.copy.track) return null;
  if (audio !== null && audio < MIN_AUDIO_MATCH) return null;
  return { audio, confidence: audio === null ? "metadata" : audio >= SAME_AUDIO ? "same-audio" : "similar-audio" };
}

function unionFind() {
  const parent = new Map();
  const find = (x) => { if (!parent.has(x)) parent.set(x, x); let root = x; while (parent.get(root) !== root) root = parent.get(root); parent.set(x, root); return root; };
  return { find, union: (a, b) => { const ra = find(a); const rb = find(b); if (ra !== rb) parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb); } };
}

/**
 * Duplicate groups, organised into sets that are decided together: every group whose copies are linked
 * (two copies of one album, a single and its album) shares one ranking of copies, so a whole copy is kept.
 * `vectors` maps song ID to a normalized audio profile; `fileSizes` maps song ID to bytes.
 */
function findDuplicates(songs, { vectors = new Map(), fileSizes = new Map() } = {}) {
  const tracks = songs.filter((song) => song?.id && song.filePath && song.fileExists !== false)
    .map((song) => ({ ...song, copy: copyOf(song), recording: recordingKey(song) }));
  const copySizes = new Map();
  for (const track of tracks) copySizes.set(track.copy.key, (copySizes.get(track.copy.key) || 0) + 1);

  const buckets = new Map();
  for (const track of tracks) if (track.recording) (buckets.get(track.recording) || buckets.set(track.recording, []).get(track.recording)).push(track);
  const songsUnion = unionFind(); const pairs = new Map();
  for (const bucket of buckets.values()) {
    for (let i = 0; i < bucket.length; i++) for (let j = i + 1; j < bucket.length; j++) {
      const match = sameRecording(bucket[i], bucket[j], vectors);
      if (!match) continue;
      songsUnion.union(bucket[i].id, bucket[j].id);
      pairs.set(`${bucket[i].id}|${bucket[j].id}`, match);
    }
  }
  const byId = new Map(tracks.map((track) => [track.id, track]));
  const groups = new Map();
  for (const key of pairs.keys()) for (const id of key.split("|")) {
    const root = songsUnion.find(id);
    if (!groups.has(root)) groups.set(root, new Set());
    groups.get(root).add(id);
  }

  // Copies of one album, or a single and the album that contains it, are decided together.
  const copiesUnion = unionFind();
  for (const ids of groups.values()) { const keys = [...ids].map((id) => byId.get(id).copy.key); keys.forEach((key) => copiesUnion.union(keys[0], key)); }
  const bitrate = (track) => { const size = fileSizes.get(track.id); return size && track.duration > 0 ? size / track.duration : 0; };
  const copyStats = new Map();
  for (const track of tracks) {
    const stats = copyStats.get(track.copy.key) || { key: track.copy.key, folder: track.copy.folder, album: track.copy.album,
      extension: track.copy.extension, duplicateName: track.copy.duplicateName, trackCount: copySizes.get(track.copy.key), rate: 0, rated: 0, plays: 0, added: Infinity };
    const rate = bitrate(track); if (rate) { stats.rate += rate; stats.rated += 1; }
    stats.plays += (Number(track.playCount) || 0) + (track.liked ? 5 : 0);
    stats.added = Math.min(stats.added, Date.parse(track.dateAdded || "") || Infinity);
    copyStats.set(track.copy.key, stats);
  }
  // Completeness first, so an album is never split; then the original file name, quality, and listening.
  const rank = (a, b) => b.trackCount - a.trackCount || Number(a.duplicateName) - Number(b.duplicateName)
    || (b.rated ? b.rate / b.rated : 0) - (a.rated ? a.rate / a.rated : 0) || b.plays - a.plays || a.added - b.added || (a.key < b.key ? -1 : 1);

  const sets = new Map();
  for (const ids of groups.values()) {
    const members = [...ids].map((id) => byId.get(id));
    const setKey = copiesUnion.find(members[0].copy.key);
    const set = sets.get(setKey) || { copies: new Set(), groups: [] };
    for (const member of members) set.copies.add(member.copy.key);
    const ordered = members.sort((a, b) => rank(copyStats.get(a.copy.key), copyStats.get(b.copy.key)) || bitrate(b) - bitrate(a) || (a.id < b.id ? -1 : 1));
    const confidences = [];
    for (let i = 0; i < ordered.length; i++) for (let j = i + 1; j < ordered.length; j++) {
      const match = pairs.get(`${ordered[i].id}|${ordered[j].id}`) || pairs.get(`${ordered[j].id}|${ordered[i].id}`);
      if (match) confidences.push(match.confidence);
    }
    set.groups.push({ id: ordered.map((track) => track.id).sort().join("+"), keepId: ordered[0].id,
      songs: ordered.map((track) => ({ id: track.id, copyKey: track.copy.key, track: track.copy.track })),
      confidence: confidences.includes("metadata") ? "metadata" : confidences.includes("similar-audio") ? "similar-audio" : "same-audio" });
    sets.set(setKey, set);
  }
  return [...sets.values()].map((set) => {
    const copies = [...set.copies].map((key) => copyStats.get(key)).sort(rank)
      .map(({ key, folder, album, extension, duplicateName, trackCount, rate, rated }) => ({
        key, folder, album, extension, duplicateName, trackCount, kbps: rated ? Math.round(rate / rated * 8 / 1000) : null }));
    set.groups.sort((a, b) => (byId.get(a.keepId).copy.track ?? 999) - (byId.get(b.keepId).copy.track ?? 999) || (a.id < b.id ? -1 : 1));
    return { id: copies.map((copy) => copy.key).join("&"), kind: set.groups.length > 1 ? "album" : "track",
      recommendedCopy: copies[0].key, copies, groups: set.groups };
  }).sort((a, b) => b.groups.length - a.groups.length || (a.id < b.id ? -1 : 1));
}

/** The merges a reviewed plan asks for, checked against a fresh scan: only songs in the same group can be merged. */
function validateMerges(requested, sets) {
  if (!Array.isArray(requested) || !requested.length || requested.length > 5000) throw new TypeError("Choose duplicates to merge");
  const groupOf = new Map();
  for (const set of sets) for (const group of set.groups) for (const song of group.songs) groupOf.set(song.id, group.id);
  const seen = new Set();
  return requested.map((item) => {
    const keepId = item?.keepId; const removeIds = Array.isArray(item?.removeIds) ? [...new Set(item.removeIds)] : [];
    if (typeof keepId !== "string" || !removeIds.length || removeIds.some((id) => typeof id !== "string")) throw new TypeError("Invalid merge");
    for (const id of [keepId, ...removeIds]) {
      if (!groupOf.has(id) || groupOf.get(id) !== groupOf.get(keepId)) throw new Error("These songs are no longer duplicates. Scan again.");
      if (seen.has(id)) throw new TypeError("A song appears in more than one merge");
      seen.add(id);
    }
    return { keepId, removeIds };
  });
}

module.exports = { recordingKey, copyOf, findDuplicates, validateMerges };
