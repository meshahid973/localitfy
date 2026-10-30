const REPOSITORY_URL = "https://github.com/meshahid973/localitfy";

// View shortcuts follow the sidebar order; ⌘, already opens Settings.
const MENU_VIEWS = [
  ["home", "Home"], ["library", "Library"], ["liked", "Liked Songs"], ["artists", "Artists"], ["genres", "Genres"],
  ["albums", "Albums"], ["playlists", "Playlists"], ["downloads", "Downloads"], ["covers", "Covers"], ["analytics", "Analytics"]
];

/**
 * Native macOS menu bar. Other platforms keep the custom title bar and no menu.
 * Items either use Electron roles, forward a player command, or send an
 * "app-menu:command" to the renderer, which owns navigation and dialogs.
 */
function createAppMenuRuntime({ Menu, shell, appName = "localtify", isDev = false, sendPlayerCommand, sendAppCommand, requestQuit }) {
  let lastKey = "";

  function buildTemplate({ hasSong = false, isPlaying = false } = {}) {
    const command = (type, extra = {}) => () => sendAppCommand({ type, ...extra });
    const player = (type) => () => sendPlayerCommand({ type, source: "menu" });
    // Space and ⌘←/⌘→ are handled by the renderer outside text fields, so the
    // menu only shows them; registering them here would break text editing.
    const shownOnly = { registerAccelerator: false };

    return [
      {
        label: appName,
        submenu: [
          { role: "about", label: `About ${appName}` },
          { label: "Check for Updates…", click: command("check-updates") },
          { type: "separator" },
          { label: "Settings…", accelerator: "Command+,", click: command("settings") },
          { type: "separator" },
          { role: "services" },
          { type: "separator" },
          { role: "hide", label: `Hide ${appName}` },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
          { label: `Quit ${appName}`, accelerator: "Command+Q", click: requestQuit }
        ]
      },
      {
        label: "File",
        submenu: [
          { label: "Import Music…", accelerator: "Command+O", click: command("import-music") },
          { label: "Import Album Folder…", accelerator: "Shift+Command+O", click: command("import-album-folder") },
          { label: "New Playlist", accelerator: "Command+N", click: command("new-playlist") },
          { type: "separator" },
          { role: "close" }
        ]
      },
      {
        label: "Edit",
        submenu: [
          { role: "undo" },
          { role: "redo" },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          { role: "pasteAndMatchStyle" },
          { role: "delete" },
          { label: "Select All", accelerator: "Command+A", click: command("select-all") },
          { type: "separator" },
          { label: "Find", accelerator: "Command+F", click: command("find") }
        ]
      },
      {
        label: "View",
        submenu: [
          ...MENU_VIEWS.map(([view, label], index) => ({
            label,
            accelerator: index < 9 ? `Command+${index + 1}` : undefined,
            click: command("navigate", { view })
          })),
          { type: "separator" },
          { label: "Back", accelerator: "Command+[", click: command("back") },
          { label: "Forward", accelerator: "Command+]", click: command("forward") },
          { type: "separator" },
          { role: "resetZoom" },
          { role: "zoomIn" },
          { role: "zoomOut" },
          { type: "separator" },
          ...(isDev ? [{ role: "forceReload" }, { role: "toggleDevTools" }, { type: "separator" }] : []),
          { role: "togglefullscreen" }
        ]
      },
      {
        label: "Controls",
        submenu: [
          { label: isPlaying ? "Pause" : "Play", accelerator: "Space", ...shownOnly, enabled: hasSong, click: player("toggle") },
          { label: "Next", accelerator: "Command+Right", ...shownOnly, enabled: hasSong, click: player("next") },
          { label: "Previous", accelerator: "Command+Left", ...shownOnly, enabled: hasSong, click: player("prev") },
          { type: "separator" },
          { label: "Shuffle", accelerator: "Command+S", click: player("shuffle") },
          { label: "Repeat", accelerator: "Command+R", click: player("repeat") },
          { label: "Mute", enabled: hasSong, click: player("muteToggle") }
        ]
      },
      { role: "windowMenu" },
      {
        role: "help",
        submenu: [
          { label: "Send Feedback…", click: command("feedback") },
          { type: "separator" },
          { label: `${appName} on GitHub`, click: () => void shell.openExternal(REPOSITORY_URL) },
          { label: "Report an Issue", click: () => void shell.openExternal(`${REPOSITORY_URL}/issues`) }
        ]
      }
    ];
  }

  /** Builds or refreshes the menu; skips the rebuild when nothing visible changed. */
  function update(state = {}) {
    if (process.platform !== "darwin") {
      if (lastKey !== "none") Menu.setApplicationMenu(null);
      lastKey = "none";
      return;
    }
    const key = `${Boolean(state.hasSong)}:${Boolean(state.isPlaying)}`;
    if (key === lastKey) return;
    lastKey = key;
    try {
      Menu.setApplicationMenu(Menu.buildFromTemplate(buildTemplate(state)));
    } catch (error) {
      console.log("[localtify menu error]", error?.message || error);
    }
  }

  /**
   * OS back/forward for the renderer's page history: macOS trackpad swipes (Electron reports them when
   * Trackpad › More Gestures › "Swipe between pages" includes three fingers), and the back/forward
   * app commands Windows and Linux send for mouse side buttons and browser keys.
   */
  function attachNavigationGestures(win) {
    win.on("swipe", (_event, direction) => {
      if (direction === "right" || direction === "left") sendAppCommand({ type: direction === "right" ? "back" : "forward" });
    });
    win.on("app-command", (_event, name) => {
      if (name === "browser-backward" || name === "browser-forward") sendAppCommand({ type: name === "browser-backward" ? "back" : "forward" });
    });
  }

  return { update, buildTemplate, attachNavigationGestures };
}

/**
 * Delivers menu commands to the renderer. When the command has to reopen a
 * closed window, it is held until that renderer subscribes and asks for it.
 */
function createAppCommandSender({ ipcRouter, showMainWindow, getWindow }) {
  const readyContents = new WeakSet();
  let pending = null;

  ipcRouter.handle("localitfy:app-menu-ready", async (event) => {
    readyContents.add(event.sender);
    const command = pending;
    pending = null;
    return command;
  });

  return (command) => {
    showMainWindow();
    const contents = getWindow()?.webContents;
    if (!contents || contents.isDestroyed()) return;
    if (readyContents.has(contents)) contents.send("app-menu:command", command);
    else pending = command;
  };
}

module.exports = { createAppMenuRuntime, createAppCommandSender, MENU_VIEWS };
