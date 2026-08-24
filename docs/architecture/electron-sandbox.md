# Electron sandbox and renderer trust boundary

## Current security boundary

Localitfy now runs the main renderer with `nodeIntegration: false`, `contextIsolation: true`, `webSecurity: true`, and **sandbox enabled**. The Spotify OAuth child window remains sandboxed as well.

The preload bridge uses `contextBridge` + `ipcRenderer` only; it does not depend on arbitrary Node modules in renderer scope. Privileged work stays in the Electron main process behind named IPC handlers.

## Navigation and child-window policy

The main renderer cannot create arbitrary child windows or attach webviews. Renderer-initiated navigation is restricted to Localitfy's packaged `localitfy://app` renderer, the exact packaged renderer directory used by the legacy `file://` fallback, and the loopback Vite origin during development. Arbitrary local HTML files are not trusted. External URLs must go through the explicit main-process external-open IPC path.

Browser permission requests are denied by default because Localitfy does not require camera, microphone, geolocation, notifications, MIDI, or other Chromium permissions for local playback.

## IPC trust boundary

Every handler registered through the centralized IPC router is protected by a **trusted sender** check. Calls are accepted only when the sender is the current main Localitfy window's `webContents` **and** the IPC call originated from that webContents' main frame. Child windows, iframes, and unrelated renderer contexts cannot invoke privileged Localitfy IPC channels.

This is intentionally enforced in the router rather than copied into dozens of individual handlers so new IPC channels inherit the same security boundary automatically.

## Main-process ownership

Native icon discovery and image creation live in `electron/runtime/icons.cjs` rather than the main-process orchestrator. Window translucency state, restart, and reload behavior live in `electron/runtime/translucency.cjs`. These ownership boundaries keep `electron/main.cjs` under its architecture budget while preserving tray, taskbar, packaged-resource, and window behavior.

## Non-negotiable invariants

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- `webSecurity: true`
- `webviewTag: false`
- insecure mixed-content execution disabled
- drag/drop navigation disabled
- renderer-created windows denied
- renderer navigation restricted to Localitfy-owned origins/paths
- browser permissions denied unless a future feature introduces an explicit reviewed allow-list
- privileged IPC accepted only from the active main Localitfy renderer's main frame

The Windows and Linux/native smoke matrix is the release gate for keeping these guarantees compatible with playback, imports, downloads, updater controls, tray/media integration, startup-at-login, custom protocols, and OAuth.
