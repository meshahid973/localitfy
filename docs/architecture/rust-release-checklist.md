# Localtify native release checklist

Localtify is the user-facing product name. The existing GitHub repository name, app ID, executable and update identity are intentionally unchanged for compatibility. Optional native kernels are not a reason to rename an installed application.

## Safe defaults

- `npm run dist` and `npm run dist:linux` make ordinary JavaScript-capable packages. `clean:release` removes stale Rust addon binaries from `electron/native` before building.
- `npm run rust:dist` or `npm run rust:dist:linux` explicitly rebuilds and retains the matching native addon for packaging.
- `LOCALTIFY_RUST_PHASES` is empty by default. Shipping an addon does not enable kernels automatically.
- Use `LOCALTIFY_RUST_PHASES=pcm` to trial the PCM energy kernel. `similarity,bridge` is a separate typed-array experiment. Keep `centering`, `scanner` and `duplicates` opt-out until realistic tests show benefits.
- Never package a binary built on one OS/architecture for another OS/architecture.

## Developer installation

The obsolete `.npmrc` custom key was removed because modern npm warns about it. ONNX CPU usage is unchanged. Linux CI uses `ONNXRUNTIME_NODE_INSTALL=skip` to avoid the optional CUDA payload.

PowerShell setup for a local CPU-only install:

```powershell
$env:ONNXRUNTIME_NODE_INSTALL = "skip"
npm ci
npm run check
npm run rust:build
npm run rust:test
npm run rust:benchmark
```

## Before a public release

1. Confirm full Windows/Linux/macOS Rust CI, regular quality checks and model runtime package-smoke pass for the **final commit**.
2. Audit `npm audit --omit=dev` and `npm audit`. Investigate critical and high advisories, test safe upgrades separately, and do not use `npm audit fix --force` automatically.
3. Build both the standard and explicit Rust package in clean CI workspaces. Confirm addon absence in standard packages and a correctly loadable addon in Rust packages.
4. Install on a real Windows machine (and test other supported OSes): playback, seeking, pause/resume, crossfade, local imports, background analysis, Daily Mixes, duplicates, metadata, relinking, library search, database integrity, installer/uninstaller, auto-update and recovery.
5. Compare realistic libraries and audio files with native phases enabled/disabled. Include CPU, memory and process-exit behavior; compare numerical result equality and listen for audio regressions.
6. Keep experimental phases disabled by default. Only enable an individual phase after repeatable gains and manual playback QA.

Do not merge or publish merely because headless CI passes.
