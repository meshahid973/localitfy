"use strict";

function registerDiscordIpc(ipcRouter, services = {}) {
  if (!ipcRouter || typeof ipcRouter.handle !== "function") {
    throw new TypeError("registerDiscordIpc requires an IPC router");
  }

  const {
    setDiscordActivity,
    clearDiscordActivity,
    getDiscordStatus,
    resetDiscordActivityCache
  } = services;

  ipcRouter.handle("discord:set-activity", async (_event, payload) => {
    try { return { ok: await setDiscordActivity(payload) }; } catch { return { ok: false }; }
  });
  ipcRouter.handle("discord:clear-activity", async () => {
    try { return { ok: await clearDiscordActivity() }; } catch { return { ok: false }; }
  });
  ipcRouter.handle("discord:status", async () => getDiscordStatus());
  ipcRouter.handle("discord:reset-cache", async () => {
    resetDiscordActivityCache();
    return true;
  });
}

module.exports = { registerDiscordIpc };
