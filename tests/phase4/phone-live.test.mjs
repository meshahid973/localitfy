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

    live.receive("computer", { type: "handoff-ready" });
    await post(fixture, { type: "handoff-ready" });
    // From the phone: "play on this phone".
    await post(fixture, { type: "transfer", to: phone });
    const give = fixture.computerEvents.at(-1);
    assert.equal(give.type, "give");
    assert.equal(give.to, phone);
    assert.ok(give.transferId);
    live.receive("computer", { type: "handoff", transferId: give.transferId, to: phone, requester: phone, handoff: { songId: "a", positionMs: 42000, playing: true, queue: ["b", "c"] } });
    const take = await stream.next("take");
    assert.deepEqual([take.giver, take.handoff.songId, take.handoff.positionMs, take.handoff.queue], ["computer", "a", 42000, ["b", "c"]]);
    assert.equal((await post(fixture, { type: "took" })).ok, false);
    assert.equal((await post(fixture, { type: "took", transferId: give.transferId })).ok, true);
    assert.equal(live.session.active, phone);

    // The phone can't play it (not copied): the computer hears so and keeps playing.
    live.receive("computer", { type: "claim" });
    assert.equal((await post(fixture, { type: "took", transferId: give.transferId })).ok, false);
    assert.equal(live.session.active, "computer");
    await post(fixture, { type: "transfer", to: phone });
    const fresh = fixture.computerEvents.at(-1);
    live.receive("computer", { type: "handoff", transferId: fresh.transferId, to: phone, requester: phone, handoff: { songId: "a" } });
    await post(fixture, { type: "take-failed", transferId: fresh.transferId, giver: "computer", requester: phone, message: "Not copied" });
    assert.equal(fixture.computerEvents.at(-1).type, "take-failed");
    stream.close();
  } finally {
    await fixture.close();
  }
});

test("playback: legacy or superseded transfers cannot claim a session", async () => {
  const fixture = await syncFixture();
  try {
    const stream = await openLiveStream(fixture.url, fixture.phone.pairing.token);
    const { self: phone } = await stream.next("hello");
    const { live } = fixture.server;
    live.receive("computer", { type: "claim" });
    const epoch = live.session.epoch;
    assert.equal((await post(fixture, { type: "transfer", to: phone })).ok, false);
    live.receive("computer", { type: "handoff-ready" });
    await post(fixture, { type: "handoff-ready" });
    await post(fixture, { type: "transfer", to: phone });
    const first = fixture.computerEvents.at(-1);
    await post(fixture, { type: "transfer", to: phone });
    const second = fixture.computerEvents.at(-1);
    assert.notEqual(second.transferId, first.transferId);
    const handoff = { type: "handoff", to: phone, requester: phone, handoff: { songId: "a" } };
    assert.equal(live.receive("computer", { ...handoff, transferId: first.transferId }).ok, false);
    assert.equal(live.receive("computer", { ...handoff, transferId: second.transferId }).ok, true);
    assert.equal(live.receive("computer", { type: "took", transferId: second.transferId }).ok, false);
    assert.equal((await post(fixture, { type: "took", transferId: first.transferId })).ok, false);
    assert.equal((await post(fixture, { type: "took", transferId: second.transferId })).ok, true);
    assert.equal(live.session.active, phone);
    assert.equal(live.receive("computer", { type: "command", action: "pause", epoch }).ok, false);
    stream.close();
  } finally {
    await fixture.close();
  }
});

test("playback: expired and reconnected recipients cannot acknowledge a transfer", async () => {
  let now = Date.now();
  const fixture = await syncFixture({ liveOptions: { now: () => now } });
  try {
    let stream = await openLiveStream(fixture.url, fixture.phone.pairing.token);
    const { self: phone } = await stream.next("hello");
    const { live } = fixture.server;
    live.receive("computer", { type: "claim" });
    live.receive("computer", { type: "handoff-ready" });
    await post(fixture, { type: "handoff-ready" });
    const begin = async () => {
      assert.equal((await post(fixture, { type: "transfer", to: phone })).ok, true);
      const give = fixture.computerEvents.at(-1);
      assert.equal(live.receive("computer", { type: "handoff", transferId: give.transferId, to: phone, requester: phone, handoff: { songId: "a" } }).ok, true);
      await stream.next("take");
      return give.transferId;
    };
    const expired = await begin();
    now += 6001;
    assert.equal((await post(fixture, { type: "took", transferId: expired })).ok, false);
    assert.equal(live.session.active, "computer");
    const previous = await begin();
    const oldStream = stream;
    stream = await openLiveStream(fixture.url, fixture.phone.pairing.token);
    await stream.next("hello");
    oldStream.close();
    await post(fixture, { type: "handoff-ready" });
    assert.equal((await post(fixture, { type: "took", transferId: previous })).ok, false);
    assert.equal(live.session.active, "computer");
    const fresh = await begin();
    assert.equal((await post(fixture, { type: "took", transferId: fresh })).ok, true);
    assert.equal(live.session.active, phone);
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
  // Advance the hub's clock explicitly. A loaded CI runner must not turn a
  // scheduled 30 ms sleep into more than the 100 ms peer expiry window.
  let clock = Date.now();
  const fixture = await syncFixture({ liveOptions: { heartbeatMs: 40, now: () => clock } });
  try {
    const stream = await openLiveStream(fixture.url, fixture.phone.pairing.token);
    await stream.next("hello");
    for (let i = 0; i < 5; i += 1) {
      clock += 40;
      assert.equal((await post(fixture, { type: "pong" })).ok, true);
      assert.equal(fixture.server.live.presence().peers.length, 2);
    }
    // Let the actual heartbeat sweep run while time remains below expiry.
    clock += 90;
    await new Promise(resolve => setTimeout(resolve, 80));
    assert.equal(fixture.server.live.presence().peers.length, 2);
    clock += 20;
    const deadline = performance.now() + 2000;
    while (fixture.server.live.presence().peers.length === 2 && performance.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.equal(fixture.server.live.presence().peers.length, 1, "silent for more than 2.5 heartbeats");
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
