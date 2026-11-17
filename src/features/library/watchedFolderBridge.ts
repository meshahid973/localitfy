type WatchedFolderBridge = Pick<Window["localitfy"], "onWatchedFoldersChange" | "getWatchedFolderStatus" | "checkWatchedFolders" | "chooseWatchedFolder">;
type ChangeListener = Parameters<WatchedFolderBridge["onWatchedFoldersChange"]>[0];

// A Vite reload can update the renderer while the desktop preload is still old.
// Keep the running bridge's contract intact; unavailable features should not crash the app.
export function supportsWatchedFolders(bridge: Partial<WatchedFolderBridge> | undefined): boolean {
  return typeof bridge?.onWatchedFoldersChange === "function" &&
    typeof bridge.getWatchedFolderStatus === "function" &&
    typeof bridge.checkWatchedFolders === "function" &&
    typeof bridge.chooseWatchedFolder === "function";
}

export function subscribeWatchedFoldersChange(bridge: Partial<WatchedFolderBridge> | undefined, listener: ChangeListener): (() => void) | undefined {
  if (typeof bridge?.onWatchedFoldersChange !== "function") return;
  return bridge.onWatchedFoldersChange(listener);
}
