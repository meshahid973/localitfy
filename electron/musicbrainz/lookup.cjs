"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { fetchCoverArt } = require("./client.cjs");
const { normalize, similarity, creditText, primaryArtist, artistScore, recordingScore, releaseRank, formatGenres, buildProposal, pickRecording, matchReleaseTracks } = require("./match.cjs");

const DEFAULT_ALBUM = "local files";
const NOISE = /\s*[([](?:&|(?:feat\.?|ft\.?|with|prod\.?|official|audio|video|lyrics?|visuali[sz]er|explicit|hq|hd)\b)[^)\]]*[)\]]/gi;
const searchTitle = (title) => String(title || "").replace(NOISE, "").trim() || String(title || "");
const unreachableOnly = (error) => { if (error?.code === "MUSICBRAINZ_UNREACHABLE") throw error; return null; };

/** One album across its editions: "Queen of the Clouds" and "Queen of the Clouds (Blueprint Edition)" share a key. */
const editionKey = (proposal) => `${proposal.ids.albumArtistIds[0] || normalize(proposal.tags.albumArtist)}|${normalize(proposal.tags.album.replace(/(?:\s*[([][^)\]]*[)\]])+$/, ""))}`;

/** A track of a full release, with the track's own title and credit (they can differ from the recording's). */
const onTrack = (song, release, { track, medium, recording }, score) => ({
  recording: { ...recording, title: track.title || recording.title, "artist-credit": track["artist-credit"] || recording["artist-credit"] }, release, track, medium, score
});

/**
 * Looks songs up on MusicBrainz and downloads each release's front cover once into coverDir,
 * so previews and applied covers never load from the network afterwards.
 */
function createTaggingLookup({ client, coverDir, userAgent, fetchImpl = fetch }) {
  const genreCache = new Map();
  const coverCache = new Map();

  async function genresFor(releaseGroupId, artistIds = []) {
    const key = `${releaseGroupId || ""}|${artistIds[0] || ""}`;
    if (!genreCache.has(key)) {
      genreCache.set(key, (async () => {
        const group = releaseGroupId ? formatGenres(await client.getReleaseGroupGenres(releaseGroupId).catch(() => [])) : "";
        return group || (artistIds[0] ? formatGenres(await client.getArtistGenres(artistIds[0]).catch(() => [])) : "");
      })());
    }
    return genreCache.get(key);
  }

  async function coverFor(releaseId, releaseGroupId) {
    if (!releaseId) return "";
    if (!coverCache.has(releaseId)) {
      coverCache.set(releaseId, (async () => {
        for (const ext of [".jpg", ".png"]) { const existing = path.join(coverDir, releaseId + ext); if (fs.existsSync(existing)) return existing; }
        const art = await fetchCoverArt({ releaseId, releaseGroupId, userAgent, fetchImpl }).catch(() => null);
        if (!art) return "";
        fs.mkdirSync(coverDir, { recursive: true });
        const target = path.join(coverDir, releaseId + art.ext);
        fs.writeFileSync(target + ".part", art.data);
        fs.renameSync(target + ".part", target);
        return target;
      })());
    }
    return coverCache.get(releaseId);
  }

  async function finish(proposal) {
    proposal.tags.genre = await genresFor(proposal.genreFromArtist ? "" : proposal.ids.releaseGroupId, proposal.ids.artistIds);
    proposal.coverPath = await coverFor(proposal.ids.releaseId, proposal.ids.releaseGroupId);
    return proposal;
  }

  async function lookupSong(song) {
    const title = searchTitle(song.title);
    const artist = primaryArtist(song.artist);
    let recordings = await client.searchRecordings(title, artist);
    if (!recordings.length && artist) recordings = await client.searchRecordings(title, "");
    const picked = pickRecording({ ...song, title }, recordings);
    return picked ? finish(buildProposal(song, picked)) : null;
  }

  /** Matches a whole album to one release so every track shares the same release and cover. */
  async function lookupAlbum(songs) {
    const album = songs[0].album;
    const releases = await client.searchReleases(album, primaryArtist(songs[0].artist));
    const candidates = releases
      .filter((release) => similarity(release.title, album) >= 0.8)
      .map((release) => ({ release, rank: releaseRank(release) - Math.abs((release["track-count"] || 0) - songs.length) * 0.3 - ((release["track-count"] || 0) < songs.length ? 2 : 0) }))
      .sort((a, b) => b.rank - a.rank)
      .slice(0, 3);
    let best = null;
    for (const { release } of candidates) {
      const full = await client.getRelease(release.id).catch(unreachableOnly);
      if (!full) continue;
      const matches = matchReleaseTracks(songs, full);
      const quality = matches.length + matches.reduce((sum, match) => sum + match.score, 0) / Math.max(1, matches.length);
      if (!best || quality > best.quality) best = { full, matches, quality };
      if (matches.length === songs.length) break;
    }
    if (!best) return { proposals: [], unmatched: songs };
    const proposals = [];
    for (const match of best.matches) proposals.push(await finish(buildProposal(match.song, onTrack(match.song, best.full, match, match.score))));
    const matched = new Set(proposals.map((proposal) => proposal.songId));
    return { proposals, unmatched: songs.filter((song) => !matched.has(song.id)) };
  }

  /** One album folder (or one artist's singles); songs an album lookup cannot place are looked up alone. */
  async function lookupGroup(songs) {
    const isAlbum = songs.length > 1 && String(songs[0].album || DEFAULT_ALBUM).toLocaleLowerCase() !== DEFAULT_ALBUM;
    // A failed album lookup should not prevent valid single-track matches. Service outages still propagate.
    const albumMatch = isAlbum ? await lookupAlbum(songs).catch(unreachableOnly) : null;
    const { proposals, unmatched } = albumMatch || { proposals: [], unmatched: songs };
    const missed = [];
    for (const song of unmatched) {
      const proposal = await lookupSong(song).catch(unreachableOnly);
      if (proposal) proposals.push(proposal); else missed.push(song.id);
    }
    return { proposals: await unifyEditions(proposals, new Map(songs.map((song) => [song.id, song]))), missed };
  }

  /** Where each proposal's song sits on a full release: by recording ID first, then by title and length. */
  function placeOnRelease(proposals, release, songsById) {
    const tracks = (release.media || []).flatMap((medium) => (medium.tracks || medium.track || []).map((track) => ({ medium, track, recording: track.recording || {} })));
    const placed = new Map();
    const used = new Set();
    for (const proposal of proposals) {
      const entry = tracks.find((candidate) => candidate.recording.id === proposal.ids.recordingId && !used.has(candidate.track.id));
      if (entry) { placed.set(proposal.songId, { ...entry, score: proposal.confidence }); used.add(entry.track.id); }
    }
    const rest = proposals.filter((proposal) => !placed.has(proposal.songId)).map((proposal) => songsById.get(proposal.songId)).filter(Boolean);
    const free = { media: (release.media || []).map((medium) => ({ ...medium, tracks: (medium.tracks || medium.track || []).filter((track) => !used.has(track.id)), track: undefined })) };
    for (const match of rest.length ? matchReleaseTracks(rest, free) : []) placed.set(match.song.id, { ...match, medium: (release.media || []).find((medium) => medium.position === match.medium.position) || match.medium });
    return placed;
  }

  /**
   * Songs matched one at a time can land on different editions of the same album (a 5-track
   * and a 10-track release, say). Moves them onto the one edition that holds the most of them.
   */
  async function unifyEditions(proposals, songsById) {
    const clusters = new Map();
    for (const proposal of proposals) clusters.set(editionKey(proposal), [...(clusters.get(editionKey(proposal)) || []), proposal]);
    const replaced = new Map();
    for (const cluster of clusters.values()) {
      const releaseIds = [...new Set(cluster.map((proposal) => proposal.ids.releaseId))];
      if (releaseIds.length < 2) continue;
      let best = null;
      for (const releaseId of releaseIds) {
        const release = await client.getRelease(releaseId).catch(unreachableOnly);
        if (!release) continue;
        const placed = placeOnRelease(cluster, release, songsById);
        const rank = releaseRank(release);
        if (!best || placed.size > best.placed.size || (placed.size === best.placed.size && rank > best.rank)) best = { release, placed, rank };
      }
      if (!best) continue;
      for (const proposal of cluster) {
        const entry = best.placed.get(proposal.songId);
        const song = songsById.get(proposal.songId);
        if (!entry || !song || proposal.ids.releaseId === best.release.id) continue;
        replaced.set(proposal.songId, await finish(buildProposal(song, onTrack(song, best.release, entry, proposal.confidence))));
      }
    }
    return proposals.map((proposal) => replaced.get(proposal.songId) || proposal);
  }

  /** Recordings matching a hand-typed search, one row per distinct release, best matches first. */
  async function searchCandidates(song, { title, artist }) {
    const query = searchTitle(title);
    let recordings = await client.searchRecordings(query, String(artist || "").trim());
    if (!recordings.length && String(artist || "").trim()) recordings = await client.searchRecordings(query, "");
    const target = { title: query, artist, durationMs: song.durationMs };
    const rows = new Map();
    for (const recording of recordings) {
      const score = recordingScore(target, recording);
      for (const release of recording.releases || []) {
        const group = release["release-group"] || {};
        const row = {
          recordingId: recording.id, releaseId: release.id, score: Math.round(score * 100) / 100, rank: releaseRank(release),
          title: recording.title, artist: creditText(recording["artist-credit"] || []), album: release.title,
          year: String(release.date || recording["first-release-date"] || "").slice(0, 4), country: String(release.country || ""),
          releaseType: [group["primary-type"], ...(group["secondary-types"] || [])].filter(Boolean).join(" + "),
          trackCount: Number(release["track-count"] || 0), durationMs: Number(recording.length || 0)
        };
        // The same song on several near-identical pressings shows once, as its strongest release.
        const key = [row.title, row.artist, row.album, row.year, row.releaseType].join("|").toLocaleLowerCase();
        if (!rows.has(key) || rows.get(key).rank < row.rank) rows.set(key, row);
      }
    }
    return [...rows.values()].sort((a, b) => b.score - a.score || b.rank - a.rank).slice(0, 40).map(({ rank, ...row }) => row);
  }

  /** A proposal for a release the user picked by hand. */
  async function proposalFor(song, { recordingId, releaseId }) {
    const release = await client.getRelease(releaseId);
    const tracks = (release.media || []).flatMap((medium) => (medium.tracks || medium.track || []).map((track) => ({ medium, track, recording: track.recording || {} })));
    const entry = tracks.find((candidate) => candidate.recording.id === recordingId);
    if (!entry) throw new Error("That release no longer lists this song on MusicBrainz");
    const picked = onTrack(song, release, entry, 0);
    picked.score = recordingScore(song, picked.recording);
    return finish(buildProposal(song, picked));
  }

  /** Releases matching a hand-typed album search, scored on title, artist and how many tracks the album has. */
  async function searchAlbumCandidates(songs, { album, artist }) {
    const query = searchTitle(album);
    let releases = await client.searchReleases(query, String(artist || "").trim());
    if (!releases.length && String(artist || "").trim()) releases = await client.searchReleases(query, "");
    const rows = releases.map((release) => {
      const group = release["release-group"] || {};
      const trackCount = Number(release["track-count"] || 0);
      const fit = !trackCount ? 0.5 : trackCount < songs.length ? 0 : Math.max(0, 1 - (trackCount - songs.length) / Math.max(4, songs.length));
      const score = 0.6 * similarity(release.title, query) + 0.25 * (artist ? artistScore(artist, release["artist-credit"] || []) : 1) + 0.15 * fit;
      return {
        releaseId: release.id, score: Math.round(score * 100) / 100, rank: releaseRank(release),
        title: release.title, artist: creditText(release["artist-credit"] || []), year: String(release.date || "").slice(0, 4), country: String(release.country || ""),
        releaseType: [group["primary-type"], ...(group["secondary-types"] || [])].filter(Boolean).join(" + "),
        format: [...new Set((release.media || []).map((medium) => medium.format).filter(Boolean))].join(" + "), trackCount,
        // Pressings that look alike differ by label, catalog number or MusicBrainz's own note ("explicit", "deluxe").
        label: [...new Set((release["label-info"] || []).map((info) => [info.label?.name, info["catalog-number"]].filter(Boolean).join(" ")).filter(Boolean))].join(", "),
        note: String(release.disambiguation || ""), status: String(release.status || "")
      };
    });
    return rows.sort((a, b) => b.score - a.score || b.rank - a.rank).map(({ rank, ...row }) => row);
  }

  /** Proposals for every album song found on a release the user picked by hand. */
  async function albumProposalsFor(songs, releaseId) {
    const release = await client.getRelease(releaseId);
    const proposals = [];
    for (const match of matchReleaseTracks(songs, release)) proposals.push(await finish(buildProposal(match.song, onTrack(match.song, release, match, match.score))));
    const matched = new Set(proposals.map((proposal) => proposal.songId));
    return { proposals, missed: songs.filter((song) => !matched.has(song.id)).map((song) => song.id) };
  }

  /** The release an album's songs belong to: the one their files name most, else the best search match. */
  async function releaseForSongs(songs, fileReleaseIds = []) {
    const counts = new Map();
    for (const id of fileReleaseIds.filter(Boolean)) counts.set(id, (counts.get(id) || 0) + 1);
    const named = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (named) return named;
    const album = songs[0]?.album || "";
    if (!album || album.toLocaleLowerCase() === DEFAULT_ALBUM) return songs.length === 1 ? releaseForSong(songs[0]) : "";
    const releases = await client.searchReleases(searchTitle(album), primaryArtist(songs[0].artist));
    // An edition with fewer tracks than the songs you already have can't be the right one.
    const rank = (release) => releaseRank(release) - (Number(release["track-count"] || 0) < songs.length ? 3 : 0);
    return releases.filter((release) => similarity(release.title, album) >= 0.8).sort((a, b) => rank(b) - rank(a))[0]?.id || "";
  }

  /** The album a single song comes from (its original album when there is one). */
  async function releaseForSong({ title, artist, durationMs }) {
    const query = searchTitle(title);
    let recordings = await client.searchRecordings(query, primaryArtist(artist));
    if (!recordings.length && artist) recordings = await client.searchRecordings(query, "");
    return pickRecording({ title: query, artist, durationMs }, recordings)?.release?.id || "";
  }

  /**
   * Every track of a release, marked with the library song that already has it, so the rest can
   * be downloaded. Album songs are paired with tracks first; other tracks are looked for in the
   * whole library by title, artist and length (they may sit under a single or "local files").
   */
  async function albumTracks({ releaseId, songs = [], library = [] }) {
    const release = await client.getRelease(releaseId);
    const group = release["release-group"] || {};
    const owned = new Map(matchReleaseTracks(songs, release).map((match) => [match.track.id, match.song.id]));
    const tracks = (release.media || []).flatMap((medium) => (medium.tracks || medium.track || []).map((track) => {
      const recording = track.recording || {};
      const credit = track["artist-credit"] || recording["artist-credit"] || release["artist-credit"] || [];
      const row = { id: track.id, recordingId: recording.id || "", disc: Number(medium.position || 1), position: Number(track.position || 0), title: track.title || recording.title || "", artist: creditText(credit), durationMs: Number(track.length || recording.length || 0), songId: owned.get(track.id) || "" };
      if (!row.songId) {
        const found = library.find((song) => similarity(song.title, row.title) >= 0.9 && artistScore(song.artist, credit) >= 0.7 && (!song.durationMs || !row.durationMs || Math.abs(song.durationMs - row.durationMs) <= 10000));
        row.songId = found?.id || "";
      }
      return row;
    }));
    const editions = group.id ? (await client.getReleaseGroupReleases(group.id).catch(unreachableOnly) || []) : [];
    const seen = new Set();
    return {
      release: { id: release.id, title: release.title, artist: creditText(release["artist-credit"] || []), year: String(release.date || "").slice(0, 4), note: String(release.disambiguation || ""), releaseType: String(group["primary-type"] || "").toLowerCase() },
      coverPath: await coverFor(release.id, group.id),
      tracks,
      // Other editions to switch to; pressings with the same name, year and track count show once.
      editions: editions.map((edition) => ({ edition, rank: releaseRank({ ...edition, "release-group": group }) }))
        .sort((a, b) => b.rank - a.rank)
        .map(({ edition }) => ({ id: edition.id, title: edition.title, note: String(edition.disambiguation || ""), year: String(edition.date || "").slice(0, 4), country: String(edition.country || ""), format: [...new Set((edition.media || []).map((medium) => medium.format).filter(Boolean))].join(" + "), trackCount: (edition.media || []).reduce((sum, medium) => sum + Number(medium["track-count"] || 0), 0) }))
        .filter((edition) => { const key = [edition.title, edition.note, edition.year, edition.trackCount].join("|").toLocaleLowerCase(); if (edition.id !== release.id && seen.has(key)) return false; seen.add(key); return true; })
    };
  }

  return { lookupSong, lookupAlbum, lookupGroup, unifyEditions, searchCandidates, proposalFor, searchAlbumCandidates, albumProposalsFor, releaseForSongs, releaseForSong, albumTracks };
}

module.exports = { createTaggingLookup, searchTitle };
