# Local music analysis and recommendations

## Architecture

Localtify offers optional, on-device listening history, song analysis, similarity search, radio, Daily Mixes, and playlist suggestions. Analysis never downloads models on launch or by merely viewing Settings. The user explicitly enables the feature, downloads the verified model, and starts work.

The audio analysis pipeline is:

1. FFmpeg decodes three bounded 10-second sections of a local track to mono Float32 PCM.
2. A dedicated worker runs the optional CLAP audio encoder using Transformers.js and the CPU ONNX backend.
3. The worker normalizes 512-dimensional vectors and records measured sample energy (RMS). It does not upload audio, embeddings, or listening history.
4. SQLite persists versioned profile data, source-file identity, and listening events. Modified, deleted, or incompatible files invalidate stale profiles.
5. Similarity and Daily Mixes combine normalized audio profiles with metadata and listening history. Recommendation thresholds, stable ordering, exclusions, and playlist behavior remain in JavaScript.

The main renderer and Electron's privileged main process must not block on model inference. Only bounded background workers may decode and infer. The queue can be cancelled, suspended, or paused, including when battery-power permission is revoked.

## Model and licensing

The initial model is the CLAP HTSAT unfused **audio encoder only**. The upstream base model declares Apache-2.0; an ONNX conversion is pinned to revision `c28f2883575e590e04d3146ff0713c2448d691ba`. The pinned model/config download totals 34,302,907 bytes and must pass SHA-256 and size checks before installation. The application never accepts arbitrary model URLs supplied by the renderer.

Source references: [LAION CLAP base](https://huggingface.co/laion/clap-htsat-unfused), [Xenova ONNX conversion](https://huggingface.co/Xenova/clap-htsat-unfused), and [ONNX Runtime](https://onnxruntime.ai/docs/get-started/with-javascript/node.html). Keep model code, weights and conversion redistribution licenses independently reviewed. Mandatory shipped notices are `electron/analysis/LICENSE-CLAP.txt` and `electron/analysis/NOTICE.txt`.

Downloading the model is explicitly opt-in; progress, cancellation, integrity verification, deletion, and offline status must work. The model-size cap is 150 MB.

## Data and privacy

The trusted IPC boundary validates listening events and model controls. Listening snapshots are idempotent, bounded by real playback progress, and distinguish pause, seek, stall, completion, skip, interruption and crossfade. SQLite backups and recovery must preserve the existing library and playlist state.

The `song_analysis` cache tracks model/analyzer version, path, size, mtime, embeddings and error state; the `play_events` data tracks listening history separately from existing play counts. Disabling or clearing private analysis/history must not silently recreate it from late workers or pending IPC events. No audio, embeddings or listening history are sent to a remote analysis service.

MusicBrainz and online lyrics are separate, user-initiated metadata integrations. They may send song metadata to their providers when enabled.

## Recommendation and release validation

The current similarity engine uses normalized audio scores where available, with metadata/listening-history fallbacks for non-analyzed libraries. Radio and Daily Mixes keep deterministic seed selection, bounded workers, minimum group size, artist spacing, user preference exclusions, and stable cache invalidation.

Do not claim BPM, key, mood, or neural recommendation accuracy without measurements. Compare actual listening-based nearest neighbours, memory use, output parity and throughput with representative libraries. Optional Rust kernels are documented in [Native kernels and release checks](native-kernels.md); not all native stages outperform JavaScript.

Run `npm run release:check`, database recovery tests, optional offline model/FFmpeg smoke checks, and platform desktop QA before a release. Never test destructive operations on a real user's music library.
