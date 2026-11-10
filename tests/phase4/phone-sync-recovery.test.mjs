import assert from "node:assert/strict";
import test from "node:test";
import { receiptDatabase, receiptRepository, syncFixture } from "../helpers/phone-sync-fixture.mjs";

const plain = (value) => JSON.parse(JSON.stringify(value));
const once = (action) => {
  let called = false;
  return (...args) => { if (!called) { called = true; return action(...args); } };
};
const play = (outcome = "active") => {
  const startedAt = Date.now() - 60000;
  const updatedAt = Date.now() - 1000;
  return { id: "event", sessionId: "session", songId: "a", startedAt, updatedAt,
    endedAt: outcome === "active" ? null : updatedAt, msListened: 40000, outcome, contextType: "library", contextId: null };
};

test("sync receipts roll changes back with a failed batch and reject stale or altered retries", () => {
  const database = receiptDatabase();
  try {
    database.exec("CREATE TABLE counter (value INTEGER); INSERT INTO counter VALUES (2)");
    const receipts = receiptRepository(database);
    const change = () => { database.prepare("UPDATE counter SET value=value+3").run(); return { count: 5 }; };
    assert.throws(() => receipts.applyBatch("phone", 1, "digest", () => { change(); throw new Error("disk write failed"); }), /disk write failed/);
    assert.equal(database.prepare("SELECT value FROM counter").get().value, 2);
    assert.equal(receipts.applyBatch("phone", 1, "digest", change).replayed, false);
    assert.equal(receipts.applyBatch("phone", 1, "digest", change).replayed, true);
    assert.equal(database.prepare("SELECT value FROM counter").get().value, 5);
    assert.throws(() => receipts.applyBatch("phone", 1, "altered", change), /out of order/);
    assert.throws(() => receipts.applyBatch("phone", 3, "digest", change), /out of order/);
    assert.throws(() => receipts.applyBatch("phone", undefined, "digest", change), /Update the Android app/);
    receipts.applyBatch("phone", 2, "second", () => ({}));
    assert.throws(() => receipts.applyBatch("phone", 1, "digest", change), /out of order/);
    assert.equal(database.prepare("SELECT value FROM counter").get().value, 5);
  } finally { database.close(); }
});

test("edits and another play during a changes request rebase without repeating the first play delta", async () => {
  const f = await syncFixture();
  try {
    f.phone.patchSong("a", { playCount: 5 });
    f.hooks.afterChanges = once(() => {
      f.phone.patchSong("a", { liked: true, playCount: 6 });
      f.repositories.songs.patch("a", { playCount: 9 }); // Four additional Mac plays, on top of the acknowledged five.
    });
    await f.sync.syncNow();
    assert.equal(f.sync.getSyncProgress().phase, "done");
    assert.equal(f.repositories.songs.get("a").playCount, 10);
    assert.equal(f.repositories.songs.get("a").liked, true);
    assert.equal(f.phone.songs()[0].playCount, 10);
    assert.deepEqual(f.requests.map(({ body }) => [body.sequence, body.songs.a.playCountDelta]), [[1, 3], [2, 1]]);
  } finally { await f.close(); }
});

test("a play finishing during POST is delivered even if its timestamp and array length stay the same", async () => {
  const f = await syncFixture();
  try {
    const active = play();
    f.phone.recordPlayEvent(active);
    const revision = f.phone.revision;
    f.hooks.afterChanges = once(() => f.phone.recordPlayEvent({ ...active, outcome: "ended", endedAt: active.updatedAt }));
    await f.sync.syncNow();
    assert.ok(f.phone.revision > revision);
    assert.deepEqual(f.requests.map(({ body }) => body.playEvents[0].outcome), ["active", "ended"]);
    assert.equal(f.scrobbled.length, 1);
    assert.equal(f.scrobbled[0].outcome, "ended");
    assert.equal(f.phone.pendingEvents.length, 0);
    await f.restartPhone();
    assert.equal(f.phone.pendingEvents.length, 0);
  } finally { await f.close(); }
});

for (const failure of ["response", "snapshot"]) {
  test(`lost ${failure} and both app restarts replay the durable batch exactly once`, async () => {
    const f = await syncFixture();
    try {
      f.phone.patchSong("a", { playCount: 5 });
      f.phone.recordPlayEvent(play("ended"));
      if (failure === "response") f.hooks.afterChanges = once(() => { throw new Error("response lost"); });
      else f.hooks.beforeRequest = onceAfterPost(f, () => { throw new Error("snapshot lost"); });
      await f.sync.syncNow();
      assert.equal(f.sync.getSyncProgress().phase, "error");
      assert.equal(f.repositories.songs.get("a").playCount, 5);
      assert.equal(f.persisted.get("pendingSync").sequence, 1);
      await assert.rejects(f.sync.forgetMac(), /pending sync/);
      f.phone.patchSong("a", { title: "Edited while retrying" });
      await f.phone.save(["edits"]);
      await f.restartServer();
      await f.restartPhone();
      f.hooks.afterChanges = undefined;
      f.hooks.beforeRequest = undefined;
      await f.sync.syncNow();
      assert.equal(f.sync.getSyncProgress().phase, "done");
      assert.equal(f.repositories.songs.get("a").playCount, 5);
      assert.equal(f.repositories.songs.get("a").title, "Edited while retrying");
      assert.deepEqual(f.requests.map(({ body }) => body.sequence), [1, 1, 2]);
      assert.deepEqual(f.requests[0].body, f.requests[1].body);
      assert.equal(f.phone.pendingSync, null);
      assert.equal(f.phone.pendingEvents.length, 0);
      assert.equal(f.scrobbled.length, 1, "replaying a committed batch must not scrobble again");
    } finally { await f.close(); }
  });
}

function onceAfterPost(fixture, action) {
  let called = false;
  return (request) => {
    if (!called && fixture.requests.length && request.url.endsWith("/v1/snapshot")) { called = true; return action(); }
  };
}

test("a failed outbox write sends nothing; retry persists it before sending", async () => {
  const f = await syncFixture();
  try {
    f.phone.patchSong("a", { playCount: 5 });
    let failed = false;
    f.hooks.beforeSave = (values) => { if (!failed && values.pendingSync) { failed = true; throw new Error("outbox unavailable"); } };
    await f.sync.syncNow();
    assert.equal(f.sync.getSyncProgress().phase, "error");
    assert.equal(f.requests.length, 0);
    f.hooks.beforeSave = undefined;
    await f.sync.syncNow();
    assert.equal(f.sync.getSyncProgress().phase, "done");
    assert.equal(f.repositories.songs.get("a").playCount, 5);
  } finally { await f.close(); }
});

test("failed acknowledgement storage followed by a new edit persists its matching baseline for restart", async () => {
  const f = await syncFixture();
  try {
    f.phone.patchSong("a", { playCount: 5 });
    f.hooks.afterChanges = once(() => f.repositories.songs.patch("a", { playCount: 9 }));
    let failed = false;
    f.hooks.beforeSave = (values) => {
      if (!failed && values.pairing?.sequence === 1 && values.pendingSync === null) { failed = true; throw new Error("checkpoint unavailable"); }
    };
    await f.sync.syncNow();
    assert.equal(f.sync.getSyncProgress().phase, "error");
    f.phone.patchSong("a", { playCount: 10 });
    await f.phone.save(["edits"]);
    assert.equal(f.persisted.get("base").songs.a.playCount, 9);
    await f.restartPhone();
    f.hooks.beforeSave = undefined;
    await f.sync.syncNow();
    assert.equal(f.sync.getSyncProgress().phase, "done");
    assert.equal(f.repositories.songs.get("a").playCount, 10);
  } finally { await f.close(); }
});

test("playlist and non-synced resume edits made during the request survive acknowledgement and restart", async () => {
  const f = await syncFixture();
  try {
    f.phone.savePlaylists([{ id: "p", name: "Sent name", songIds: ["a"], createdAt: 1 }]);
    f.hooks.afterChanges = once(() => {
      f.phone.savePlaylists([{ id: "p", name: "Later name", songIds: ["a"], createdAt: 1 }]);
      f.phone.patchSong("a", { playbackPosition: 42 });
    });
    await f.sync.syncNow();
    assert.equal(f.repositories.playlists.get()[0].name, "Later name");
    await f.restartPhone();
    assert.equal(f.phone.songs()[0].playbackPosition, 42);
    assert.equal(f.phone.playlists[0].name, "Later name");
    assert.deepEqual(plain(f.phone.base.playlists), plain(f.repositories.playlists.get()));
  } finally { await f.close(); }
});
