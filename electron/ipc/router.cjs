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

  return Object.freeze({
    handle,
    listChannels: () => Array.from(channels)
  });
}

module.exports = { createIpcRouter };