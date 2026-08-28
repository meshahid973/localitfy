<div align="center">

# localtify

### your local music, but prettier.

A cute desktop music player for people who still keep songs on their PC.

<br />

<img src="screenshots/showcase.png" alt="localtify screenshot" width="840">

<br />
<br />

<a href="https://github.com/meshahid973/localitfy/releases">
  <img alt="Download localtify" src="https://img.shields.io/badge/download-latest%20release-8dffce?style=for-the-badge&labelColor=050505">
</a>
<img alt="Windows" src="https://img.shields.io/badge/Windows-supported-7aa2ff?style=for-the-badge&labelColor=050505">
<img alt="Linux" src="https://img.shields.io/badge/Linux-supported-facc15?style=for-the-badge&labelColor=050505">
<img alt="License" src="https://img.shields.io/badge/license-MIT-ffffff?style=for-the-badge&labelColor=050505">

<br />
<br />

<strong>no need for account</strong> <strong>no subscription.</strong> <strong>No ads between your songs.</strong>

</div>

---

## About localtify

localtify is a modern desktop music player for your own local files.

It takes the songs you already have and turns them into a proper music library with albums, playlists, covers, themes, listening stats, Discord Rich Presence, desktop controls, and a smooth dark interface.

It is built for people who like owning their music, organizing their own library, and making local songs feel clean, personal, and modern again.

localtify is not a streaming service. It does not need an account, it does not put ads between your songs, and it does not move your music into someone else's cloud.

---

## Why localtify?

Most local music apps either feel too old, too plain, or too messy.

localtify tries to make a local library feel closer to a real modern music app while still keeping everything on your computer.

You can:

* keep your own files
* organize songs into albums and playlists
* customize covers and themes
* download or import music into your library
* use desktop media controls
* show optional Discord listening activity
* keep the app private and local-first

---

## Download

Get the latest version from the Releases page:

<p>
  <a href="https://github.com/meshahid973/localitfy/releases">
    <img alt="Download localtify" src="https://img.shields.io/badge/download-localtify-8dffce?style=for-the-badge&labelColor=050505">
  </a>
</p>

## Star History

<a href="https://www.star-history.com/?repos=meshahid973%2Flocalitfy&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=meshahid973/localitfy&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=meshahid973/localitfy&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=meshahid973/localitfy&type=date&legend=top-left" />
 </picture>
</a>

### Windows

Download the Windows installer from the latest release.

The file usually looks like this:

```txt
localtify-setup-0.4.1.exe
```

Install it, open localtify, and import your songs.

### Linux

Linux builds are available from the Releases page.

| Format      | Good for                             |
| ----------- | ------------------------------------ |
| `.AppImage` | Most Linux distros                   |
| `.deb`      | Ubuntu, Debian, Linux Mint           |
| `.rpm`      | Fedora, openSUSE, RHEL style distros |

For AppImage, you may need to make it executable first:

```bash
chmod +x localtify-0.4.1-x86_64.AppImage
./localtify-0.4.1-x86_64.AppImage
```

---

## Features

### Music library

* play your own local songs
* import music into your library
* search your songs
* like songs
* create playlists
* add songs to playlists
* shuffle and repeat
* queue songs
* use a clean bottom player
* keep everything local

### Albums

* automatic albums from song metadata
* folder-based album importing
* custom albums made from songs in your library
* custom album title, artist, year, and cover
* album detail pages
* play album
* shuffle album
* queue album
* support for different artists in one album
* proper cover fitting for album cards

### Downloads and imports

* download audio from YouTube links
* import public Spotify playlists, albums, and tracks
* convert local video or audio files into library tracks
* automatically add downloaded songs to your library
* view download progress and results
* open the downloads folder from inside the app

### Visuals

* clean dark interface
* themes
* custom theme colors
* pixel art covers
* cover studio tools
* album cover glow in some areas
* smooth sidebar hover
* cleaner panels and page transitions
* visual settings for the home page, cards, sidebar, library, and player
* cute little easter eggs like `/yukari` and `/stars`

### Desktop features

* Discord Rich Presence
* privacy controls for Discord activity
* media key support
* tray controls
* startup option on Windows
* update popup
* auto update support
* listening stats
* Windows installer
* Linux AppImage, DEB, and RPM builds

---

## Screenshots

<p align="center">
  <img src="screenshots/localtify-home.png" alt="localtify home screen" width="840">
</p>

---

## Run from source

You need:

* Node.js
* npm
* Git

Windows is recommended for the full desktop experience, but Linux builds are supported too.

Clone the repo:

```bash
git clone https://github.com/meshahid973/localitfy.git
cd localitfy
```

Install dependencies:

```bash
npm install
```

Create your local environment file.

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

On macOS or Linux:

```bash
cp .env.example .env
```

You can leave most values empty for normal development.

Run localtify in development mode:

```bash
npm run dev
```

Run the full local validation gate:

```bash
npm run release:check
```

Build the frontend:

```bash
npm run build
```

Build the Windows installer:

```bash
npm run dist
```

Build Linux packages:

```bash
npm run dist:linux
```

The finished app files will be created inside the `release` folder.

---

## Common commands

| Command                  | What it does                                      |
| ------------------------ | ------------------------------------------------- |
| `npm run dev`            | Starts localtify in development mode              |
| `npm run check`          | Runs bridge, architecture, CSS, tests and build   |
| `npm run release:check`  | Runs the complete local release validation gate   |
| `npm run build`          | Builds the renderer                               |
| `npm run dist`           | Builds the Windows installer                      |
| `npm run publish`        | Builds and publishes the Windows release          |
| `npm run dist:linux`     | Builds Linux AppImage, DEB, and RPM               |
| `npm run publish:linux`  | Builds and publishes Linux release files          |
| `npm run chunks:audit`   | Shows the biggest built frontend files            |

---

## Project structure

```txt
src/                 React app and feature-owned UI
electron/            Electron main process and native services
electron/runtime/    focused native runtime owners such as updater and media serving
electron/ipc/        IPC routing and domain registration
pixelart/            bundled pixel art cover images
public/              public static files
build/               app icons and build resources
screenshots/         README and release images
```

---

## Tech stack

localtify uses:

* Electron
* React
* TypeScript
* Vite
* SQLite with better-sqlite3
* Discord RPC
* electron-updater
* electron-builder

Some internal names still use `localitfy` because that was the original project and repo name.

The visible app name is `localtify`.

Please do not rename internal bridge names, IPC names, app IDs, or app data paths unless it is part of a proper migration.

Important internal names:

```txt
window.localitfy
localitfy:* IPC channels
com.meshahid973.localitfy
```

These are kept for compatibility with older installs.

---

## CSS ownership

Keep styles with their feature owner. `App.css` is retained only for older shared app-level rules that have not yet been safely migrated.

| File              | What it owns                                      |
| ----------------- | ------------------------------------------------- |
| `app-core.css`    | app shell, titlebar, base layout                  |
| `App.css`         | remaining older shared app-level styles          |
| `home.css`        | Home feature                                      |
| `player.css`      | bottom player, progress bar, volume, controls     |
| `settings.css`    | settings page and settings cards                  |
| `themes.css`      | theme variables and theme mappings                |
| `motion.css`      | shared animations and transitions                 |
| `effects.css`     | active-song and small shared visual effects       |
| `mini-player.css` | detached mini player window                       |

Do not automatically delete CSS merely because a static selector scan says it looks unused. Localtify has dynamic runtime classes. The unused-selector audit is advisory; deterministic duplicate/shadow cleanup is the safe automated path.

---

## Contributing

Pull requests are welcome.

Small fixes, bug reports, screenshots, UI polish, documentation improvements, accessibility improvements, and performance fixes are useful.

Before opening a pull request, run:

```bash
npm install
npm run release:check
```

When making a pull request, please include:

```txt
What changed:
Why it changed:
How you tested it:
Screenshots:
Anything risky:
```

If your change affects the database, settings, updater, playlists, preload, IPC, or app data path, please say that clearly.

---

## Privacy

localtify is built around local music.

Your songs stay on your computer.
You do not need an account.
Discord activity is optional and can be turned off in settings.
Browser-cookie access for the downloader is disabled by default and must be explicitly opted into.

Please do not commit private files such as:

```txt
.env
local databases
logs
release builds
node_modules
dist
user data
downloaded music
private exports
```

---

## Files that should not be committed

These should stay ignored:

```txt
.env
.env.*
node_modules/
dist/
release/
.claude/
*.sqlite
*.sqlite3
*.db
*.log
logs/
backups/
localtify_asset_backups/
```

Use `.env.example` for public environment examples.

---

## How to publish source changes

Check what changed:

```bash
git status
```

Add the files you want to push, commit them with a focused message, then push directly to the intended branch.

```bash
git add <files>
git commit -m "feature fixed"
git push
```

---

## How to publish a new app release

Make sure the version is correct in `package.json` and in the app's visible version metadata.

Run the release gate before packaging:

```bash
npm run release:check
```

Build and publish Windows:

```bash
npm run dist
npm run publish
```

Build and publish Linux:

```bash
npm run dist:linux
npm run publish:linux
```

---

## Release checklist

Before publishing a release, check:

* `npm run release:check` passes
* the app opens
* songs still load
* playback works for imported and existing songs
* albums open properly
* custom albums save properly
* playlists still load
* importing songs works
* downloaded songs appear in the library
* YouTube downloads work
* Spotify imports work
* local file conversion works
* covers and pixel art fallback covers load
* settings save after restarting the app
* update popup looks correct
* tray menu works
* media keys work
* Discord Rich Presence works when enabled
* startup option works on Windows
* Linux packages build successfully
* app name says localtify
* icon looks correct
* installer builds successfully
* `.env`, `node_modules`, `dist`, and `release` are not committed

---

## Known notes

* Dev mode may show Electron in some Windows places because it runs through Electron directly.
* The packaged installer should show localtify properly.
* If Windows caches an old icon or name, unpin the old shortcut and pin the newly installed app again.
* Some Windows SmartScreen warnings can happen because the app is not code signed yet.

---

## License

MIT License
