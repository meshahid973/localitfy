# Opt-in Rust kernels: phased design and go/no-go gates (2026-11-10)

## Current JavaScript baseline (retain as production default)

- Similarity: `electron/analysis/similarity.cjs` combines 512-dimensional CLAP audio vectors, genre tags, listening/skip/co-play signals and file freshness checks. It runs in a short-lived `worker_threads` worker. Daily Mixes: `electron/analysis/daily-mixes.cjs` does deterministic k-means-like clustering with minimum group sizes and preserves per-day cache validation.
- Duplicates: `electron/library-duplicates.cjs` groups by cleaned recording key, duration, optional vector cosine, album-copy relationships and quality ranking. `electron/ipc/library-duplicates.cjs` validates merge plans, backs up the database and handles Trash operations.
- Scanner: `electron/library-watch.cjs` scans asynchronously with a depth cap of 12, limit 50,000, hidden/partial-file exclusions, and idempotent imports; `electron/metadata-service.cjs` defines supported audio extensions.
- Existing native dependencies are SQLite, FFmpeg, and Chromium image processing. They are NOT migration targets.

Before enabling native code, record the baseline using `node scripts/benchmark-rust-phases.cjs`. This runs the existing JS implementations (not a synthetic substitute for the algorithms). Keep `LOCALTIFY_RUST_PHASES` unset for all shipping builds.

## Phases (one PR, independently gated)

1. **Similarity**: native packed Float64 dot-matrix scoring for matching and Daily Mixes' Lloyd assignment. JS controls genre blending, eligibility, co-play, playlist selection and persistence.
2. **Duplicates**: native batch audio dot-products for candidate pairs within metadata buckets. JS continues to own recording normalization, thresholds, grouping, user validation, database backups and filesystem mutations.
3. **Scanner**: bounded native recursive audio-file listing inside a dedicated Node worker, never an Electron UI thread. JS watcher, error handling, callbacks and import behavior stay in place. On failure/missing addon, use the original asynchronous JS scan.

Rust NAPI-RS is a native addon built per OS/CPU. All phases are **disabled by default**, opted in by `LOCALTIFY_RUST_PHASES=similarity,duplicates,scanner` (or a subset). Never allow untrusted renderer IPC to enable native features. Missing ABI, load errors, runtime errors or parity failures fall back to JS. Native is experimental and optional; do not substitute platform binaries or assume a Linux build runs on Windows/macOS.

## Contract / safety checklist

- Native dot order mirrors JS scalar summation; validate lengths, row-major indexing, finite inputs and output parity. Do not modify scoring thresholds, tie-breaking or database schemas.
- Duplicate scan must remain read-only; do not move merge/delete logic or alter confidence rules.
- Scanner must reject symlink traversal, cap depth/files, skip hidden and partial files and app-private folders, and filter with the existing JS `isAudioFile`. Node worker has a deadline and JS fallback.
- Avoid native work in Electron's main/UI event loop. Similarity/mixes already run in background workers.
- NAPI addon must be built and tested separately on Windows x64, Linux x64 GNU and macOS ARM64 (and macOS x64 if available); CI must exercise the native gate, type/check baseline and verify packaged addon location. Existing non-native jobs must still pass with no Cargo dependency.
- **No automatic merge.** Inspect Linux/Windows/macOS jobs, tests, review feedback, and benchmark regression before approving a native release. Without reliable speedup, keep flag OFF or reject native path.

## Benchmark / acceptance

`node scripts/benchmark-rust-phases.cjs` prints timings on the current host for JavaScript production algorithms. `node scripts/test-rust-kernels.cjs` checks JS/native numerical parity and identical duplicate/scan results when an addon is built. `node scripts/benchmark-rust-phases.cjs --compare` times both backends on equivalent fixtures. OS variance makes cross-run timings incomparable; no unsupported performance claim.

## Follow-up: performance-safe consolidation

- The first Windows baseline (from local developer machine) showed similarity 3.55 ms JS vs 2.13 ms Rust, but 240-track mixes 44.43 vs 53.00 ms, 600-song duplicate detection 7.69 vs 12.31 ms, and a 180-file scan 2.07 vs 35.24 ms. These measurements prompted conservative changes; results vary by machine.
- Duplicate comparison now groups eligible candidate pairs **across** metadata buckets and crosses NAPI once, only when the amount of vector work is large enough. The original JS fallback handles small, incomplete, invalid or mixed-dimension cases.
- Scanner now reuses a dedicated Node worker rather than starting a thread for every scan. A bounded pending queue, deadline, explicit trusted standard extension predicate, source-directory containment checks and worker-crash fallback are mandatory; custom predicates always use JS. The worker is unref'd to avoid blocking app exit.
- Keep JS as default and avoid claiming an automatic win. Performance must be re-measured with real, large libraries before any production switch.

## Reproducibility and release packaging

- `native/rust-kernels/Cargo.lock` pins the complete verified crate graph for the app, including checksums. CI uses `cargo test --locked` and the native release build uses `cargo build --locked`. Direct NAPI crate versions are exact-pinned.
- To package a Windows installer with the optional native addon: `npm run rust:dist` (requires Rust and the existing Electron installer toolchain). For Linux distributions: `npm run rust:dist:linux`. Ordinary `npm run dist` remains JavaScript-capable and does not require Rust.
- Small Daily Mixes workloads remain on the scalar JS path even when experimental Rust is enabled. Native comparisons are only considered after 1 million estimated multiply-adds, based on measured small-library regression and larger-fixture tests.
- Before a production release, validate the generated installer on a real Windows/macOS/Linux desktop. CI packaging and headless Electron smoke are not a substitute for complete visual/audio manual QA.
