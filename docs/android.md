# Android installation and pairing

The Android companion is experimental. Download the release-signed APK from [GitHub Releases](https://github.com/meshahid973/localitfy/releases), or follow the developer instructions below to build a debug APK.

Release and debug APKs use different signing keys. To move from a debug build to an official release, first sync pending phone changes back to the computer and preserve anything you need, then uninstall the debug build before installing the release APK. Uninstalling erases its local data. Official release APKs share a dedicated signing key so later official updates can preserve app data.

The phone copies songs and covers from the desktop library, then plays them from app storage without needing the Mac. Likes, playlists, play counts, and listening events are exchanged during sync. Song details, albums, covers, downloads, imports, MusicBrainz tagging, scrobbling accounts, and library maintenance are managed on the desktop; the phone shows the desktop's covers and metadata after each sync. Lyrics, artist biographies, Discover, and audio recommendations use the paired Mac when reachable and keep previously fetched results for offline use. They do not provide new online results independently of the Mac.

## Requirements

- An Android phone running Android 7.0 / API 24 or later, with an up-to-date Android System WebView. API 24 is the configured minimum, not a statement that every supported version has been device-tested.
- Enough free internal storage for the whole music library and covers. There is currently no selective-sync or SD-card storage picker.
- The desktop app built from the same version as the phone app. Phone sync has a protocol version: if the phone says to update and restart the Mac app, the desktop build is older than the phone's. The phone calls the computer a Mac or a PC once it has paired.
- The Mac and phone on the same trusted home network for pairing and sync. Keep the Mac app open and the Mac awake.

To build: Node.js 22+, npm, JDK 21, Android SDK Platform 36, Android SDK Build-Tools 35.0.0 (the default for the current Gradle plugin), and Android SDK Platform-Tools (`adb`). Android Studio can install the SDK components. This branch uses Capacitor 8.6.0, Gradle 8.14.3, and Android Gradle Plugin 8.13.0; use the checked-in Gradle wrapper.

## Build the APK

From the Android-enabled checkout:

```sh
npm ci
npm run build
npx cap sync android
```

Set `JAVA_HOME` to your JDK 21 installation and `ANDROID_HOME` to your Android SDK directory. On macOS the SDK is usually `$HOME/Library/Android/sdk`. Alternatively, create the untracked `android/local.properties` file with `sdk.dir=/absolute/path/to/Android/sdk`.

```sh
cd android
./gradlew assembleDebug
cd ..
```

On Windows use `gradlew.bat assembleDebug` in the `android` directory. The APK is:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Run both `npm run build` and `npx cap sync android` again after changing the web app. Gradle alone packages the last copied web assets and can otherwise produce a stale APK.

## Install with a USB cable

1. On the phone, enable Developer options by tapping **Build number** seven times (usually under Settings → About phone → Software information).
2. Enable **USB debugging**, connect a data-capable USB cable, unlock the phone, and accept the computer's debugging authorization prompt.
3. Add the SDK's `platform-tools` directory to your `PATH`, or replace `adb` below with its absolute path.
4. List devices, then install onto the intended phone:

```sh
adb devices -l
adb -s YOUR_PHONE_SERIAL install -r android/app/build/outputs/apk/debug/app-debug.apk
adb -s YOUR_PHONE_SERIAL shell am start -n com.meshahid973.localitfy/.MainActivity
```

Use the phone's serial from `adb devices -l`, not an attached emulator's serial. `-r` updates the app while preserving its library and pairing. Do not add `-d` or uninstall to resolve a version/signature error without first considering the data you would lose.

You can also copy an APK you built to the phone, open it in the Files app, and allow **Install unknown apps** for that file manager when Android asks. USB debugging is only needed for the ADB route. Samsung device protection settings can also restrict sideloading or USB installation; check the phone's displayed explanation if installation is refused.

## Pair and copy the library

1. In the Mac app, open **Settings → Library → Phone sync**, choose **Turn on**, then **Pair a phone**.
2. Note the address including its port, such as `192.168.1.20:47836`, and the six-digit code. A code expires after ten minutes and works once. Five incorrect attempts require a new code.
3. On the phone, open **more → settings → Library → Sync with Mac**. Enter that Mac address and code, then tap **Pair**. Do not enter `localhost`; that would refer to the phone itself.
4. The first sync starts automatically. Keep the phone app open until copying finishes. Subsequent syncs skip unchanged files and can resume after an interrupted transfer.
5. Check the successful sync status before leaving home, then try a song with Wi-Fi turned off.

Use **Sync now** to exchange changes on demand. Automatic sync runs on launch and when returning to the app if the last attempt was at least ten minutes ago. This is not continuous background sync. Play events reach the Mac's configured scrobbling accounts when the devices sync; accounts are managed on the Mac.

Songs deleted on the Mac are removed from the phone at the next successful sync. Phone storage belongs to the app: clearing app data or uninstalling deletes downloaded music, pairing, and unsynced edits/history. Unpairing leaves the downloaded library on the phone.

## Live connection on the same network

While the phone and the computer are on the same network and both apps are open, they stay connected live. Batch sync (above) still runs and is what catches up after time apart.

- **Likes** go across within about a second, both ways. The newest tap wins, by the computer's clock: a like or unlike made on the phone while away is sent with the time it was tapped, so it does not undo a later change made on the computer, and the other way round. A like that already went across live is not sent again by the next batch sync. Phones from before the live connection send no times; their edits win as they always did.
- **Playback**: one device is the player and the other is a remote. The remote shows the song, play/pause and the progress, and its controls (play, pause, next, previous, seek, shuffle, repeat) act on the player. Picking a song or adding to the queue on the remote does it on the player too. Pressing play on the remote device's own song makes it the player instead, and the other one pauses: only one plays at a time.
- **Moving playback**: the device button in the player bar (on the phone: **devices** in the full-screen player) lists this device and the connected ones. Picking one moves the song, the position, the queue, shuffle and repeat there. If the other device doesn't take it within a few seconds, the music carries on where it was.
- **The queue is shared**: adding, removing or reordering on either device changes the player's queue, and the remote shows that queue. Edits made at the same time are merged.
- **Songs not copied to the phone yet**: the phone can't play them. Playback is not moved to the phone while one of them is playing; the computer keeps playing and says why. Queued ones stay in the queue greyed out ("not on this phone") and are skipped when their turn comes. A song added on the computer after the phone's last sync is unknown to the phone and is left out of its queue. Controlling the computer from the phone plays anything in the computer's library.
- **Phone controls**: while the phone is a remote, its notification, lock screen and headset buttons show and control what plays on the computer.
- **Status**: the phone's **Sync with Mac** card shows whether the live connection is up. Plays still reach the computer (and scrobbling) through batch sync, not live.

What the connection does when things change:

- The computer sends a heartbeat every 25 seconds and the phone answers it. A phone that stops answering for about a minute (Wi-Fi off, out of the house) is dropped. If it was the player, it stays the player for another 30 seconds in case it comes back; after that the computer's player is its own again. A phone that was playing keeps playing from its own copy.
- The phone reconnects by itself: right away when Wi-Fi comes back or the network changes, otherwise after 1, 2, 5, 10, then every 30 seconds. On reconnecting after time away it runs a batch sync, so likes and plays from while it was away arrive straight away. A phone that comes back still playing becomes the player again.
- To save battery the connection closes a minute after the app leaves the screen, unless something is playing on either device. It costs one small message each way every 25 seconds and holds no wake lock.
- The live connection uses the same port, pairing token and home-network-only check as sync (`GET /v1/live` is a server-sent-events stream, `POST /v1/live` carries the phone's messages). The computer advertises it as `live: 1` in `/v1/hello` and the snapshot. A phone talking to an older computer keeps syncing in batches and says to update the computer; older phones ignore the field. Batch sync stays protocol 2.

Library management, tagging, cover editing, downloads and desktop-only settings stay on the computer. Volume is set on each device.

## Updating and troubleshooting

- **`adb` not found:** use `<Android SDK>/platform-tools/adb`, or add that directory to `PATH`.
- **`unauthorized` / no device:** unlock the phone, accept USB debugging authorization, and check the cable. If necessary reconnect it and re-authorize the computer.
- **More than one device:** use `adb -s SERIAL` on every command. A phone and emulator were both connected during the device review.
- **Java or SDK not found:** check `java -version`, `JAVA_HOME`, and `ANDROID_HOME` / `android/local.properties`. Keep machine-specific paths out of Git.
- **App updates but UI is unchanged:** rebuild the web app and run `npx cap sync android` before rebuilding the APK.
- **Signature mismatch:** a debug APK from another computer can use a different debug certificate. An update needs the same signing key. Uninstalling would erase phone data, including unsynced history.
- **Cannot reach the Mac:** confirm Phone sync is on, the displayed address is current, the Mac is awake, and both devices are on the same LAN. Allow the desktop app's incoming connections through the Mac firewall. Guest Wi-Fi, client isolation, or a VPN may prevent access. The default TCP port is `47836`.
- **Wrong/expired pairing code:** generate another with **Pair a phone** on the Mac. A code can only pair one phone.
- **Sync interrupted / storage full:** free sufficient internal storage, reopen the app, and retry **Sync now**. Keep the app open during large transfers. Inspect the status rather than assuming a partially copied library is complete.
- **"Update and restart the Mac app":** the desktop app is older than the phone app. Update or rebuild the desktop app from the same version, restart it, then sync again.
- **Lyrics/bios/recommendations unavailable away from home:** only previously fetched answers are cached. Fetch them while the Mac is reachable first.

Sync and the live connection use plain HTTP and bearer-token authentication on the home network. Pairing does not encrypt transfers. Use a trusted network and do not expose the port to the internet. The server refuses non-private peer addresses, but that is not a substitute for encrypted transport or protection against another device on the same network.

## Developer validation

```sh
npm run check
cd android
./gradlew assembleDebug lintDebug testDebugUnitTest
```

The existing GitHub quality workflow does not build Android. Native unit tests in the generated project are template smoke tests; the sync tests (including interrupted and repeated syncs) run in the Node suite. Before a release, check on a real phone: first sync and an interrupted transfer, changes made during a sync, native Back from menus, dialogs and the player, and media playback from the notification and headphones. For the live connection: like on each side, control playback both ways, move playback in both directions, edit the queue on each side, then turn Wi-Fi off and on again. The live tests are in `tests/phase4/phone-live.test.mjs`.

## Known live-connection limitation

A delayed playback handoff acknowledgement can supersede a newer device's playback session. If playback unexpectedly switches devices, select the intended device again. Transfer identity and acknowledgement ordering still need hardening before treating handoff as release-ready.
