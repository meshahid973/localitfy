# Android UI audit — 12 November 2026

Follow-up to the 0.5.0 cleanup, starting at `8fb1ae0`. Tested a debug APK
in a disposable Android API 37 emulator using synthetic songs, long metadata,
generated silent audio and a local sync server. No personal library or phone
data was changed.

## Reproduced problems and fixes

- The prompt playlist form overflowed a 324px dialog: its content reached 403px
  and pushed actions off screen. Android now stacks the form, rules and footer,
  lets grid children shrink and wraps example prompts. At 320px and 360px
  viewport widths, the dialog's scroll width matches its client width.
- Home's shared mascot rule overrode its 72px size, squeezing empty-state text
  out of view. The scoped size now wins; Android stacks the message and directs
  a new user to phone sync instead of a disabled listening button.
- Android Home now uses a compact card with a small cover and two-line title,
  four initial song rows, and no desktop expansion button. A fresh library has
  one sync setup card even if saved shelf settings hide every section. Empty
  recent/mix shelves no longer duplicate setup prompts. Home customization has
  touch-sized controls, an accessible icon label and native Back support, and
  no longer links the phone to the desktop-only cover editor.
- The WebView previously reserved the system-bar areas: a 360px-wide emulator
  exposed only 723px of its 800px display. `viewport-fit=cover`, AndroidX
  edge-to-edge and Capacitor's safe-area handling now fill all 800px. Content,
  bottom navigation, the landscape player and device menus retain system-bar
  padding. Desktop window corners are disabled on Android. Native icons switch
  contrast with light/dark themes and the full-screen player.
- Three player tool chips exceeded the available width. They wrap and truncate
  long device names; short screens can scroll the player rather than clip its
  controls. The backdrop now fills the viewport instead of enlarging scrollable
  bounds by 40%. Library statistics use one compact three-column row.
- Device menus used fixed dark colors. They now use semantic theme tokens and
  viewport limits, without an unnecessary background blur behind the surface.
- A WebView reload could leave the native live stream running but lose its
  original hello event. Recovering presence through the status endpoint now
  restores the connection and device picker; stale replies cannot reconnect
  an unpaired phone or overwrite a newer hello.
- Modal autofocus captured the input as its own restore target. The opener is
  captured before autofocus commits, and closing dialogs are excluded from
  restore targets. Player/More sheets also contain focus, including the player's
  explicitly owned portaled device menu.

## Cleanup and measured work reduction

- Removed uncalled Android `listFiles` and `cancelDownloads` bridge methods,
  their declarations, unused import and unreachable cancellation state/checks.
  No caller or cancellation UI used these APIs.
- Renamed the internal `MAC_ONLY_VIEWS` constant to `DESKTOP_ONLY_VIEWS` to match
  the existing Windows/Linux behavior; shortened an obsolete CSS header.
- Updating one phone song now shapes only that song instead of constructing
  the entire library and searching the result. A 10,000-song behavior test
  verifies one cached-file lookup and unchanged song output/like timestamps.
- Artwork swipes paint through one pending animation frame instead of setting
  React state on each touchmove and rerendering the player and lyrics.
- Artist collections on Home are grouped in one library pass rather than
  splitting and filtering the entire library separately for each artist.
- Removed an unused Home motion custom property, hidden now-playing markup,
  its prop and its dead CSS rule. Native system-bar updates observe theme
  changes and skip playback-only style changes.

## Verification

`npm run release:check` covers bridge contracts, boundaries, CSS audits,
507 tests, types, the production build, database recovery, performance budgets,
asset checks and chunk sizes. Android validation uses JDK 21 and
`assembleDebug lintDebug testDebugUnitTest`; native unit tests remain template
smoke tests. Fourteen additional behavior tests cover live recovery, library
updates, modal focus, phone/desktop Home rendering and system-icon contrast,
alongside the existing source assertions.

Emulator checks include populated Home/Library/Playlists, prompt generation and
focus restoration, the player and embedded lyrics, device menu bounds, a live
connection surviving WebView reload, 320px/360px portrait layouts, a short
landscape layout with reachable controls, and native Back/focus restoration.
Server-render tests cover fresh-install Home/setup with all saved shelves hidden.
Screenshots use native ADB capture:

- [Prompt results at 360px](screenshots/android-prompt-360.png)
- [Player at 360px](screenshots/android-player-360.png)
- [Home at 360px, including system bars](screenshots/android-home-360.png)
- [Home at 320px](screenshots/android-home-320.png)

Implementation follows the installed Capacitor 8.6 SystemBars contract and
[Android's WebView window-insets guidance](https://developer.android.com/develop/ui/views/layout/webapps/understand-window-insets).

Real devices, older Android versions, real audio libraries, interrupted transfers,
Doze, lock-screen/headset controls and full two-player handoff remain release QA
gates. Only release PR #133 is open; #127 and #134 were previously merged and
their review outcomes are recorded separately. This pass does not merge #133.
