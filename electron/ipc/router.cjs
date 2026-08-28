function createIpcRouter(ipcMain, options = {}) {
  if (!ipcMain || typeof ipcMain.handle !== "function") {
    throw new TypeError("ipcMain.handle is required");
  }

  const isTrustedEvent = typeof options.isTrustedEvent === "function" ? options.isTrustedEvent : null;
  const channels = new Set();

  function handle(channel, handler) {
    const normalizedChannel = String(channel || "").trim();
    if (!normalizedChannel) throw new TypeError("IPC channel is required");
    if (typeof handler !== "function") throw new TypeError(`IPC handler must be a function: ${normalizedChannel}`);
    if (channels.has(normalizedChannel)) throw new Error(`duplicate IPC handler: ${normalizedChannel}`);

    channels.add(normalizedChannel);
    ipcMain.handle(normalizedChannel, async (event, ...args) => {
      if (isTrustedEvent && !isTrustedEvent(event, normalizedChannel)) {
        throw new Error(`untrusted IPC sender: ${normalizedChannel}`);
      }
      return handler(event, ...args);
    });
    return normalizedChannel;
  }

  // The renderer bridge exposes sendPlayerCommand as an invoke call. Keep the
  // forwarding seam in the router so it cannot disappear when main.cjs is
  // decomposed into smaller runtime modules.
  handle("localitfy:player-command", async (event, command = {}) => {
    if (!command || typeof command !== "object") return false;
    if (!event?.sender || typeof event.sender.send !== "function") return false;
    event.sender.send("player:command", command);
    return true;
  });

  return Object.freeze({
    handle,
    listChannels: () => Array.from(channels)
  });
}

module.exports = { createIpcRouter };
