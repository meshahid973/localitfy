"use strict";

const { createScrobbler } = require("../scrobble/scrobbler.cjs");

/** Creates the scrobbler and its IPC. Returns it so play events can be observed and it can be stopped on quit. */
function startScrobbling(router, { file, getSong, listPlays, safeStorage, shell, startDelayMs = 10_000 }) {
  const secure = safeStorage?.isEncryptionAvailable?.() === true;
  const scrobbler = createScrobbler({
    file, getSong, listPlays,
    ...(secure ? { encrypt: (text) => `safe:${safeStorage.encryptString(text).toString("base64")}`,
      decrypt: (text) => (text.startsWith("safe:") ? safeStorage.decryptString(Buffer.from(text.slice(5), "base64")) : text.replace(/^plain:/, "")) } : {}),
    openUrl: (url) => shell.openExternal(url)
  });
  const answer = async (task) => {
    try { return { ok: true, status: await task() }; }
    catch (error) { return { ok: false, error: error?.message || "Something went wrong.", status: scrobbler.status() }; }
  };
  router.handle("scrobble:status", async () => scrobbler.status());
  router.handle("scrobble:connect-lastfm", (_event, payload = {}) => answer(() => scrobbler.connectLastfm(payload)));
  router.handle("scrobble:cancel-connect", async () => { scrobbler.cancelConnect(); return scrobbler.status(); });
  router.handle("scrobble:connect-listenbrainz", (_event, payload = {}) => answer(() => scrobbler.connectListenbrainz(payload)));
  router.handle("scrobble:disconnect", async (_event, name) => scrobbler.disconnect(name));
  router.handle("scrobble:send-history", (_event, name) => answer(() => scrobbler.sendHistory(name)));
  router.handle("scrobble:send-now", () => answer(async () => { await scrobbler.flush(); return scrobbler.status(); }));
  // Plays left over from last time go out once launch work has settled.
  setTimeout(() => void scrobbler.flush(), startDelayMs).unref?.();
  return scrobbler;
}

module.exports = { startScrobbling };
