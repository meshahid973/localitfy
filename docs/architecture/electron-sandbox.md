# Electron sandbox investigation

## Current security boundary

Localitfy keeps `nodeIntegration: false`, `contextIsolation: true`, and `webSecurity: true` for the main renderer. The Spotify OAuth child window is already created with `sandbox: true` because it does not need the preload bridge or Localitfy's local-media integration.

The main player window intentionally remains `sandbox: false` in Phase 3. This is not an endorsement of leaving Chromium unsandboxed forever; it is a compatibility checkpoint. The current preload and media stack depend on Electron capabilities that must be audited and moved behind narrow IPC contracts before sandboxing can be enabled without breaking playback, local-file URLs, native media integration, updater controls, and startup/window behavior.

## Why Phase 3 does not flip the switch

Turning `sandbox: true` on as a mechanical change would be a high-risk behavior change on Windows. Phase 3 instead makes the prerequisites visible: exact preload/type parity, centralized IPC registration, protocol ownership, service lifecycle boundaries, and typed renderer contracts.

## Migration path

1. Inventory every preload method and classify it as filesystem, media, window, updater, authentication, or diagnostics.
2. Remove any preload implementation that relies on Node globals in the renderer execution context rather than `contextBridge` + IPC.
3. Exercise local playback, imports, cover selection, downloads, updater flow, tray/media keys, startup-at-login, and OAuth in a sandbox-enabled canary build.
4. Enable `sandbox: true` for the main window only after the Windows canary passes those smoke tests.
5. Keep `nodeIntegration: false`, `contextIsolation: true`, and `webSecurity: true` as non-negotiable invariants.

Phase 3 therefore records sandboxing as an explicit follow-up hardening migration rather than hiding a risky one-line switch inside an architecture refactor.
