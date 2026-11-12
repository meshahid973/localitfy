Localtify 0.5.0 brings an experimental Android companion, live playback connections, a cleaner Home screen and faster large-library processing.

### Downloads
- **Windows x64:** `localtify-setup-0.5.0.exe`.
- **Linux x64:** AppImage, Debian and RPM packages.
- **Android:** `localtify-0.5.0-android.apk`, signed with the dedicated Localtify Android release key. Minimum Android 7.0 with an up-to-date System WebView.
- `SHA256SUMS` contains SHA-256 checksums for every installer and updater asset. The desktop packages are not code-signed; operating-system trust warnings may appear.

### Changes
- Sync your desktop music and artwork to Android for offline playback; exchange likes, playlists and listening history over your trusted home network.
- Connect playback across desktop and phone, with device controls and handoff.
- Android edge-to-edge rendering, less Home clutter, clearer collection controls and readable narrow-screen layouts.
- Dim, blurred album/GIF artwork backgrounds on Home and collection pages.
- Reuse normalized search metadata and recommendation calculations to reduce work on large libraries.
- Remove unused helpers, obsolete CSS and stale documentation; update compatible dependencies to resolve all previously identified critical npm advisories.

### Android installation
Install the APK from this release, then pair it with the same desktop version through Settings → Library. Keep the computer and phone on a trusted home network during sync. Afterwards, cached audio plays offline. See the [Android guide](https://github.com/meshahid973/localitfy/blob/v0.5.0/docs/android.md).

An APK previously installed from a debug build uses a different signing key. Android cannot update it directly with the release APK. Sync pending phone changes back to the desktop and preserve anything you need before uninstalling the debug build; uninstalling removes its local data. Future official APK updates use the same dedicated release key.

### Known limitations
- Android remains experimental. Sync/live transfers use plain HTTP on the trusted home network; do not expose the sync port to the internet.
- A delayed handoff acknowledgement can supersede a newer playback session. Select the intended device again if playback switches unexpectedly.
- Real-device background/Doze, headset controls, older WebViews and installed-desktop migration testing are not comprehensive.
- The full npm audit still reports one high Electron advisory entry and six moderate packaging/minimatch entries. The runtime-only audit reports zero; Electron provides the shipped browser runtime despite its devDependency classification. These advisories remain unresolved in this release.

Validation before release includes 517 application tests, release/performance checks, Android build/lint/unit tasks, emulator smoke checks and Windows/Linux/native CI. Additional release-asset checks verify package versions, formats, updater hashes and checksums.
