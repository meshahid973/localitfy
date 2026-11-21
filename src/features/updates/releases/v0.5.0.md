Localtify 0.5.0 is a major update from 0.4.1: an experimental Android companion, connected playback, richer library navigation, smarter playlists and discovery, lyrics and scrobbling, safer library tools, and a broad UI/performance cleanup.

## Downloads

- **Windows x64:** `localtify-setup-0.5.0.exe`.
- **Linux x64:** AppImage, Debian (`.deb`) and RPM packages.
- **Android:** `localtify-0.5.0-android.apk`, signed with the dedicated Localtify Android release key. Requires Android 7.0/API 24 or later and an up-to-date System WebView.
- **Verification:** `SHA256SUMS` covers every installer and updater asset. The desktop packages are not code-signed; operating-system trust warnings may appear.

## Android companion and connected playback

- Pair your phone with the desktop app over home Wi-Fi, copy music and artwork, and listen offline from phone storage. Likes, playlists, play counts and listening history sync both ways.
- Phone navigation includes customizable bottom tabs, a mini player, a full-screen player with lyrics and queue access, swipe-to-skip, system media controls and native Back handling.
- Resume interrupted transfers, skip unchanged files and retry batches without counting the same plays twice. Temporarily unavailable desktop audio no longer causes the phone's cached library to be treated as deleted.
- While both devices are connected, share live likes, playback status and progress; control play/pause, next/previous and seeking from either device; edit the shared queue; and use **Play on** to move playback with its position and queue.
- Desktop-backed lyrics, biographies and recommendation results can be cached for offline use after fetching. Imports, tagging, cover editing and library maintenance remain desktop tools.

## Library, collections and navigation

- Dedicated **Artists** and **Genres** views make local metadata browsable, including featured artist credits and multi-value genre tags.
- Albums, artists, genres, playlists and Daily Mixes open as consistent collection pages with Back/Forward history, shared play/shuffle/queue actions and context menus. Album details open directly rather than being buried below a long shelf.
- Sort the library by artist. Sort genres by tracks, artists, plays, recent additions or name, and filter out genres with only a few tracks; choices are remembered.
- Folder imports prefer useful embedded album metadata. Large-library artwork handling and cover readiness are more reliable, including when the playing song is refreshed.
- Analytics now derives library health from the current songs and missing-file state rather than a stale snapshot.

## Playlists, discovery and local audio analysis

- **Smart playlists** fill themselves from rules for metadata, likes, play/finish/skip counts and listening dates, with all/any matching, ordering, limits and presets.
- **Recommended songs** appear under regular playlists, with add and refresh controls. They use saved audio analysis when available, or library relationships such as shared artists, genres, albums and playlists.
- **Playlists from a prompt** understand supported artists, genres, exclusions, listening-history filters and requested sizes. Optional local sound matching uses a separately enabled model download; preview and deselect songs before saving or playing.
- Opt-in, on-device audio analysis powers **Similar songs**, group recommendations from playlists/liked songs/recent listening, and **Song Radio** when your queue ends. Artist variety, skips, genre overlap and repeated back-to-back listening inform the results.
- Daily Mixes have more stable grouping, genre-aware names, listening feedback and rotation to reduce repetition. **Not for me** controls exclude unwanted songs and artists from recommendations while leaving normal library playback available.
- **Discover** uses optional Last.fm lookups for artists and songs outside your library, with a deliberate handoff to Downloads. Artist pages can show Last.fm biographies with cached offline fallback and source attribution. This is discovery, not an in-app streaming catalog.

## Lyrics, scrobbling, downloads and library tools

- Experimental synchronized lyrics support local `.lrc` files, optional online lookup, manual LRCLIB matching, offline persistence and per-song timing offsets.
- Connect **Last.fm and ListenBrainz** for eligible scrobbles, now-playing updates, queued offline submissions and deliberate history submission. Phone listening can be submitted through the paired desktop.
- **Watched folders** import newly added music automatically, including subfolders, with status and manual checking controls.
- **Duplicate review** uses album-aware grouping, explicit merge choices, database backups and file-safety protections rather than automatically deleting matches.
- Experimental **MusicBrainz tagging** audits missing/inconsistent tags, proposes metadata and cover art, and writes accepted changes only after review. Album completion tools help find missing tracks.
- YouTube downloads prefer proper audio-only streams instead of falling back to low-quality muxed video. Quality/format options reach the downloader correctly, and **Keep original audio** avoids a second lossy encode.
- macOS yt-dlp selection is fixed, and public Spotify imports handle missing artist metadata more reliably.

## Home, player and platform polish

- Reorder, hide, show and reset Home sections. Added shelves include Daily Mixes, Recently played and New albums, with optional Liked songs, Rediscover and Not played yet.
- Player title/artist links, like actions, the queue panel, album repeat-all, sidebar tab customization and the idle-screensaver toggle make common controls easier to reach.
- Android draws edge-to-edge behind the system bars with safe-area padding. Home is less cluttered, collection controls fit narrow screens, and song rows leave more room for titles while retaining touch-sized actions.
- Home and collection heroes use dim, blurred album artwork with GIF support. Settings, theme surfaces, menus, dialogs, focus restoration, long labels and playlist-row positioning receive consistency and accessibility fixes.
- macOS gains native window controls and a standard menu bar with keyboard shortcuts. These source/runtime improvements are included; this release publishes installers for Windows, Linux and Android.

## Performance, maintenance and validation

- Reuse normalized search text and existing index lookups, avoid unnecessary artist/album recounts, and cache repeated artist/genre calculations within each recommendation request.
- In the final optimization pass, a synthetic 50,000-song fixture measured metadata-equivalent snapshot indexing at **2.11 seconds → 165 ms**, and recommendation scoring at **279 → 117 ms**, with matching results. These are local processing measurements, not whole-app latency guarantees.
- Reduce repeated work in library updates, Home shelves, cover selection, download matching and phone artwork swipes. Remove unused components/helpers/exports, obsolete CSS/keyframes/theme variables and stale audit documents.
- Strengthen Electron renderer sandboxing, Content Security Policy, IPC/navigation boundaries, bridge typing and feature ownership. Database migration, backup and recovery checks remain part of validation.
- Experimental Rust-kernel tooling remains opt-in with JavaScript fallback; standard desktop installers exclude the optional addon. Compatible dependency updates resolve the previously identified critical npm advisories; remaining findings are listed below.
- Validation includes **517 automated tests**, release/performance checks, Windows/Linux installer and native CI, Android release build/lint/unit checks, package-format checks, updater-hash checks and all nine published asset digests. The public APK's checksum and dedicated release certificate were verified.

## Contributor acknowledgements

Thanks to @aume1

This release includes **32 merged PRs** from aume1, covering the following work:

| Area | Contributor PRs |
| --- | --- |
| Android and live device connection | [#127](https://github.com/meshahid973/localitfy/pull/127), [#134](https://github.com/meshahid973/localitfy/pull/134) |
| Audio analysis, mixes, radio, discovery and playlists | [#56](https://github.com/meshahid973/localitfy/pull/56), [#99](https://github.com/meshahid973/localitfy/pull/99), [#102](https://github.com/meshahid973/localitfy/pull/102), [#103](https://github.com/meshahid973/localitfy/pull/103), [#107](https://github.com/meshahid973/localitfy/pull/107), [#108](https://github.com/meshahid973/localitfy/pull/108), [#111](https://github.com/meshahid973/localitfy/pull/111), [#123](https://github.com/meshahid973/localitfy/pull/123) |
| Artists, genres, albums, sorting and navigation | [#43](https://github.com/meshahid973/localitfy/pull/43), [#47](https://github.com/meshahid973/localitfy/pull/47), [#49](https://github.com/meshahid973/localitfy/pull/49), [#51](https://github.com/meshahid973/localitfy/pull/51), [#53](https://github.com/meshahid973/localitfy/pull/53), [#121](https://github.com/meshahid973/localitfy/pull/121), [#125](https://github.com/meshahid973/localitfy/pull/125) |
| Home, player, sidebar, layout and artwork refresh | [#54](https://github.com/meshahid973/localitfy/pull/54), [#57](https://github.com/meshahid973/localitfy/pull/57), [#58](https://github.com/meshahid973/localitfy/pull/58), [#63](https://github.com/meshahid973/localitfy/pull/63), [#64](https://github.com/meshahid973/localitfy/pull/64), [#72](https://github.com/meshahid973/localitfy/pull/72), [#77](https://github.com/meshahid973/localitfy/pull/77) |
| Download quality and MusicBrainz tagging | [#120](https://github.com/meshahid973/localitfy/pull/120), [#122](https://github.com/meshahid973/localitfy/pull/122) |
| macOS window controls, menus and download fixes | [#45](https://github.com/meshahid973/localitfy/pull/45), [#71](https://github.com/meshahid973/localitfy/pull/71), [#110](https://github.com/meshahid973/localitfy/pull/110) |
| Large-library artwork and accurate library health | [#50](https://github.com/meshahid973/localitfy/pull/50), [#52](https://github.com/meshahid973/localitfy/pull/52), [#55](https://github.com/meshahid973/localitfy/pull/55) |

Five original contributions were carried forward through reviewed integration PRs instead of merging the original PRs directly. Credit for that original feature work is retained:

- **Synchronized lyrics:** [#78](https://github.com/meshahid973/localitfy/pull/78) → [#88](https://github.com/meshahid973/localitfy/pull/88).
- **Duplicate finder:** [#106](https://github.com/meshahid973/localitfy/pull/106) → [#116](https://github.com/meshahid973/localitfy/pull/116).
- **Watched folders:** [#109](https://github.com/meshahid973/localitfy/pull/109) → [#118](https://github.com/meshahid973/localitfy/pull/118).
- **Last.fm/ListenBrainz scrobbling:** [#112](https://github.com/meshahid973/localitfy/pull/112) → [#119](https://github.com/meshahid973/localitfy/pull/119).
- **Last.fm artist biographies:** [#124](https://github.com/meshahid973/localitfy/pull/124) → [#126](https://github.com/meshahid973/localitfy/pull/126).

Maintainer follow-ups added integration, security hardening, regression coverage, Android UI polish, performance work and the verified release/signing pipeline described above.

## Android installation and updating

Install the APK, then pair it with the same desktop version through **Settings → Library**. Keep both devices on a trusted home network during sync; cached audio plays offline afterwards. See the [Android guide](https://github.com/meshahid973/localitfy/blob/v0.5.0/docs/android.md).

An existing debug APK has a different signing key and cannot be updated directly with this release APK. Sync pending phone changes back to the desktop and preserve anything you need before uninstalling the debug build; uninstalling removes its local data. Future official APK updates use the same dedicated release key.

## Known limitations

- Android remains experimental. Sync/live transfers use plain HTTP on the trusted home network; do not expose the sync port to the internet.
- A delayed handoff acknowledgement can supersede a newer playback session. Select the intended device again if playback switches unexpectedly.
- Real-device background/Doze, headset controls, older WebViews and installed-desktop migration testing are not comprehensive.
- The pre-release full npm audit reported one high Electron entry and six moderate packaging/minimatch entries. The runtime-only audit reported zero; Electron provides the shipped browser runtime despite its devDependency classification. These advisories remain unresolved in this release.
- Online integrations are optional and may send the corresponding metadata or listening submissions to their providers; local audio analysis runs on-device.

**Full changelog:** [v0.4.1 → v0.5.0](https://github.com/meshahid973/localitfy/compare/v0.4.1...v0.5.0)
