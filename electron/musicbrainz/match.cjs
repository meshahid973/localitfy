"use strict";

// Bracketed parts that MusicBrainz keeps out of titles: credits and upload noise.
const NOISE = /[([](?:&|(?:feat\.?|ft\.?|with|prod\.?|official|audio|video|lyrics?|visuali[sz]er|explicit|clean|hq|hd|remaster(?:ed)?)\b)[^)\]]*[)\]]/gi;

function normalize(value) {
  return String(value || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(NOISE, " ").replace(/\b(?:feat\.?|ft\.?)\s.*$/, " ").replace(/&/g, " and ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** Dice coefficient over character bigrams of the normalized strings. */
function similarity(a, b) {
  const left = normalize(a).replace(/ /g, "");
  const right = normalize(b).replace(/ /g, "");
  if (!left || !right) return 0;
  if (left === right) return 1;
  const pairs = (text) => { const map = new Map(); for (let i = 0; i < text.length - 1; i += 1) { const pair = text.slice(i, i + 2); map.set(pair, (map.get(pair) || 0) + 1); } return map; };
  const leftPairs = pairs(left);
  const rightPairs = pairs(right);
  let shared = 0;
  for (const [pair, count] of leftPairs) shared += Math.min(count, rightPairs.get(pair) || 0);
  return (2 * shared) / Math.max(1, left.length + right.length - 2);
}

const creditText = (credit = []) => credit.map((part) => `${part.name || part.artist?.name || ""}${part.joinphrase || ""}`).join("").trim();
const creditIds = (credit = []) => credit.map((part) => part.artist?.id).filter(Boolean);

/** The first credited name in a local artist string, e.g. "Kanye West, Jay-Z" → "Kanye West". */
const primaryArtist = (artist) => String(artist || "").split(/\s*(?:,|;| & | x | feat\.? | ft\.? | with )\s*/i)[0] || "";

function artistScore(localArtist, credit) {
  const names = credit.map((part) => part.name || part.artist?.name || "");
  return Math.max(similarity(localArtist, creditText(credit)), ...names.map((name) => similarity(primaryArtist(localArtist), name)), 0);
}

function durationScore(localMs, remoteMs) {
  if (!localMs || !remoteMs) return 0.5;
  const delta = Math.abs(localMs - remoteMs) / 1000;
  return delta <= 3 ? 1 : Math.max(0, 1 - (delta - 3) / 12);
}

function recordingScore(song, recording) {
  return 0.5 * similarity(song.title, recording.title) + 0.25 * artistScore(song.artist, recording["artist-credit"] || []) + 0.25 * durationScore(song.durationMs, recording.length);
}

const SECONDARY_PENALTY = new Set(["Compilation", "Soundtrack", "Live", "Remix", "DJ-mix", "Mixtape/Street", "Demo"]);

/** Prefers the official original album (then EP, then single) over compilations and reissues. */
function releaseRank(release) {
  const group = release["release-group"] || {};
  const type = group["primary-type"] || "";
  let rank = release.status === "Official" ? 3 : 0;
  rank += type === "Album" ? 2 : type === "EP" ? 1.5 : type === "Single" ? 1 : 0;
  if ((group["secondary-types"] || []).some((secondary) => SECONDARY_PENALTY.has(secondary))) rank -= 3;
  if (/various artists/i.test(creditText(release["artist-credit"] || []))) rank -= 2;
  const year = Number(String(release.date || "").slice(0, 4)) || 9999;
  return rank - (year - 1900) / 1000;
}

function formatGenres(genres = []) {
  const sorted = [...genres].filter((genre) => genre?.name).sort((a, b) => (b.count || 0) - (a.count || 0));
  const top = sorted[0]?.count || 0;
  return sorted.filter((genre) => (genre.count || 0) >= Math.max(1, top * 0.4)).slice(0, 3)
    .map((genre) => genre.name.replace(/(^|[\s-])(\p{L})/gu, (_, lead, letter) => lead + letter.toUpperCase())).join("; ");
}

/** Everything written to the file and the library for one accepted match. */
function buildProposal(song, { recording, release, track, medium, score, genre }) {
  const group = release["release-group"] || {};
  const recordingCredit = recording["artist-credit"] || track?.["artist-credit"] || [];
  const releaseCredit = release["artist-credit"] || recordingCredit;
  const date = String(release.date || recording["first-release-date"] || "");
  return {
    songId: song.id,
    confidence: Math.round(score * 100) / 100,
    current: { title: song.title, artist: song.artist, album: song.album, genre: song.genre || "" },
    tags: {
      title: recording.title,
      artist: creditText(recordingCredit),
      album: release.title,
      albumArtist: creditText(releaseCredit),
      date,
      year: date.slice(0, 4),
      trackNumber: Number(track?.position || track?.number) || (Number.isFinite(medium?.["track-offset"]) ? medium["track-offset"] + 1 : 0),
      trackTotal: Number(medium?.["track-count"] || (medium?.track || medium?.tracks || []).length || 0) || 0,
      discNumber: Number(medium?.position || 1) || 1,
      discTotal: Number((release.media || []).length || release["medium-count"] || 1) || 1,
      genre,
      releaseType: String(group["primary-type"] || "").toLowerCase(),
      releaseStatus: String(release.status || "").toLowerCase(),
      releaseCountry: String(release.country || ""),
      isrc: String((recording.isrcs || [])[0] || "")
    },
    // Compilation and soundtrack genres describe the collection, not the song.
    genreFromArtist: (group["secondary-types"] || []).length > 0,
    ids: {
      recordingId: recording.id,
      releaseId: release.id,
      releaseGroupId: group.id || "",
      releaseTrackId: track?.id && track.id !== recording.id ? track.id : "",
      artistIds: creditIds(recordingCredit),
      albumArtistIds: creditIds(releaseCredit)
    }
  };
}

const bestRelease = (recording) => [...(recording.releases || [])].sort((a, b) => releaseRank(b) - releaseRank(a))[0];

/**
 * Best recording + release for a single song. MusicBrainz often has the same song as several
 * recordings (album, compilations, soundtracks), so among near-equal matches the one on the
 * strongest release wins.
 */
function pickRecording(song, recordings) {
  const scored = recordings.map((recording) => ({ recording, score: recordingScore(song, recording), release: bestRelease(recording) })).filter((entry) => entry.release);
  if (!scored.length) return null;
  const top = Math.max(...scored.map((entry) => entry.score));
  const { recording, score, release } = scored.filter((entry) => entry.score >= top - 0.05)
    .sort((a, b) => releaseRank(b.release) - releaseRank(a.release) || b.score - a.score)[0];
  const medium = release.media?.[0];
  const track = medium?.track?.[0] || medium?.tracks?.[0];
  return { recording, score, release, medium: medium && { ...medium, "track-count": medium["track-count"] || release["track-count"] }, track };
}

/** Pairs local songs with the tracks of a full release, best pairs first. */
function matchReleaseTracks(songs, release) {
  const tracks = (release.media || []).flatMap((medium) => (medium.tracks || medium.track || []).map((track) => ({ medium, track })));
  const pairs = [];
  for (const song of songs) {
    for (const entry of tracks) {
      const recording = entry.track.recording || {};
      const score = 0.7 * Math.max(similarity(song.title, entry.track.title), similarity(song.title, recording.title)) + 0.3 * durationScore(song.durationMs, entry.track.length || recording.length);
      pairs.push({ song, ...entry, recording, score });
    }
  }
  pairs.sort((a, b) => b.score - a.score);
  const usedSongs = new Set();
  const usedTracks = new Set();
  const matches = [];
  for (const pair of pairs) {
    if (pair.score < 0.6 || usedSongs.has(pair.song.id) || usedTracks.has(pair.track.id)) continue;
    usedSongs.add(pair.song.id);
    usedTracks.add(pair.track.id);
    matches.push(pair);
  }
  return matches;
}

module.exports = { normalize, similarity, creditText, primaryArtist, artistScore, durationScore, recordingScore, releaseRank, formatGenres, buildProposal, pickRecording, matchReleaseTracks };
