function createIpcRouter(ipcMain) {
  if (!ipcMain || typeof ipcMain.handle !== "function") {
    throw new TypeError("ipcMain.handle is required");
  }

  const channels = new Set();

  function handle(channel, handler) {
    const normalizedChannel = String(channel || "").trim();
    if (!normalizedChannel) throw new TypeError("IPC channel is required");
    if (typeof handler !== "function") throw new TypeError(`IPC handler must be a function: ${normalizedChannel}`);
    if (channels.has(normalizedChannel)) throw new Error(`duplicate IPC handler: ${normalizedChannel}`);

    channels.add(normalizedChannel);
    ipcMain.handle(normalizedChannel, handler);
    return normalizedChannel;
  }

  return Object.freeze({
    handle,
    listChannels: () => Array.from(channels)
  });
}

module.exports = { createIpcRouter };
