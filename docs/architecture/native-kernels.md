# Optional native kernels and release checks

Localtify's JavaScript implementation remains the production default. The NAPI-RS addon is optional, runs only in trusted Electron/Node workers, and must not alter user data, database schemas, playlist policy, playback, or renderer IPC.

## What is native

| Phase | Purpose | Release status |
| --- | --- | --- |
| `pcm` | Validate FFmpeg Float32 samples and compute RMS energy | Strong synthetic improvement; real-audio QA required |
| `similarity` | Batched cosine/dot scores and full Daily Mixes clustering | Mixed results; workload-gated |
| `bridge` | JS-owned typed-array score output (with similarity/duplicates) | Opt-in; platform-dependent |
| `duplicates` | Large candidate-pair dot-score batches | Often slower on smaller buckets |

Enable experiments only through the trusted environment variable `LOCALTIFY_RUST_PHASES`, for example `pcm` or `similarity,bridge`. Unavailable binaries, rejected input, and native errors fall back to JavaScript. No phase is automatically enabled merely because a native package was installed.

## Limits and compatibility

- FFmpeg does the actual audio decoding; ONNX Runtime does inference. Rust only accelerates selected numerical operations.
- All native inputs are bounded, finite-checked, and validated before using results. Native outputs must match JavaScript and preserve stable sorting, grouping, and duplicate decisions.
- Folder scans, import/merge/delete logic, and audio centering use the existing JavaScript implementations. Experimental Rust scanning and centering were retired because benchmarks consistently favored JavaScript.
- `electron/analysis/LICENSE-CLAP.txt` and `electron/analysis/NOTICE.txt` are required model license notices. Do not remove them.
- Preserve legacy `window.localitfy` bridge naming, app ID, and user-data paths.

## Build and test

Use Node.js 22 and the Rust toolchain where required.

~~~bash
npm ci
npm run release:check
npm run rust:build
npm run rust:test
npm run rust:benchmark
~~~

The normal `npm run dist` / `npm run dist:linux` removes stale optional addons before packaging. Only `npm run rust:dist` / `npm run rust:dist:linux` includes the platform's rebuilt addon. These explicit commands require a matching Windows x64 or Linux x64 host and reject cross-target Cargo builds. Preparation strips addons from all other platforms and refuses to destroy a previous package when the target addon is missing.

Native CI builds Windows, Linux and macOS packages; checks that native packages **load and execute** their addon and standard packages contain **no** optional addon. It also runs unit, parity, security, normal app and packaging tests.

## Security and release gates

CI reports runtime dependency advisories for triage. Review the current audit results before a release; a full developer-toolchain audit and install-script approvals remain separate checks. Do not use blanket install-script approval or automatic `npm audit fix --force`.

Before merging or publishing, verify CI against the current commit. For a public installer, also test actual desktop playback, seeking, file imports, analysis, recommendations, duplicates, database backup/recovery, updater flow, signing/notarization where applicable, and installation/uninstallation. On Linux, check Wayland/X11, AppImage permissions and downloadable tools; GPU/compositor fallback switches are for troubleshooting only.

Benchmarks are synthetic and vary by host. Use `npm run rust:benchmark` for current measurements, and keep optional phases disabled until representative libraries show a consistent benefit.

## Related documentation

- [Music analysis](music-analysis-and-recommendations.md)
- [Electron sandbox and IPC](electron-sandbox.md)
- [Development contribution rules](../../CONTRIBUTING.md)
