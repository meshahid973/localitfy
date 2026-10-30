import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const electron = (file) => require(path.join(root, "electron", file));
const { summarizeAudit, createTagAuditor, readMusicBrainzIds } = electron("musicbrainz/audit.cjs");
const { createMusicBrainzClient, fetchCoverArt } = electron("musicbrainz/client.cjs");
const { similarity, pickRecording, formatGenres, matchReleaseTracks } = electron("musicbrainz/match.cjs");
const { createTaggingLookup, searchTitle } = electron("musicbrainz/lookup.cjs");
const { withMusicBrainzUfid, ffmpegArgs, writeMusicBrainzTags } = electron("musicbrainz/tag-writer.cjs");
const { registerTaggingIpc } = electron("ipc/tagging.cjs");
const { parseFile, parseBuffer } = await import("music-metadata");

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "localtify-tagging-"));
const JPEG = Buffer.from("ffd8ffe000104a46494600010100000100010000ffd9", "hex");

test("release-track IDs do not count as recording IDs", async () => {
  const ids = await readMusicBrainzIds("/virtual.mp3", async () => ({ common: { musicbrainz_trackid: "release-track-only" } }));
  assert.equal(ids.recordingId, "", "a file still needs a real recording ID");
});

test("album lookup failures fall back to individual track searches", async () => {
  let recordings = 0;
  const lookup = createTaggingLookup({ client: {
    searchReleases: async () => { throw new Error("album lookup rejected"); },
    searchRecordings: async () => { recordings += 1; return []; }
  }, coverDir: "/unused", userAgent: "localtify-test", fetchImpl: async () => assert.fail("unexpected network access") });
  const songs = [{ id: "one", title: "One", album: "Album", artist: "Artist" }, { id: "two", title: "Two", album: "Album", artist: "Artist" }];
  assert.deepEqual(await lookup.lookupGroup(songs), { proposals: [], missed: ["one", "two"] });
  assert.equal(recordings, 4, "each unmatched title retries without the artist after album lookup fails");
});

test("summarizeAudit groups untagged songs by album and singles by artist, and finds split albums", () => {
  const songs = [
    { id: "a1", album: "Melodrama", artist: "Lorde", filePath: "/m/Lorde/Melodrama/1.mp3" },
    { id: "a2", album: "Melodrama", artist: "Lorde", filePath: "/m/Lorde/Melodrama/2.mp3" },
    { id: "b1", album: "Camp", artist: "Childish Gambino", filePath: "/m/Camp/1.flac" },
    { id: "b2", album: "Camp", artist: "Childish Gambino", filePath: "/m/Camp/2.flac" },
    { id: "s1", album: "local files", artist: "Kanye West", filePath: "/d/k1.mp3" },
    { id: "s2", album: "local files", artist: "Kanye West", filePath: "/d/k2.mp3" },
    { id: "gone", album: "Camp", artist: "Childish Gambino", filePath: "/m/Camp/3.flac" }
  ];
  const ids = new Map([
    ["a1", { recordingId: "r1", releaseId: "rel-1" }], ["a2", { recordingId: "r2", releaseId: "rel-2" }],
    ["b1", { recordingId: "r3", releaseId: "rel-3" }], ["b2", { recordingId: "", releaseId: "" }],
    ["s1", { recordingId: "", releaseId: "" }], ["s2", { recordingId: "", releaseId: "" }]
  ]);
  const audit = summarizeAudit(songs, ids);
  assert.deepEqual([audit.total, audit.tagged, audit.missing, audit.untaggedCount], [7, 3, 1, 3]);
  assert.deepEqual(audit.untagged.map((group) => [group.album, group.artist, group.untaggedIds]), [["", "Kanye West", ["s1", "s2"]], ["Camp", "Childish Gambino", ["b2"]]]);
  assert.deepEqual(audit.splitAlbums.map((group) => [group.album, group.releaseCount]), [["Melodrama", 2]]);
});

test("the auditor re-reads a file only when it changed", async () => {
  let parses = 0;
  let mtimeMs = 1;
  const auditor = createTagAuditor({ parseFile: async () => { parses += 1; return { common: { musicbrainz_recordingid: parses > 1 ? "rec" : undefined } }; }, stat: async () => ({ mtimeMs, size: 10 }) });
  const songs = [{ id: "1", album: "A", artist: "B", filePath: "/x.mp3" }];
  assert.equal((await auditor.audit(songs)).tagged, 0);
  assert.equal((await auditor.audit(songs)).tagged, 0);
  assert.equal(parses, 1);
  mtimeMs = 2;
  assert.equal((await auditor.audit(songs)).tagged, 1);
});

test("titles lose credits and upload noise before searching and matching", () => {
  assert.equal(searchTitle("High (& Dua Lipa)"), "High");
  assert.equal(searchTitle("family ties (with Kendrick Lamar)"), "family ties");
  assert.equal(searchTitle("Heartless (Official Audio)"), "Heartless");
  assert.equal(similarity("Ain't In LA", "Ain’t in LA"), 1);
  assert.equal(similarity("RADIO (feat. Kim Petras)", "RADIO"), 1);
  assert.equal(formatGenres([{ name: "hip hop", count: 10 }, { name: "synth-pop", count: 5 }, { name: "jazz", count: 1 }]), "Hip Hop; Synth-Pop");
});

test("pickRecording prefers the original album over compilations and soundtracks of the same song", () => {
  const credit = [{ name: "Kanye West", artist: { id: "kanye" } }];
  const release = (id, title, type, secondary = [], date = "2008") => ({ id, title, status: "Official", date, "release-group": { id: `rg-${id}`, "primary-type": type, "secondary-types": secondary }, media: [{ position: 1, "track-count": 12, "track-offset": 2, track: [{ id: `t-${id}`, number: "3" }] }] });
  const recordings = [
    { id: "comp", title: "Heartless", length: 211000, "artist-credit": credit, releases: [release("c", "R&B Collection", "Album", ["Compilation"])] },
    { id: "orig", title: "Heartless", length: 211500, "artist-credit": credit, releases: [release("o", "808s & Heartbreak", "Album")] },
    { id: "other", title: "Heartbeat", length: 180000, "artist-credit": credit, releases: [release("x", "Something", "Album", [], "2001")] }
  ];
  const picked = pickRecording({ title: "Heartless", artist: "Kanye West", durationMs: 211000 }, recordings);
  assert.equal(picked.recording.id, "orig");
  assert.equal(picked.release.title, "808s & Heartbreak");
  assert.equal(picked.track.number, "3");
});

test("matchReleaseTracks pairs songs with release tracks one to one", () => {
  const release = { media: [{ position: 1, tracks: [
    { id: "t1", title: "madeleine", length: 150000, recording: { id: "r1", title: "madeleine", length: 150000 } },
    { id: "t2", title: "death rolL", length: 200000, recording: { id: "r2", title: "death rolL", length: 200000 } }
  ] }] };
  const matches = matchReleaseTracks([{ id: "b", title: "death roll", durationMs: 199000 }, { id: "a", title: "Madeleine", durationMs: 151000 }, { id: "c", title: "unrelated", durationMs: 90000 }], release);
  assert.deepEqual(matches.map((match) => [match.song.id, match.track.id]).sort(), [["a", "t1"], ["b", "t2"]]);
});

test("the client identifies itself, stays at one request per interval and retries 503s", async () => {
  const calls = [];
  const sleeps = [];
  const responses = [{ status: 503 }, { status: 200, body: { recordings: [{ id: "r" }] } }, { status: 200, body: { releases: [] } }];
  const client = createMusicBrainzClient({
    userAgent: "localtify/test ( x )", minIntervalMs: 1000, sleep: async (ms) => { sleeps.push(ms); },
    fetchImpl: async (url, options) => { calls.push({ url, agent: options.headers["User-Agent"] }); const next = responses.shift(); return { ok: next.status === 200, status: next.status, json: async () => next.body }; }
  });
  assert.deepEqual(await client.searchRecordings('Say "Hi"', "Artist"), [{ id: "r" }]);
  await client.searchReleases("Album", "Artist");
  assert.equal(calls.length, 3);
  assert.ok(calls.every((call) => call.agent === "localtify/test ( x )"));
  assert.equal(new URL(calls[0].url).searchParams.get("query"), 'recording:"Say \\"Hi\\"" AND artist:"Artist"');
  assert.ok(sleeps.some((ms) => ms >= 2000), "backs off after a 503");
});

test("MusicBrainz requests use a timeout and do not retain an unlimited cache", async () => {
  let calls = 0;
  const signals = [];
  const client = createMusicBrainzClient({ userAgent: "localtify/test", minIntervalMs: 0, maxCacheEntries: 2,
    fetchImpl: async (_url, options) => {
      calls++;
      signals.push(options.signal);
      return { ok: true, status: 200, json: async () => ({ releases: [] }) };
    }
  });
  await client.searchReleases("Album One", "");
  await client.searchReleases("Album Two", "");
  await client.searchReleases("Album Three", "");
  await client.searchReleases("Album One", "");
  assert.equal(calls, 4, "oldest cached request was evicted");
  assert.ok(signals.every((signal) => signal && typeof signal.addEventListener === "function"));
});

test("cover downloads reject oversized streaming responses before buffering the whole file", async () => {
  let cancelled = false;
  let calls = 0;
  const jpg = new Uint8Array(JPEG);
  const fetchImpl = async () => {
    calls++;
    if (calls === 1) return {
      ok: true,
      headers: new Map([["content-type", "image/jpeg"]]),
      body: { getReader: () => ({
        read: async () => ({ done: false, value: new Uint8Array(64) }),
        cancel: async () => { cancelled = true; },
        releaseLock: () => {}
      }) }
    };
    return { ok: true, headers: new Map([["content-type", "image/jpeg"]]), arrayBuffer: async () => jpg.buffer };
  };
  const result = await fetchCoverArt({ releaseId: "one", releaseGroupId: "two", userAgent: "localtify/test", maxBytes: 32, fetchImpl });
  assert.equal(cancelled, true, "the oversized stream is cancelled");
  assert.equal(calls, 2, "falls back to another cover instead of buffering oversized input");
  assert.deepEqual(result.data, JPEG);
});

function fakeMusicBrainz() {
  const credit = [{ name: "brakence", joinphrase: "", artist: { id: "brakence" } }];
  const release = {
    id: "rel-marrow", title: "marroW", status: "Official", date: "2026-01-01", country: "XW", "artist-credit": credit,
    "release-group": { id: "rg-marrow", "primary-type": "Album", "secondary-types": [] },
    media: [{ position: 1, "track-count": 2, tracks: [
      { id: "t1", position: 1, title: "madeleine", length: 150000, "artist-credit": credit, recording: { id: "rec-1", title: "madeleine", length: 150000, "artist-credit": credit } },
      { id: "t2", position: 2, title: "death rolL", length: 200000, "artist-credit": credit, recording: { id: "rec-2", title: "death rolL", length: 200000, "artist-credit": credit } }
    ] }]
  };
  const coverRequests = [];
  const fetchImpl = async (url) => {
    if (url.startsWith("https://coverartarchive.org/")) { coverRequests.push(url); return { ok: true, status: 200, headers: new Map([["content-type", "image/jpeg"]]), arrayBuffer: async () => JPEG }; }
    const { pathname } = new URL(url);
    const body = pathname.endsWith("/release") ? { releases: [{ ...release, "track-count": 2 }] }
      : pathname.endsWith("/release/rel-marrow") ? release
      : pathname.includes("/release-group/") ? { genres: [{ name: "hyperpop", count: 4 }, { name: "emo rap", count: 3 }] }
      : pathname.endsWith("/recording") ? { recordings: [] } : {};
    return { ok: true, status: 200, json: async () => body };
  };
  return { fetchImpl, coverRequests };
}

test("an album lookup matches every track to one release and downloads its cover once", async (t) => {
  const dir = tempDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const { fetchImpl, coverRequests } = fakeMusicBrainz();
  const lookup = createTaggingLookup({ client: createMusicBrainzClient({ userAgent: "t", fetchImpl, minIntervalMs: 0 }), coverDir: dir, userAgent: "t", fetchImpl });
  const songs = [
    { id: "a", title: "madeleine", artist: "brakence", album: "marroW", durationMs: 150500, filePath: "/m/marrow/1.mp3" },
    { id: "b", title: "death rolL", artist: "brakence", album: "marroW", durationMs: 199800, filePath: "/m/marrow/2.mp3" }
  ];
  const { proposals, missed } = await lookup.lookupGroup(songs);
  assert.deepEqual(missed, []);
  assert.deepEqual(proposals.map((proposal) => [proposal.songId, proposal.ids.recordingId, proposal.ids.releaseTrackId, proposal.tags.trackNumber]), [["a", "rec-1", "t1", 1], ["b", "rec-2", "t2", 2]]);
  assert.equal(proposals[0].tags.genre, "Hyperpop; Emo Rap");
  assert.equal(proposals[0].coverPath, path.join(dir, "rel-marrow.jpg"));
  assert.ok(fs.readFileSync(proposals[0].coverPath).equals(JPEG));
  assert.equal(coverRequests.length, 1, "the cover is downloaded once per release");
});

function fakeEditions() {
  const nin = [{ name: "Nine Inch Nails", joinphrase: "", artist: { id: "nin" } }];
  const group = { id: "rg-slip", "primary-type": "Album", "secondary-types": [] };
  const track = (id, position, title, recording, length) => ({ id, position, title, length, "artist-credit": nin, recording: { id: recording, title, length, "artist-credit": nin } });
  // The 5-track edition lists Echoplex under its own recording ID; the 10-track one holds both songs.
  const releases = {
    "rel-10": { id: "rel-10", title: "The Slip", status: "Official", date: "2008-05-05", "artist-credit": nin, "release-group": group,
      media: [{ position: 1, "track-count": 10, tracks: [track("t10-1", 1, "Discipline", "rec-d", 260000), track("t10-2", 2, "Echoplex", "rec-e10", 280000)] }] },
    "rel-5": { id: "rel-5", title: "The Slip (Bonus Edition)", status: "Official", date: "2008-05-05", "artist-credit": nin, "release-group": group,
      media: [{ position: 1, "track-count": 5, tracks: [track("t5-1", 1, "Echoplex", "rec-e", 280000)] }] }
  };
  const searchEntry = (release, trackId, title) => ({ ...release, "track-count": release.media[0]["track-count"], media: [{ position: 1, "track-count": release.media[0]["track-count"], track: [{ id: trackId, number: "1", title }] }] });
  const recordings = {
    Discipline: { id: "rec-d", title: "Discipline", length: 260000, "artist-credit": nin, releases: [searchEntry(releases["rel-10"], "t10-1", "Discipline")] },
    Echoplex: { id: "rec-e", title: "Echoplex", length: 280000, "artist-credit": nin, releases: [searchEntry(releases["rel-5"], "t5-1", "Echoplex")] }
  };
  const fetchImpl = async (url) => {
    if (url.startsWith("https://coverartarchive.org/")) return { ok: false, status: 404 };
    const { pathname, searchParams } = new URL(url);
    const title = /recording:"([^"]+)"/.exec(searchParams.get("query") || "")?.[1];
    const id = pathname.split("/").pop();
    const body = pathname.endsWith("/recording") ? { recordings: recordings[title] ? [recordings[title]] : [] }
      : pathname.endsWith("/release") ? { releases: Object.values(releases).map((release) => ({ ...release, media: [{ format: "Digital Media", "track-count": release.media[0]["track-count"] }] })) }
      : releases[id] || {};
    return { ok: true, status: 200, json: async () => body };
  };
  return { fetchImpl, recordings, releases };
}

test("singles matched to different editions of one album are moved onto the edition that has them all", async (t) => {
  const dir = tempDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const { fetchImpl } = fakeEditions();
  const lookup = createTaggingLookup({ client: createMusicBrainzClient({ userAgent: "t", fetchImpl, minIntervalMs: 0 }), coverDir: dir, userAgent: "t", fetchImpl });
  const { proposals, missed } = await lookup.lookupGroup([
    { id: "d", title: "Discipline (Official Audio)", artist: "Nine Inch Nails", album: "local files", durationMs: 260000, filePath: "/d/1.mp3" },
    { id: "e", title: "Echoplex", artist: "Nine Inch Nails", album: "local files", durationMs: 280000, filePath: "/d/2.mp3" }
  ]);
  assert.deepEqual(missed, []);
  assert.deepEqual(proposals.map((proposal) => [proposal.songId, proposal.ids.releaseId, proposal.ids.recordingId, proposal.tags.trackNumber, proposal.tags.trackTotal]),
    [["d", "rel-10", "rec-d", 1, 10], ["e", "rel-10", "rec-e10", 2, 10]], "Echoplex follows Discipline onto the 10-track edition, found by title and length");
  assert.ok(proposals[1].confidence > 0.9, "the move keeps the original match confidence");
});

test("a hand-typed search lists each release once, and a picked release becomes the proposal", async (t) => {
  const dir = tempDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const { fetchImpl, recordings, releases } = fakeEditions();
  const echoplex = recordings.Echoplex;
  // A second, identical pressing of the same edition only differs by ID.
  echoplex.releases.push({ ...echoplex.releases[0], id: "rel-5-cd", status: "Bootleg" });
  const lookup = createTaggingLookup({ client: createMusicBrainzClient({ userAgent: "t", fetchImpl, minIntervalMs: 0 }), coverDir: dir, userAgent: "t", fetchImpl });
  const song = { id: "x", title: "Lil Bit", artist: "Somebody Else", album: "Wrong", durationMs: 281000, filePath: "/d/x.mp3" };
  const rows = await lookup.searchCandidates(song, { title: "Echoplex", artist: "Nine Inch Nails" });
  assert.deepEqual(rows.map((row) => [row.releaseId, row.album, row.trackCount]), [["rel-5", "The Slip (Bonus Edition)", 5]]);
  assert.ok(rows[0].score > 0.9, "scored against the search, not the file's wrong tags");
  const proposal = await lookup.proposalFor(song, { recordingId: "rec-e10", releaseId: "rel-10" });
  assert.deepEqual([proposal.tags.title, proposal.tags.album, proposal.tags.trackNumber, proposal.ids.recordingId], ["Echoplex", releases["rel-10"].title, 2, "rec-e10"]);
  await assert.rejects(lookup.proposalFor(song, { recordingId: "rec-d", releaseId: "rel-5" }), /no longer lists/);
});

test("an album search scores releases on title, artist and track count, and a picked release tags every track", async (t) => {
  const dir = tempDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const { fetchImpl } = fakeMusicBrainz();
  const lookup = createTaggingLookup({ client: createMusicBrainzClient({ userAgent: "t", fetchImpl, minIntervalMs: 0 }), coverDir: dir, userAgent: "t", fetchImpl });
  const songs = [
    { id: "a", title: "Track 1", artist: "Someone", album: "Wrong Album", durationMs: 150000, filePath: "/m/x/1.mp3" },
    { id: "b", title: "death rolL", artist: "Someone", album: "Wrong Album", durationMs: 200000, filePath: "/m/x/2.mp3" },
    { id: "c", title: "not on it", artist: "Someone", album: "Wrong Album", durationMs: 90000, filePath: "/m/x/3.mp3" }
  ];
  const rows = await lookup.searchAlbumCandidates(songs.slice(0, 2), { album: "marroW", artist: "brakence" });
  assert.deepEqual(rows.map((row) => [row.releaseId, row.title, row.trackCount, row.score]), [["rel-marrow", "marroW", 2, 1]]);
  const { proposals, missed } = await lookup.albumProposalsFor(songs, "rel-marrow");
  assert.deepEqual(proposals.map((proposal) => [proposal.songId, proposal.ids.recordingId, proposal.tags.album]), [["b", "rec-2", "marroW"]]);
  assert.deepEqual(missed, ["a", "c"], "songs that pair with no track are reported, not forced onto one");
});

test("complete album lists every track, marks the ones already in the library and offers the other editions", async (t) => {
  const dir = tempDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const { fetchImpl } = fakeEditions();
  const lookup = createTaggingLookup({ client: createMusicBrainzClient({ userAgent: "t", fetchImpl, minIntervalMs: 0 }), coverDir: dir, userAgent: "t", fetchImpl });
  // A Discover song not in the library yet: its album is found through the recording.
  assert.equal(await lookup.releaseForSong({ title: "Echoplex", artist: "Nine Inch Nails" }), "rel-5");
  assert.equal(await lookup.releaseForSongs([{ id: "d", title: "Discipline", album: "The Slip" }], ["rel-10", "rel-10", ""]), "rel-10", "the release the files name wins");
  const discipline = { id: "d", title: "Discipline", artist: "Nine Inch Nails", album: "The Slip", durationMs: 260000, filePath: "/m/1.mp3" };
  const echoplexSingle = { id: "e", title: "Echoplex", artist: "Nine Inch Nails", album: "local files", durationMs: 281000, filePath: "/d/2.mp3" };
  const other = { id: "x", title: "Echoplex", artist: "Someone Else", album: "local files", durationMs: 280000, filePath: "/d/3.mp3" };
  const result = await lookup.albumTracks({ releaseId: "rel-10", songs: [discipline], library: [other, discipline, echoplexSingle] });
  assert.equal(result.release.title, "The Slip");
  assert.deepEqual(result.tracks.map((track) => [track.position, track.title, track.songId]), [[1, "Discipline", "d"], [2, "Echoplex", "e"]],
    "a song filed elsewhere still counts, but not a same-named song by another artist");
  assert.deepEqual(result.editions.map((edition) => [edition.id, edition.trackCount]), [["rel-10", 10], ["rel-5", 5]]);
});

test("an unreachable MusicBrainz is an error, not \"no match\"", async (t) => {
  const dir = tempDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const fetchImpl = async () => { throw new TypeError("fetch failed"); };
  const lookup = createTaggingLookup({ client: createMusicBrainzClient({ userAgent: "t", fetchImpl, minIntervalMs: 0 }), coverDir: dir, userAgent: "t", fetchImpl });
  await assert.rejects(lookup.lookupGroup([{ id: "s", title: "Song", artist: "Artist", album: "local files", filePath: "/d/s.mp3" }]), /Couldn't reach MusicBrainz/);
  await assert.rejects(lookup.lookupGroup([
    { id: "a", title: "One", artist: "Artist", album: "Album", filePath: "/m/a/1.mp3" },
    { id: "b", title: "Two", artist: "Artist", album: "Album", filePath: "/m/a/2.mp3" }
  ]), /Couldn't reach MusicBrainz/);
});

test("withMusicBrainzUfid adds the recording ID where Picard and music-metadata expect it", async () => {
  const frame = (id, text) => { const body = Buffer.concat([Buffer.from([3]), Buffer.from(text)]); return Buffer.concat([Buffer.from(id), Buffer.from([0, 0, 0, body.length, 0, 0]), body]); };
  const frames = frame("TIT2", "Song");
  const tag = Buffer.concat([Buffer.from([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, frames.length + 16]), frames, Buffer.alloc(16)]);
  const audio = Buffer.from([0xff, 0xfb, 0x90, 0x64]);
  const tagged = withMusicBrainzUfid(withMusicBrainzUfid(Buffer.concat([tag, audio]), "old-id"), "rec-123");
  const { common, native } = await parseBuffer(tagged, { mimeType: "audio/mpeg" }, { duration: false });
  assert.equal(common.title, "Song");
  assert.equal(common.musicbrainz_recordingid, "rec-123");
  assert.equal(native["ID3v2.4"].filter((item) => item.id === "UFID").length, 1, "an older MusicBrainz UFID is replaced");
  assert.ok(tagged.subarray(-4).equals(audio));
});

test("ffmpegArgs copies audio, keeps old tags and never re-encodes", () => {
  const ids = { recordingId: "r", releaseTrackId: "t", releaseId: "rel", releaseGroupId: "rg", artistIds: ["a1", "a2"], albumArtistIds: ["a1"] };
  const tags = { title: "T", artist: "A", album: "Al", albumArtist: "A", date: "2020", genre: "Pop", trackNumber: 3, trackTotal: 10, discNumber: 1, discTotal: 1, releaseType: "album", releaseStatus: "official", releaseCountry: "US" };
  const mp3 = ffmpegArgs({ input: "/m/a.mp3", output: "/m/.a.tmp.mp3", cover: "/c.jpg", tags, ids });
  assert.ok(mp3.join(" ").includes("-c copy -map_metadata 0"));
  assert.ok(mp3.includes("track=3/10") && mp3.includes("MusicBrainz Album Id=rel") && mp3.includes("MusicBrainz Artist Id=a1/a2"));
  assert.ok(mp3.includes("attached_pic"));
  const flac = ffmpegArgs({ input: "/m/a.flac", output: "/m/.a.tmp.flac", cover: "", tags, ids });
  assert.ok(flac.includes("MUSICBRAINZ_TRACKID=r") && flac.includes("track=3") && flac.includes("TRACKTOTAL=10"));
  assert.ok(flac.includes("0:v?"), "an existing cover is kept when there is no new one");
});

const ffmpegPath = String(require("ffmpeg-static") || "");
const hasFfmpeg = ffmpegPath && fs.existsSync(ffmpegPath);

test("writeMusicBrainzTags tags a real MP3 and FLAC, keeps the audio and sends the original to the Trash", { skip: !hasFfmpeg && "ffmpeg-static binary not installed" }, async (t) => {
  const dir = tempDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const cover = path.join(dir, "cover.jpg");
  spawnSync(ffmpegPath, ["-v", "error", "-f", "lavfi", "-i", "color=c=red:s=64x64", "-frames:v", "1", cover]);
  const ids = { recordingId: "11111111-2222-3333-4444-555555555555", releaseTrackId: "t", releaseId: "rel", releaseGroupId: "rg", artistIds: ["a"], albumArtistIds: ["a"] };
  const tags = { title: "Proper Title", artist: "Proper Artist", album: "Proper Album", albumArtist: "Proper Artist", date: "2020-05-01", genre: "Pop", trackNumber: 2, trackTotal: 9, discNumber: 1, discTotal: 1, releaseType: "album", releaseStatus: "official", releaseCountry: "US" };
  for (const ext of [".mp3", ".flac"]) {
    const file = path.join(dir, `tone${ext}`);
    spawnSync(ffmpegPath, ["-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-metadata", "title=old title", "-metadata", "comment=keep me", file]);
    const audioBefore = spawnSync(ffmpegPath, ["-v", "error", "-i", file, "-map", "0:a", "-c", "copy", "-f", "md5", "-"]).stdout.toString();
    const trashed = [];
    await writeMusicBrainzTags({ filePath: file, tags, ids, cover, ffmpegPath, parseFile, trashItem: async (target) => { const moved = path.join(dir, `trashed${ext}`); fs.renameSync(target, moved); trashed.push(moved); } });
    const { common, native } = await parseFile(file);
    assert.equal(common.title, "Proper Title");
    assert.equal(common.album, "Proper Album");
    assert.equal(common.musicbrainz_recordingid, ids.recordingId);
    assert.equal(common.musicbrainz_albumid, "rel");
    assert.equal(common.track.no, 2);
    assert.equal(common.picture?.length, 1);
    assert.ok(Object.values(native).flat().some((item) => item.value === "keep me"), "existing tags are kept");
    assert.equal(spawnSync(ffmpegPath, ["-v", "error", "-i", file, "-map", "0:a", "-c", "copy", "-f", "md5", "-"]).stdout.toString(), audioBefore);
    assert.equal(trashed.length, 1);
    assert.deepEqual(fs.readdirSync(dir).filter((name) => name.startsWith(".")), [], "no temp file is left behind");
  }
});

test("re-matching a file Picard got wrong clears the wrong match's tags but keeps the downloader's", { skip: !hasFfmpeg && "ffmpeg-static binary not installed" }, async (t) => {
  const dir = tempDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  // Picard tagged WHO SHOT SCOTT's "LIL BIT OF HOT" as Nelly's "Lil Bit".
  const wrong = { title: "Lil Bit", artist: "Nelly & Florida Georgia Line", album: "Lil Bit", albumArtist: "Nelly & Florida Georgia Line", date: "2020-10-23", genre: "", trackNumber: 1, trackTotal: 1, discNumber: 1, discTotal: 1, releaseType: "single", releaseStatus: "official", releaseCountry: "XW", isrc: "USQX92003533" };
  const right = { ...wrong, title: "LIL BIT OF HOT", artist: "WHO SHOT SCOTT", album: "BRAIN (SIDE B)", albumArtist: "WHO SHOT SCOTT", date: "2025-02-28", releaseType: "ep", isrc: "" };
  const ids = (recordingId) => ({ recordingId, releaseTrackId: "", releaseId: "rel", releaseGroupId: "rg", artistIds: ["a"], albumArtistIds: ["a"] });
  const trashItem = async (target) => fs.renameSync(target, path.join(dir, `trashed-${Math.random()}-${path.basename(target)}`));
  for (const ext of [".mp3", ".flac"]) {
    const file = path.join(dir, `song${ext}`);
    const downloaded = ext === ".mp3" ? ["-metadata", "ISRC=QMBZ92410276"] : [];
    spawnSync(ffmpegPath, ["-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-metadata", "title=LIL BIT OF HOT", "-metadata", "copyright=(P) 2024 Tenfold Records", ...downloaded, "-metadata", "comment=keep me", file]);
    await writeMusicBrainzTags({ filePath: file, tags: wrong, ids: ids("nelly-recording"), ffmpegPath, parseFile, trashItem });
    if (ext === ".mp3") spawnSync(ffmpegPath, ["-v", "error", "-i", file, "-c", "copy", "-map_metadata", "0", "-metadata", "BARCODE=886448676805", "-metadata", "publisher=Columbia", "-id3v2_version", "4", path.join(dir, "picard.mp3")]);
    if (ext === ".mp3") fs.writeFileSync(file, withMusicBrainzUfid(fs.readFileSync(path.join(dir, "picard.mp3")), "nelly-recording"));
    await writeMusicBrainzTags({ filePath: file, tags: right, ids: ids("wss-recording"), ffmpegPath, parseFile, trashItem });
    const { common, native } = await parseFile(file);
    const values = Object.values(native).flat().map((item) => item.value);
    assert.equal(common.musicbrainz_recordingid, "wss-recording");
    assert.equal(common.title, "LIL BIT OF HOT");
    assert.ok(!values.includes("USQX92003533"), `${ext}: the wrong song's ISRC is gone`);
    assert.equal(common.copyright, "(P) 2024 Tenfold Records", `${ext}: the downloader's copyright is kept`);
    assert.ok(values.includes("keep me"), `${ext}: unrelated tags are kept`);
    if (ext === ".mp3") {
      assert.ok(values.includes("QMBZ92410276"), "the downloader's own ISRC is kept");
      assert.ok(!values.includes("886448676805") && !values.includes("Columbia"), "Picard's barcode and label for the wrong release are gone");
    }
  }
});

test("a locked destination rolls back the original after the tagged copy was verified", { skip: !hasFfmpeg && "ffmpeg-static binary not installed" }, async (t) => {
  const dir = tempDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "locked.mp3");
  const generated = spawnSync(ffmpegPath, ["-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-metadata", "title=Before", file]);
  assert.equal(generated.status, 0);
  const before = fs.readFileSync(file);
  const ids = { recordingId: "11111111-2222-3333-4444-555555555555", artistIds: [], albumArtistIds: [] };
  let trashed = false;
  await assert.rejects(writeMusicBrainzTags({
    filePath: file, tags: { title: "After" }, ids, ffmpegPath, parseFile,
    trashItem: async () => { trashed = true; },
    renameFile: (source, destination) => {
      if (source.includes(".localtify-tagging-") && destination === file) throw new Error("simulated Windows lock");
      fs.renameSync(source, destination);
    }
  }), /simulated Windows lock/);
  assert.deepEqual(fs.readFileSync(file), before, "the original is restored byte for byte");
  assert.equal(trashed, false, "the original must not reach Trash on installation failure");
  assert.deepEqual(fs.readdirSync(dir), ["locked.mp3"], "temporary backups are cleaned after rollback");
});

test("if Trash rejects a backup, the installed file and original backup are both retained", { skip: !hasFfmpeg && "ffmpeg-static binary not installed" }, async (t) => {
  const dir = tempDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "keep.mp3");
  assert.equal(spawnSync(ffmpegPath, ["-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", file]).status, 0);
  const before = fs.readFileSync(file);
  const ids = { recordingId: "11111111-2222-3333-4444-555555555555", artistIds: [], albumArtistIds: [] };
  const result = await writeMusicBrainzTags({ filePath: file, tags: { title: "After" }, ids, ffmpegPath, parseFile, trashItem: async () => { throw new Error("Trash unavailable"); } });
  assert.match(result.warning, /Trash unavailable/);
  assert.ok(result.backupPath && fs.existsSync(result.backupPath));
  assert.deepEqual(fs.readFileSync(result.backupPath), before, "backup remains intact");
  assert.equal((await parseFile(file)).common.title, "After", "new file was installed successfully");
});

test("a failed write leaves the original untouched and out of the Trash", { skip: !hasFfmpeg && "ffmpeg-static binary not installed" }, async (t) => {
  const dir = tempDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "broken.mp3");
  fs.writeFileSync(file, "not audio");
  let trashed = false;
  await assert.rejects(writeMusicBrainzTags({ filePath: file, tags: { title: "x" }, ids: { recordingId: "r", artistIds: [], albumArtistIds: [] }, ffmpegPath, parseFile, trashItem: async () => { trashed = true; } }));
  assert.equal(trashed, false);
  assert.equal(fs.readFileSync(file, "utf8"), "not audio");
  assert.deepEqual(fs.readdirSync(dir), ["broken.mp3"]);
});

function fakeRouter() {
  const handlers = new Map();
  return { handle: (channel, handler) => handlers.set(channel, handler), invoke: (channel, payload) => handlers.get(channel)({}, payload) };
}

test("IPC: gated by the setting, proposals stay native, and library-only apply uses the local cover", async (t) => {
  const dir = tempDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const files = ["1.mp3", "2.mp3"].map((name) => { const file = path.join(dir, name); fs.writeFileSync(file, "x"); return file; });
  const songs = new Map([
    ["a", { id: "a", title: "madeleine", artist: "brakence", album: "marroW", genre: "", durationMs: 150000, filePath: files[0] }],
    ["b", { id: "b", title: "death rolL", artist: "brakence", album: "marroW", genre: "", durationMs: 200000, filePath: files[1] }]
  ]);
  const settings = { musicbrainzTagging: false, musicbrainzWriteFiles: false };
  const sent = [];
  const router = fakeRouter();
  registerTaggingIpc(router, {
    app: { getVersion: () => "1.0.0", getPath: () => dir },
    songs: { get: (id) => songs.get(id), list: () => [...songs.values()], patch: (id, patch) => songs.set(id, { ...songs.get(id), ...patch }) },
    getSettings: () => settings,
    readLocalAudioMetadata: async () => ({}),
    listSongsShaped: () => [...songs.values()],
    safeMediaUrl: (file) => `localtify-media://${path.basename(file)}`,
    getWindow: () => ({ isDestroyed: () => false, webContents: { send: (channel, payload) => sent.push([channel, payload]) } }),
    fetchImpl: fakeMusicBrainz().fetchImpl,
    clientOptions: { minIntervalMs: 0 },
    parseFile: async () => ({ common: {} }),
    shell: { trashItem: async () => { throw new Error("must not trash when only the library is updated"); } },
    ffmpegPath: "/nonexistent"
  });

  await assert.rejects(router.invoke("tagging:lookup", { songIds: ["a"] }), /Turn on/);
  settings.musicbrainzTagging = true;
  const { proposals } = await router.invoke("tagging:lookup", { songIds: ["a", "b", "../../etc/passwd"] });
  assert.equal(proposals.length, 2);
  assert.equal(proposals[0].coverUrl, "localtify-media://rel-marrow.jpg", "the preview cover is the downloaded local file");

  const pending = await router.invoke("tagging:pending");
  assert.deepEqual(pending.map((proposal) => proposal.songId), ["a", "b"], "finished lookups survive the panel closing");
  assert.equal(pending[0].groupKey, `marrow\0${dir}`);

  const result = await router.invoke("tagging:apply", { songIds: ["a", "unknown"] });
  assert.deepEqual(result, { applied: 1, written: 0, failed: [] });
  assert.equal(songs.get("a").genre, "Hyperpop; Emo Rap");
  assert.equal(songs.get("a").coverPath, path.join(dir, "musicbrainz-covers", "rel-marrow.jpg"));
  assert.equal(songs.get("a").coverSource, "custom");
  assert.equal(songs.get("b").genre, "", "unselected songs are untouched");
  assert.equal(sent[0][0], "library:watched-change");
  assert.equal(sent[0][1].libraryChanged, true, "tag edits trigger a full library update");
  assert.deepEqual(await router.invoke("tagging:apply", { songIds: ["a"] }), { applied: 0, written: 0, failed: [] }, "a proposal is used once");

  assert.deepEqual(await router.invoke("tagging:search", { songId: "b", title: "death rolL", artist: "" }), [], "the fake has no recordings to search");
  const chosen = await router.invoke("tagging:choose", { songId: "b", recordingId: "rec-2", releaseId: "rel-marrow" });
  assert.deepEqual([chosen.songId, chosen.tags.trackNumber, chosen.coverUrl], ["b", 2, "localtify-media://rel-marrow.jpg"]);
  assert.deepEqual((await router.invoke("tagging:pending")).map((proposal) => proposal.songId), [], "a hand-picked match stays with its dialog");
  settings.musicbrainzWriteFiles = true;
  assert.deepEqual(await router.invoke("tagging:apply", { songIds: ["b"] }), { applied: 1, written: 0, failed: [] }, "backend file-write gate cannot be overridden by settings");
  await assert.rejects(router.invoke("tagging:search", { songId: "missing", title: "x" }), /could not be found/);

  const releases = await router.invoke("tagging:search-album", { songIds: ["a", "b"], album: "marroW", artist: "brakence" });
  assert.equal(releases[0].releaseId, "rel-marrow");
  const album = await router.invoke("tagging:choose-album", { songIds: ["a", "b"], releaseId: "rel-marrow" });
  assert.deepEqual(album.proposals.map((proposal) => proposal.songId), ["a", "b"]);
  assert.deepEqual((await router.invoke("tagging:pending")).map((proposal) => proposal.songId), [], "album picks stay with their dialog too");
  await assert.rejects(router.invoke("tagging:search-album", { songIds: ["missing"], album: "x" }), /could be found/);

  const tracks = await router.invoke("tagging:album-tracks", { songIds: ["a", "b"] });
  assert.deepEqual(tracks.tracks.map((track) => track.songId), ["a", "b"], "the album's own songs are marked as owned");
  assert.equal(tracks.coverUrl, "localtify-media://rel-marrow.jpg");
  assert.equal(tracks.coverPath, undefined, "file paths stay in the main process");
  assert.equal(await router.invoke("tagging:album-tracks", { title: "unknown song", artist: "nobody" }), null);
});

test("songs and albums get a find on musicbrainz menu item only while tagging is on", () => {
  const shell = fs.readFileSync(path.join(root, "src", "features", "shell", "AppShell.tsx"), "utf8");
  assert.match(shell, /findOnMusicBrainz=\{settings\.musicbrainzTagging \? setTagSearchSong : undefined\}/);
  assert.match(shell, /findAlbumOnMusicBrainz=\{settings\.musicbrainzTagging \? setTagSearchAlbum : undefined\}/);
  assert.match(shell, /<CollectionContextMenu/);
  const albums = fs.readFileSync(path.join(root, "src", "features", "albums", "AlbumsView.tsx"), "utf8");
  assert.match(albums, /onContextMenu=\{\(event\) => actions\.openCollectionMenu\(event, albumTarget\(album\)\)\}/);
});

test("downloads offer tagging once per finished batch, only for the songs that batch added", async () => {
  const ts = (await import("typescript")).default;
  const { runInNewContext } = await import("node:vm");
  const { outputText } = ts.transpileModule(fs.readFileSync(path.join(root, "src", "features", "tagging", "useDownloadTagPrompt.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  // Just enough of React's hooks to render the hook repeatedly: state, refs, and effects that run when their deps change.
  const slots = [];
  let index = 0;
  const react = {
    useState: (initial) => { const i = index++; slots[i] ??= { value: initial }; return [slots[i].value, (next) => { slots[i].value = next; }]; },
    useRef: (initial) => { const i = index++; slots[i] ??= { current: initial }; return slots[i]; },
    useEffect: (effect, deps) => { const i = index++; if (!slots[i] || deps.some((dep, k) => dep !== slots[i].deps[k])) { slots[i] = { deps }; effect(); } }
  };
  const exports = {};
  runInNewContext(outputText, { exports, require: (name) => { assert.equal(name, "react"); return react; } });
  // Rendered twice, so effects' state updates show up; the arrays are copied out of the sandbox's realm.
  const render = (...args) => { index = 0; exports.useDownloadTagPrompt(...args); index = 0; const result = exports.useDownloadTagPrompt(...args); return { ...result, songIds: [...result.songIds] }; };

  const earlier = [{ librarySongId: "old", downloadStatus: "done" }];
  render(true, false, earlier, []);
  render(true, true, earlier, []);
  const after = [...earlier, { librarySongId: "new-1", downloadStatus: "done" }, { librarySongId: "", downloadStatus: "failed" }, { librarySongId: "new-2", downloadStatus: "failed" }];
  const finished = render(true, false, after, [{ librarySongId: "yt-1", ok: true }]);
  assert.deepEqual(finished.songIds, ["new-1", "yt-1"], "only songs this batch imported, failed ones left out");
  finished.dismiss();
  assert.deepEqual(render(true, false, after, [{ librarySongId: "yt-1", ok: true }]).songIds, [], "asked once per batch");
  render(false, true, after, []);
  assert.deepEqual(render(false, false, [...after, { librarySongId: "new-3", downloadStatus: "done" }], []).songIds, [], "never asks while tagging is off");
});

test("main registers tagging IPC and Experimental settings shows the panel", () => {
  assert.match(fs.readFileSync(path.join(root, "electron", "main.cjs"), "utf8"), /registerTaggingIpc\(ipcRouter/);
  assert.match(fs.readFileSync(path.join(root, "src", "features", "settings", "categories", "ExperimentalSettings.tsx"), "utf8"), /<TaggingSettings /);
});
