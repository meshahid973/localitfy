"use strict";

// Discover: music from outside your library, picked from what Last.fm says is similar to what you own and play.
// Artists you already have and artists marked "not for me" are left out; songs you already have are left out.
const { artistCredits, notForMeTest } = require("../analysis/listening-signals.cjs");

const DAY_MS = 24 * 60 * 60 * 1000;
const SEED_ARTISTS = 15;
const MISSING_SONG_ARTISTS = 8;
const MISSING_SONGS_PER_ARTIST = 4;
const RESULT_ARTISTS = 24;
const TOP_TRACK_ARTISTS = 12;
const MAX_REASONS = 3;
// Each further pick led by the same artist you play counts for less, so one favourite can't fill the page.
const REPEAT_LEAD_PENALTY = .6;

const key = (text) => String(text || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
// "Song (feat. X) - 2011 Remaster" and "song" are the same song for "do I already have it".
function titleKey(title) {
  return key(title).replace(/\s*[([][^)\]]*[)\]]/g, "").replace(/\s+-\s+.*(remaster|version|edit|mix|live).*$/, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
const trackKey = (artist, title) => `${key(artistCredits(artist)[0])}|${titleKey(title)}`;

/** Who you listen to most (plays, likes, recent listening), and which artists and songs you already have. */
function libraryTaste(songs, hidden, now = Date.now()) {
  const artists = new Map();
  const ownedArtists = new Set();
  const ownedTracks = new Set();
  for (const song of songs) {
    const credits = artistCredits(song.artist);
    if (!credits.length) continue;
    ownedTracks.add(trackKey(song.artist, song.title));
    const recent = now - (Date.parse(song.lastPlayed || "") || 0) < 30 * DAY_MS;
    const weight = .1 + Math.log1p(Number(song.playCount) || 0) + (song.liked ? 1.5 : 0) + (recent ? .5 : 0);
    credits.forEach((name, index) => {
      ownedArtists.add(key(name));
      if (key(name) === "unknown artist" || hidden({ artist: name })) return;
      const entry = artists.get(key(name)) || { name, weight: 0 };
      // The lead artist carries the song; featured artists count for less.
      entry.weight += index === 0 ? weight : weight / 2;
      artists.set(key(name), entry);
    });
  }
  const seeds = [...artists.values()].sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name)).slice(0, SEED_ARTISTS);
  const top = seeds[0]?.weight || 1;
  // Square-rooted so a favourite with ten times the plays leads, but doesn't drown out everyone else.
  seeds.forEach((seed) => { seed.weight = Math.sqrt(seed.weight / top); });
  return { seeds, ownedArtists, ownedTracks };
}

// Every lookup is tried; one artist Last.fm doesn't know shouldn't sink the rest. A rejected key stops everything.
async function settleAll(items, lookup) {
  const results = await Promise.allSettled(items.map(lookup));
  const failure = results.find((result) => result.status === "rejected");
  if (failure && (failure.reason?.code === "bad-key" || results.every((result) => result.status === "rejected"))) throw failure.reason;
  return results.map((result) => (result.status === "fulfilled" ? result.value : []));
}

function addReason(entry, reason, amount) {
  entry.score += amount;
  const existing = entry.reasons.find((item) => item.name === reason);
  if (existing) existing.amount += amount; else entry.reasons.push({ name: reason, amount });
}
const because = (entry) => entry.reasons.sort((a, b) => b.amount - a.amount).slice(0, MAX_REASONS).map((item) => item.name);

function diversify(entries, limit) {
  const pool = [...entries].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const leads = new Map();
  const picked = [];
  while (picked.length < limit && pool.length) {
    let best = 0; let bestScore = -Infinity;
    pool.forEach((entry, index) => {
      const score = entry.score / (1 + REPEAT_LEAD_PENALTY * (leads.get(because(entry)[0]) || 0));
      if (score > bestScore) { bestScore = score; best = index; }
    });
    const [entry] = pool.splice(best, 1);
    picked.push(entry);
    const lead = because(entry)[0];
    leads.set(lead, (leads.get(lead) || 0) + 1);
  }
  return picked;
}

async function discover({ songs, hiddenArtists = [], client, now = Date.now() }) {
  const hidden = notForMeTest([], hiddenArtists);
  const taste = libraryTaste(songs, hidden, now);
  if (!taste.seeds.length) return { status: "no-taste", generatedAt: now, seeds: [], artists: [], tracks: [] };

  const similar = await settleAll(taste.seeds, (seed) => client.similarArtists(seed.name));
  const artists = new Map();
  taste.seeds.forEach((seed, index) => {
    for (const candidate of similar[index]) {
      const id = key(candidate.name);
      if (taste.ownedArtists.has(id) || hidden({ artist: candidate.name })) continue;
      const entry = artists.get(id) || { name: candidate.name, url: candidate.url, score: 0, reasons: [] };
      addReason(entry, seed.name, seed.weight * candidate.match);
      artists.set(id, entry);
    }
  });
  const rankedArtists = diversify(artists.values(), RESULT_ARTISTS);
  const topTracks = await settleAll(rankedArtists.slice(0, TOP_TRACK_ARTISTS), (artist) => client.topTracks(artist.name));

  // Last.fm's similar-song lookups are mostly empty, so songs come from what's popular by the artists you play most.
  const favourites = taste.seeds.slice(0, MISSING_SONG_ARTISTS);
  const favouriteTracks = await settleAll(favourites, (seed) => client.topTracks(seed.name, 15));
  const tracks = favouriteTracks.flatMap((list, index) => list
    .filter((track) => !hidden({ artist: track.artist || favourites[index].name }) && !taste.ownedTracks.has(trackKey(track.artist || favourites[index].name, track.title)))
    .slice(0, MISSING_SONGS_PER_ARTIST)
    .map((track) => ({ title: track.title, artist: track.artist || favourites[index].name, url: track.url })));

  return {
    status: "ready",
    generatedAt: now,
    seeds: taste.seeds.map((seed) => seed.name),
    artists: rankedArtists.map((artist, index) => ({ name: artist.name, url: artist.url, because: because(artist), seedCount: artist.reasons.length,
      topTracks: (topTracks[index] || []).filter((track) => !hidden({ artist: track.artist || artist.name }) && !taste.ownedTracks.has(trackKey(track.artist, track.title))) })),
    tracks
  };
}

/** A saved result without anything you've since added to your library or marked "not for me". */
function withoutOwned(result, { songs, hiddenArtists = [] }) {
  if (result?.status !== "ready") return result;
  const hidden = notForMeTest([], hiddenArtists);
  const { ownedArtists, ownedTracks } = libraryTaste(songs, hidden);
  const keep = (artist) => !ownedArtists.has(key(artist)) && !hidden({ artist });
  return { ...result,
    artists: result.artists.filter((artist) => keep(artist.name))
      .map((artist) => ({ ...artist, topTracks: artist.topTracks.filter((track) => !hidden({ artist: track.artist || artist.name }) && !ownedTracks.has(trackKey(track.artist, track.title))) })),
    tracks: result.tracks.filter((track) => !ownedTracks.has(trackKey(track.artist, track.title)) && !hidden({ artist: track.artist })) };
}

module.exports = { discover, withoutOwned, libraryTaste, titleKey };
