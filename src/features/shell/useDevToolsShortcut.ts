import { useEffect } from "react";
import type { useAppToast } from "./useAppToast";

/** Ctrl/Cmd+Shift+I opens the developer tools through whichever bridge the build exposes. */
export function useDevToolsShortcut(showAppToast: ReturnType<typeof useAppToast>["showAppToast"]) {
  useEffect(() => {
    const handleDevToolsShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key.toLowerCase() !== "i") return;

      event.preventDefault();
      event.stopPropagation();

      const bridge = window.localitfy as typeof window.localitfy & {
        toggleDevTools?: () => Promise<void> | void;
        openDevTools?: () => Promise<void> | void;
        showDevTools?: () => Promise<void> | void;
      };

      const toggleDevTools = bridge?.toggleDevTools || bridge?.openDevTools || bridge?.showDevTools;

      if (typeof toggleDevTools === "function") {
        void Promise.resolve(toggleDevTools()).catch(() => showAppToast("DevTools bridge failed", "error"));
        return;
      }

      try {
        const maybeRequire = (window as typeof window & { require?: (name: string) => any }).require;
        const electron = typeof maybeRequire === "function" ? maybeRequire("electron") : null;
        const ipcRenderer = electron?.ipcRenderer;

        if (ipcRenderer?.send) {
          ipcRenderer.send("localitfy:toggle-devtools");
          return;
        }
      } catch {
        // Production builds with contextIsolation may not expose require. Main/preload can still wire the bridge later.
      }

      showAppToast("DevTools shortcut needs the main/preload bridge", "error");
    };

    window.addEventListener("keydown", handleDevToolsShortcut, true);
    return () => window.removeEventListener("keydown", handleDevToolsShortcut, true);
  }, []);
}
