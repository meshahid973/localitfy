# Focused review of phone sync PRs — 12 November 2026

Reviewed [#127](https://github.com/meshahid973/localitfy/pull/127) at
`a837364ddbd772637750b80a011b29ba6466e2fc` and the additional changes in
[#134](https://github.com/meshahid973/localitfy/pull/134) at
`ec93a743aef2b543b629c8f5665d36ca39fd19a5` against #127.
The findings below describe those original heads. Both PRs were subsequently
merged into main and incorporated into the 0.5.0 release branch. The major cache
deletion issue was fixed in `85f6ff5` with two recovery regression tests before
merging. The lower-severity stale-handoff finding remains unchanged, as requested.

## [P1] Missing desktop media is treated as a phone-side deletion

[#127: electron/sync/server.cjs:118–125](https://github.com/aume1/localitfy/blob/a837364ddbd772637750b80a011b29ba6466e2fc/electron/sync/server.cjs#L118)
filters a song out of the authoritative snapshot whenever `fileInfo()` fails.
The song may still exist in the database: an unplugged external drive,
temporarily unavailable network share, or renamed file is sufficient.
[src/platform/android/sync.ts:269–282](https://github.com/aume1/localitfy/blob/a837364ddbd772637750b80a011b29ba6466e2fc/src/platform/android/sync.ts#L269)
then interprets its absence as deletion and removes the phone's cached files.

Reproduced with the PR's real HTTP/SQLite/phone-module test fixture:

1. Start `syncFixture()`: phone has one song and one cached file entry.
2. Change the desktop repository song's `filePath` to a nonexistent path,
   without deleting the database song.
3. Run `syncNow()`.
4. Sync reports `done`; the phone has zero songs and zero cached file entries,
   while the desktop repository still contains the original song ID.

The fixture mocks native file deletion, so no real user files were involved.
Production `removeDeletedSongs()` also calls native `deleteFile()` for these
entries. #134 inherits this behavior.

Retain unavailable songs in the manifest with an availability flag, or transmit
explicit deletion IDs. Preserve cached audio and pending edits when the desktop
cannot currently read the source file. Add an unplugged-drive sync regression
test that verifies phone cache and edits survive.

## [P2] A stale handoff acknowledgement can seize a newer session

[#134: electron/sync/live.cjs:130–133](https://github.com/aume1/localitfy/blob/ec93a743aef2b543b629c8f5665d36ca39fd19a5/electron/sync/live.cjs#L130)
handles `took` exactly like an unconditional `claim`. There is no pending-transfer
identity, expected recipient, or epoch check. The receiver also sends `took` and
starts playback without awaiting acceptance in
[usePlaybackConnect.ts:258–262](https://github.com/aume1/localitfy/blob/ec93a743aef2b543b629c8f5665d36ca39fd19a5/src/features/connect/usePlaybackConnect.ts#L258).

Reproduced against the actual live hub with two connected phone transport
doubles:

1. Computer claims epoch 1 and sends a handoff to phone A.
2. Phone B claims a new playback session, epoch 2.
3. Phone A's delayed `took` for the old handoff arrives with epoch 1.
4. Hub returns `ok: true` and changes the active player to phone A, epoch 3.

A delayed transfer can therefore interrupt a newer explicit playback choice.
Bind handoff messages and acknowledgements to a transfer ID and expected epoch;
reject cancelled/superseded transfers. Have the receiver wait for acceptance
before starting playback. Add a test where another device claims playback
between `handoff` and `took`.

## Checks and scope

- #127: `node --test tests/phase4/phone-sync.test.mjs tests/phase4/phone-sync-recovery.test.mjs` — 20 passed.
- #134: the same suites plus `tests/phase4/phone-live.test.mjs` — 33 passed.
- Both findings were reproduced separately after those suites passed.

This was a focused source and Node test review of sync/connection correctness.
Android APK compilation, emulator/device playback, background/Doze behavior,
and a full review of every changed renderer/layout file were not performed.
Those limits apply to the initial focused review. Subsequent integration checks
built and linted Android successfully; 456 desktop tests passed before #127's
merge and 469 before #134's merge. Current release-branch integration passes
493 desktop tests and Android build/lint tasks. Real-device and installed-app
manual QA remain separate.
