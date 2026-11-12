import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { runInNewContext } from "node:vm";
import { openLiveStream, send, syncFixture } from "../helpers/phone-sync-fixture.mjs";

function compile(file) {
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  runInNewContext(output, { exports });
  return exports;
}
const session = compile("src/features/connect/liveSession.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));

async function post(fixture, message, token = fixture.phone.pairing.token) {
  const response = await send({ url: `${fixture.url}/v1/live`, method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(message) });
  return { status: response.status, ...JSON.parse(response.body) };
}

const liked = (fixture) => Boolean(fixture.repositories.songs.get("a").liked);

test("live: the computer advertises the live connection without changing the batch protocol", async () => {
  const fixture = await syncFixture();
  try {
    const hello = JSON.parse((await send({ url: `${fixture.url}/v1/hello` })).body);
    assert.equal(hello.protocol, 2);
    assert.equal(hello.live, 1);
    assert.equal(fixture.server.snapshot().live, 1);
    assert.equal((await openLiveStream(fixture.url, "wrong")).status, 401);
    assert.equal((await post(fixture, { type: "status" }, "wrong")).status, 401);
  } finally {
    await fixture.close();
  }
});

test("live: a phone's stream says who it is, and the computer sees it come and go", async () => {
  const fixture = await syncFixture();
  try {
    const stream = await openLiveStream(fixture.url, fixture.phone.pairing.token);
    const hello = await stream.next("hello");
    assert.ok(hello.self);
    assert.deepEqual(hello.peers.map((peer) => peer.kind), ["computer", "phone"]);
    assert.equal(fixture.computerEvents.at(-1).peers.length, 2);
    stream.close();
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(fixture.computerEvents.at(-1).peers.length, 1);
  } finally {
    await fixture.close();
  }
});

test("live: forgetting the phone closes its stream and refuses it from then on", async () => {
  const fixture = await syncFixture();
  try {
    const stream = await openLiveStream(fixture.url, fixture.phone.pairing.token);
    const hello = await stream.next("hello");
    fixture.server.forgetDevice(hello.self);
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(fixture.server.live.presence().peers.length, 1);
    assert.equal((await openLiveStream(fixture.url, fixture.phone.pairing.token)).status, 401);
  } finally {
    await fixture.close();
  }
});

test("likes: a live like reaches the computer at once and is not sent again by the next batch", async () => {
  const fixture = await syncFixture();
  try {
    const stream = await openLiveStream(fixture.url, fixture.phone.pairing.token);
    await stream.next("hello");
    fixture.phone.patchSong("a", { liked: true });
    const changedAt = fixture.phone.likeClock.a;
    const reply = await post(fixture, { type: "like", songId: "a", liked: true, changedAt });
    assert.equal(reply.applied, true);
    assert.equal(liked(fixture), true);
    assert.deepEqual(fixture.computerEvents.filter((event) => event.type === "like").map(({ songId, liked: value }) => [songId, value]), [["a", true]]);
    fixture.phone.adoptMacLike("a", reply.liked, reply.changedAt);
    await fixture.sync.syncNow();
    assert.equal(fixture.requests.length, 0, "nothing left to send");
    stream.close();
  } finally {
    await fixture.close();
  }
});

test("likes: the newest tap wins, whichever way and order it arrives", async () => {
  const fixture = await syncFixture();
  try {
    // Liked on the phone while away from home…
    fixture.phone.patchSong("a", { liked: true });
    fixture.phone.likeClock.a = Date.now() - 60_000;
    // …then liked and unliked on the computer since.
    fixture.server.live.applyLike("a", true);
    fixture.server.live.applyLike("a", false);
    await fixture.sync.syncNow();
    assert.equal(fixture.requests.at(-1).body.songs.a.likedAt, fixture.phone.likeClock.a);
    assert.equal(liked(fixture), false, "the older phone tap does not undo the computer's");
    assert.equal(fixture.phone.songs()[0].liked, false, "the phone adopts the computer's like");

    // A live like replayed later, or one older than what the computer has, changes nothing.
    const stream = await openLiveStream(fixture.url, fixture.phone.pairing.token);
    await stream.next("hello");
    const old = await post(fixture, { type: "like", songId: "a", liked: true, changedAt: Date.now() - 30_000 });
    assert.deepEqual([old.applied, old.liked], [false, false]);
    const newer = await post(fixture, { type: "like", songId: "a", liked: true, changedAt: Date.now() });
    assert.deepEqual([newer.applied, liked(fixture)], [true, true]);
    const replay = await post(fixture, { type: "like", songId: "a", liked: true, changedAt: newer.changedAt });
    assert.equal(replay.applied, false);
    stream.close();
  } finally {
    await fixture.close();
  }
});

test("likes: a like made on the computer is pushed to a connected phone", async () => {
  const fixture = await syncFixture();
  try {
    const stream = await openLiveStream(fixture.url, fixture.phone.pairing.token);
    await stream.next("hello");
    fixture.server.live.announceLike(fixture.server.live.applyLike("a", true), "computer");
    const event = await stream.next("like");
    assert.deepEqual([event.songId, event.liked], ["a", true]);
    assert.equal(fixture.phone.adoptMacLike("a", event.liked, event.changedAt), true);
    await fixture.sync.syncNow();
    assert.equal(fixture.requests.length, 0);
    assert.equal(fixture.phone.songs()[0].liked, true);
    stream.close();
  } finally {
    await fixture.close();
  }
});

test("likes: a phone without the live connection still wins with its batch, as before", async () => {
  const fixture = await syncFixture();
  try {
    fixture.server.live.applyLike("a", false);
    const result = fixture.server.applyChanges({ songs: { a: { liked: true } } });
    assert.equal(result.applied.songs, 1);
    assert.equal(liked(fixture), true);
  } finally {
    await fixture.close();
  }
});

test("playback: one active player; its state reaches remotes and commands reach it", async () => {
  const fixture = await syncFixture();
  try {
    const stream = await openLiveStream(fixture.url, fixture.phone.pairing.token);
    const { self: phone } = await stream.next("hello");
    const { live } = fixture.server;

    // The computer starts playing.
    live.receive("computer", { type: "claim" });
    const presence = await stream.next("presence");
    assert.equal(presence.session.active, "computer");
    const epoch = presence.session.epoch;
    live.receive("computer", { type: "state", epoch, songId: "a", title: "A", playing: true, positionMs: 1000, at: 5, durationMs: 9000, queue: ["b"] });
    const { state } = await stream.next("state");
    assert.deepEqual([state.songId, state.playing, state.positionMs, state.queue, state.from], ["a", true, 1000, ["b"], "computer"]);

    // The phone, as a remote, pauses it; a state from a device that isn't the player is refused.
    assert.equal((await post(fixture, { type: "command", action: "pause", epoch })).ok, true);
    assert.equal(fixture.computerEvents.at(-1).type, "command");
    assert.equal(fixture.computerEvents.at(-1).from, phone);
    assert.equal((await post(fixture, { type: "state", epoch, songId: "a" })).ok, false);
    assert.equal((await post(fixture, { type: "command", action: "explode" })).ok, false);

    // The phone presses play itself: it becomes the player and the computer is told.
    await post(fixture, { type: "claim" });
    assert.equal(fixture.computerEvents.at(-1).session.active, phone);
    assert.equal(live.receive("computer", { type: "state", epoch, songId: "a" }).ok, false, "an old epoch is ignored");
    stream.close();
  } finally {
    await fixture.close();
  }
});

test("playback: moving playback asks the player for a handoff and hands it to the target", async () => {
  const fixture = await syncFixture();
  try {
    const stream = await openLiveStream(fixture.url, fixture.phone.pairing.token);
    const { self: phone } = await stream.next("hello");
    const { live } = fixture.server;
    live.receive("computer", { type: "claim" });

    // From the phone: "play on this phone".
    await post(fixture, { type: "transfer", to: phone });
    assert.deepEqual(plain(fixture.computerEvents.at(-1)), { type: "give", to: phone, requester: phone });
    live.receive("computer", { type: "handoff", to: phone, requester: phone, handoff: { songId: "a", positionMs: 42000, playing: true, queue: ["b", "c"] } });
    const take = await stream.next("take");
    assert.deepEqual([take.giver, take.handoff.songId, take.handoff.positionMs, take.handoff.queue], ["computer", "a", 42000, ["b", "c"]]);
    await post(fixture, { type: "took" });
    assert.equal(live.session.active, phone);

    // The phone can't play it (not copied): the computer hears so and keeps playing.
    live.receive("computer", { type: "claim" });
    await post(fixture, { type: "take-failed", giver: "computer", requester: phone, message: "\"A\" isn't copied to this phone yet" });
    assert.equal(fixture.computerEvents.at(-1).type, "take-failed");
    stream.close();
  } finally {
    await fixture.close();
  }
});

test("playback: a player that drops off keeps its place for a while, then the session lets go", async () => {
  const fixture = await syncFixture({ liveOptions: { graceMs: 80 } });
  try {
    let stream = await openLiveStream(fixture.url, fixture.phone.pairing.token);
    const { self: phone } = await stream.next("hello");
    await post(fixture, { type: "claim" });
    stream.close();
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(fixture.server.live.session.active, phone, "a Wi-Fi blip keeps the phone the player");
    stream = await openLiveStream(fixture.url, fixture.phone.pairing.token);
    const hello = await stream.next("hello");
    assert.equal(hello.session.active, phone);
    stream.close();
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.equal(fixture.server.live.session.active, "");
  } finally {
    await fixture.close();
  }
});

test("presence: a phone that stops answering heartbeats is dropped; one that answers stays", async () => {
  const fixture = await syncFixture({ liveOptions: { heartbeatMs: 40 } });
  try {
    const stream = await openLiveStream(fixture.url, fixture.phone.pairing.token);
    await stream.next("hello");
    for (let i = 0; i < 5; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 30));
      await post(fixture, { type: "pong" });
    }
    assert.equal(fixture.server.live.presence().peers.length, 2);
    await new Promise((resolve) => setTimeout(resolve, 250));
    assert.equal(fixture.server.live.presence().peers.length, 1, "silent for 2.5 heartbeats");
    stream.close();
  } finally {
    await fixture.close();
  }
});

test("queue: remote edits apply as is, or merge with what the player changed meanwhile", () => {
  assert.deepEqual(plain(session.mergeQueueEdit(["a", "b", "c"], ["a", "b", "c"], ["c", "a"])), ["c", "a"]);
  // The player moved on past "a" and queued "d" while the remote reordered.
  assert.deepEqual(plain(session.mergeQueueEdit(["a", "b", "c"], ["b", "c", "d"], ["c", "b", "a", "e"])), ["c", "b", "e", "d"]);
  assert.deepEqual(plain(session.addToQueue(["a", "b"], ["b", "c"], true)), ["b", "c", "a"]);
  assert.deepEqual(plain(session.addToQueue(["a", "b"], ["c"], false)), ["a", "b", "c"]);
});

test("position: a remote moves the progress on from the last report without new messages", () => {
  const state = { playing: true, positionMs: 10_000, at: 1000, rate: 1, durationMs: 60_000 };
  assert.equal(session.livePositionMs(state, 4000), 13_000);
  assert.equal(session.livePositionMs({ ...state, playing: false }, 4000), 10_000);
  assert.equal(session.livePositionMs({ ...state, rate: 1.5 }, 3000), 13_000);
  assert.equal(session.livePositionMs(state, 1_000_000), 60_000);
});
