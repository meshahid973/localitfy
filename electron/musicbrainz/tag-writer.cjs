"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const WRITABLE = new Set([".mp3", ".flac"]);
const MUSICBRAINZ_OWNER = "http://musicbrainz.org";

// Tags Picard fills in from the MusicBrainz match. When a file is re-matched to a different
// recording they describe the old (wrong) one, so they are cleared. Tags other tools wrote, like a
// downloader's TXXX:ISRC or copyright, are kept: they may be the only correct ones in the file.
const PICARD_KEYS = ["BARCODE", "CATALOGNUMBER", "ASIN", "Acoustid Id", "ACOUSTID_ID", "MusicBrainz Work Id", "MUSICBRAINZ_WORKID",
  "MusicBrainz Disc Id", "MUSICBRAINZ_DISCID", "ARTISTS", "ALBUMARTISTS", "originalyear", "ORIGINALDATE", "TDOR", "SCRIPT", "TMED", "MEDIA",
  "artist-sort", "album_artist-sort", "TSO2", "ARTISTSORT", "ALBUMARTISTSORT"];
const staleKeys = (flac) => [...PICARD_KEYS, ...(flac ? ["ISRC", "LABEL", "ORGANIZATION"] : ["TSRC", "publisher"])];

const canWriteTags = (filePath) => WRITABLE.has(path.extname(String(filePath || "")).toLowerCase());

/** Picard-compatible tag names: ID3 TXXX descriptions for MP3, Vorbis comments for FLAC. */
function metadataPairs(tags, ids, flac) {
  const pairs = {
    title: tags.title,
    artist: tags.artist,
    album: tags.album,
    album_artist: tags.albumArtist,
    date: tags.date,
    genre: tags.genre,
    track: tags.trackNumber ? (flac ? String(tags.trackNumber) : `${tags.trackNumber}${tags.trackTotal ? `/${tags.trackTotal}` : ""}`) : "",
    disc: tags.discNumber ? (flac ? String(tags.discNumber) : `${tags.discNumber}${tags.discTotal ? `/${tags.discTotal}` : ""}`) : "",
    [flac ? "ISRC" : "TSRC"]: tags.isrc
  };
  const extra = flac ? {
    TRACKTOTAL: tags.trackTotal ? String(tags.trackTotal) : "",
    DISCTOTAL: tags.discTotal ? String(tags.discTotal) : "",
    MUSICBRAINZ_TRACKID: ids.recordingId,
    MUSICBRAINZ_RELEASETRACKID: ids.releaseTrackId,
    MUSICBRAINZ_ALBUMID: ids.releaseId,
    MUSICBRAINZ_RELEASEGROUPID: ids.releaseGroupId,
    MUSICBRAINZ_ARTISTID: ids.artistIds.join("/"),
    MUSICBRAINZ_ALBUMARTISTID: ids.albumArtistIds.join("/"),
    RELEASETYPE: tags.releaseType,
    RELEASESTATUS: tags.releaseStatus,
    RELEASECOUNTRY: tags.releaseCountry
  } : {
    // The recording ID goes into a UFID frame afterwards; ffmpeg cannot write one.
    "MusicBrainz Release Track Id": ids.releaseTrackId,
    "MusicBrainz Album Id": ids.releaseId,
    "MusicBrainz Release Group Id": ids.releaseGroupId,
    "MusicBrainz Artist Id": ids.artistIds.join("/"),
    "MusicBrainz Album Artist Id": ids.albumArtistIds.join("/"),
    "MusicBrainz Album Type": tags.releaseType,
    "MusicBrainz Album Status": tags.releaseStatus,
    "MusicBrainz Album Release Country": tags.releaseCountry
  };
  return Object.entries({ ...pairs, ...extra }).filter(([, value]) => value);
}

function ffmpegArgs({ input, output, cover, tags, ids, clearStale = false }) {
  const flac = path.extname(input).toLowerCase() === ".flac";
  return [
    "-hide_banner", "-loglevel", "error", "-y", "-i", input, ...(cover ? ["-i", cover] : []),
    // Audio is copied as-is; a new cover replaces the old one, otherwise any existing cover is kept.
    "-map", "0:a", "-map", cover ? "1:v" : "0:v?", "-c", "copy", "-map_metadata", "0",
    // An empty value deletes the tag; the new values below are set afterwards.
    ...(clearStale ? staleKeys(flac).flatMap((key) => ["-metadata", `${key}=`]) : []),
    ...metadataPairs(tags, ids, flac).flatMap(([key, value]) => ["-metadata", `${key}=${value}`]),
    ...(cover ? ["-disposition:v", "attached_pic", "-metadata:s:v", "title=Album cover", "-metadata:s:v", "comment=Cover (front)"] : []),
    ...(flac ? [] : ["-id3v2_version", "4", "-write_id3v1", "1"]),
    "-f", flac ? "flac" : "mp3", output
  ];
}

const syncsafe = (value) => Buffer.from([(value >> 21) & 0x7f, (value >> 14) & 0x7f, (value >> 7) & 0x7f, value & 0x7f]);
const readSyncsafe = (buffer, offset) => (buffer[offset] << 21) | (buffer[offset + 1] << 14) | (buffer[offset + 2] << 7) | buffer[offset + 3];

/** Adds Picard's UFID frame (MusicBrainz recording ID) to the ID3v2.4 tag ffmpeg wrote. */
function withMusicBrainzUfid(buffer, recordingId) {
  if (buffer.toString("latin1", 0, 3) !== "ID3" || buffer[3] !== 4 || buffer[5] & 0xd0) throw new Error("unexpected ID3 tag layout");
  const end = 10 + readSyncsafe(buffer, 6);
  const frames = [];
  for (let offset = 10; offset + 10 <= end && buffer[offset] !== 0;) {
    const size = readSyncsafe(buffer, offset + 4);
    const frame = buffer.subarray(offset, offset + 10 + size);
    const isOurs = frame.toString("latin1", 0, 4) === "UFID" && frame.toString("latin1", 10, 10 + MUSICBRAINZ_OWNER.length + 1) === `${MUSICBRAINZ_OWNER}\0`;
    if (!isOurs) frames.push(frame);
    offset += 10 + size;
  }
  const body = Buffer.concat([Buffer.from(`${MUSICBRAINZ_OWNER}\0`, "latin1"), Buffer.from(recordingId, "latin1")]);
  frames.push(Buffer.concat([Buffer.from("UFID", "latin1"), syncsafe(body.length), Buffer.alloc(2), body]));
  const content = Buffer.concat(frames);
  return Buffer.concat([Buffer.from([0x49, 0x44, 0x33, 4, 0, 0]), syncsafe(content.length), content, buffer.subarray(end)]);
}

function runFfmpeg(ffmpegPath, args, spawnImpl = spawn) {
  return new Promise((resolve, reject) => {
    const child = spawnImpl(ffmpegPath, args, { windowsHide: true });
    let stderr = "";
    child.stderr?.on("data", (chunk) => { stderr = (stderr + chunk).slice(-2000); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(stderr.trim().split("\n").pop() || `ffmpeg exited with ${code}`)));
  });
}

/**
 * Writes MusicBrainz tags (and the cover) into an MP3 or FLAC file without re-encoding.
 * The result is verified before the original moves to the Trash, so a failure never loses the file.
 */
async function writeMusicBrainzTags({ filePath, tags, ids, cover = "", ffmpegPath, parseFile, trashItem, spawnImpl }) {
  if (!canWriteTags(filePath)) throw new Error("Only MP3 and FLAC files can be tagged");
  const ext = path.extname(filePath);
  const temp = path.join(path.dirname(filePath), `.${path.basename(filePath, ext)}.localtify-tagging${ext}`);
  let trashed = false;
  try {
    const before = await parseFile(filePath, { duration: true, skipCovers: true });
    // A file matched to another recording before was matched wrongly.
    const previous = before.common?.musicbrainz_recordingid;
    const clearStale = Boolean(previous && previous !== ids.recordingId);
    await runFfmpeg(ffmpegPath, ffmpegArgs({ input: filePath, output: temp, cover, tags, ids, clearStale }), spawnImpl);
    if (ext.toLowerCase() === ".mp3") fs.writeFileSync(temp, withMusicBrainzUfid(fs.readFileSync(temp), ids.recordingId));
    const after = await parseFile(temp, { duration: true, skipCovers: true });
    if (after.common?.musicbrainz_recordingid !== ids.recordingId || after.common?.title !== tags.title) throw new Error("tags did not verify after writing");
    if (Math.abs(Number(after.format?.duration || 0) - Number(before.format?.duration || 0)) > 1) throw new Error("audio length changed while tagging");
    await trashItem(filePath);
    trashed = true;
    fs.renameSync(temp, filePath);
  } finally {
    // Once the original is in the Trash the tagged copy is the only one left here; never delete it.
    if (!trashed && fs.existsSync(temp)) fs.rmSync(temp, { force: true });
  }
}

module.exports = { staleKeys, canWriteTags, metadataPairs, ffmpegArgs, withMusicBrainzUfid, writeMusicBrainzTags };
