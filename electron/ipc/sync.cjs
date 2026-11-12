const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { createSyncServer, isPrivateAddress } = require("../sync/server.cjs");

const SYNC_PORT = 47836;

function localAddresses() {
  return Object.values(os.networkInterfaces()).flat()
    .filter((entry) => entry && entry.family === "IPv4" && !entry.internal && isPrivateAddress(entry.address))
    .map((entry) => entry.address);
}

/** Settings → Phone sync. Off by default; while on, the Mac answers paired phones on the home network. */
function registerSyncIpc(router, { app, repositories, coverPath, listSongsShaped, getWindow, observePlay = () => {} }) {
  const serverName = os.hostname().replace(/\.local$/, "") || "Mac";
  let advertiser = null;
  let lastError = "";
  const notify = (channel, payload) => {
    const window = getWindow();
    if (window && !window.isDestroyed()) window.webContents.send(channel, payload);
  };
  const sync = createSyncServer({
    repositories,
    coverPath,
    serverName,
    appVersion: app.getVersion(),
    statePath: path.join(app.getPath("userData"), "phone-sync.json"),
    callFeature: (channel, payload) => router.invoke(channel, payload),
    onPlayEvent: (event) => { try { observePlay(event); } catch (error) { console.log("[localtify sync scrobble]", error?.message || error); } },
    onChanged: (change) => {
      if (change.devices) return notify("sync:status", status());
      // The open window keeps its own copy of songs and playlists; refresh it so it never saves over the phone's edits.
      notify("library:watched-change", { importedCount: 0, libraryChanged: true, songs: listSongsShaped() });
      if (change.playlists) notify("sync:playlists-changed", repositories.playlists.get());
      notify("sync:status", status());
    }
  });

  function advertise(port) {
    if (process.platform !== "darwin" || advertiser) return;
    // Bonjour lets the phone find the Mac without typing an address.
    advertiser = spawn("/usr/bin/dns-sd", ["-R", serverName, "_localtify._tcp", "local.", String(port), "v=1"], { stdio: "ignore" });
    advertiser.on("error", () => { advertiser = null; });
    advertiser.on("exit", () => { advertiser = null; });
  }

  function status() {
    return {
      enabled: sync.enabled,
      running: sync.running,
      port: sync.port,
      name: serverName,
      addresses: localAddresses(),
      pairing: sync.pairing,
      devices: sync.devices,
      error: lastError
    };
  }

  async function setEnabled(enabled) {
    sync.setEnabled(enabled);
    lastError = "";
    if (enabled) {
      try {
        advertise(await sync.start(SYNC_PORT));
      } catch (error) {
        lastError = error?.code === "EADDRINUSE" ? `Port ${SYNC_PORT} is already in use` : error?.message || "Could not start phone sync";
      }
    } else {
      advertiser?.kill();
      await sync.stop();
    }
    return status();
  }

  router.handle("sync:status", async () => status());
  router.handle("sync:set-enabled", async (_event, enabled) => setEnabled(enabled === true));
  router.handle("sync:pairing-code", async () => {
    if (!sync.running) await setEnabled(true);
    sync.newPairingCode();
    return status();
  });
  router.handle("sync:forget-device", async (_event, id) => {
    sync.forgetDevice(String(id || ""));
    return status();
  });

  if (sync.enabled) setEnabled(true).catch(() => undefined);
  app.on("before-quit", () => {
    advertiser?.kill();
    sync.stop().catch(() => undefined);
  });
}

module.exports = { registerSyncIpc, SYNC_PORT };
