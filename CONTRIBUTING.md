# Contributing to localtify

<p align="center">
  <strong>Thanks for wanting to help localtify.</strong>
</p>

<p align="center">
  A local music player built for people who want their own music library to feel clean, fast, and personal.
</p>

<p align="center">
  <img alt="Beginner friendly" src="https://img.shields.io/badge/beginner-friendly-8dffce?style=for-the-badge&labelColor=050505">
  <img alt="Built with Electron" src="https://img.shields.io/badge/electron-react-68d8ff?style=for-the-badge&labelColor=050505">
  <img alt="Local first" src="https://img.shields.io/badge/local-first-ffffff?style=for-the-badge&labelColor=050505">
</p>

---

## Welcome

localtify is still growing, so every helpful contribution matters.

You do not need to be a perfect developer to help. Small fixes, bug reports, UI polish, better wording, screenshots, and documentation improvements are all useful.

The main goal is simple: make a clear change, test it locally, and explain what you did.

---

## What localtify uses

| Area        | Tech             |
| ----------- | ---------------- |
| Desktop app | Electron         |
| UI          | React            |
| Language    | TypeScript       |
| Build tool  | Vite             |
| Local data  | SQLite           |
| Styling     | CSS              |
| Updates     | electron-builder |

The public app name is `localtify`. Some internal names still use the older spelling `localitfy` for compatibility.

Important compatibility names:

```txt
window.localitfy
localitfy:* IPC channels
com.meshahid973.localitfy
```

Do not rename those without a proper migration. Existing installs, saved settings, user data, updates, and the preload bridge depend on them.

---

## Quick start

### 1. Clone your fork

```bash
git clone https://github.com/meshahid973/localitfy.git
cd localitfy
```

### 2. Install dependencies

For a clean checkout, prefer the lockfile-exact install:

```bash
npm ci
```

Use `npm install` only when you intentionally need to update dependency metadata.

### 3. Create your local environment file

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS or Linux:

```bash
cp .env.example .env
```

For normal development, most optional values may stay empty.

### 4. Start the app

```bash
npm run dev
```

### 5. Run the complete local gate before opening a pull request

```bash
npm run release:check
```

`release:check` is the canonical local validation gate. It covers the repository checks, tests, TypeScript/build validation, database recovery, hardening checks, CSS ownership/dedup checks, and performance budgets that are available for the current platform.

---

## Making a change

Create a new branch before editing files.

```bash
git checkout -b fix/your-change-name
```

Good branch names:

```txt
fix/player-alignment
fix/settings-spacing
fix/download-card-layout
feature/album-cover-picker
docs/update-readme
refactor/player-css
```

Keep changes focused when possible. For larger architecture repairs, preserve behavior first and split ownership along existing feature boundaries rather than creating compatibility copies.

---

## CSS ownership

Static "unused selector" analysis is advisory only. Localtify creates classes dynamically at runtime, so do not mass-delete selectors just because a static scanner cannot see them.

Move styles to the feature that owns the UI and preserve cascade/import order while doing so.

| File / area | Primary ownership |
| --- | --- |
| `src/features/shell/app-core.css` | shell, sidebar, titlebar, shared frame layout |
| `src/App.css` | legacy/shared app-level rules not yet migrated |
| `src/features/home/home.css` | Home only |
| `src/features/player/player.css` | player controls and player surfaces |
| `src/features/settings/settings.css` | Settings UI |
| `src/features/settings/themes.css` | theme variables/mappings |
| `src/features/shell/motion.css` | shared motion policy |
| `src/features/shell/effects.css` | shared visual effects |
| `src/features/onboarding/onboarding.css` | onboarding |

Library, Albums, Playlists, Covers, Downloads, and other feature UI should move toward their own feature-owned styles rather than accumulating new rules in `App.css` or `home.css`.

Run the CSS checks after ownership changes:

```bash
npm run css:dedup:check
npm run boundaries:check
npm run performance:check
```

---

## Database and user data

Be careful with anything that touches user data.

Important areas include:

```txt
electron/db.cjs
electron/db/
playlist saving
settings saving
song metadata
app data path
migrations
backups
```

Users should not lose their library, playlists, covers, or settings after an update. If a change touches the database, explain what changed, why it changed, whether a migration is required, and how old data was tested.

Do not rename the app-data folder or database paths without a migration.

---

## Electron and preload changes

Keep privileged work behind the preload bridge and centralized trusted IPC router. Do not add ad-hoc `ipcMain.handle` ownership in unrelated modules.

When changing Electron runtime code, preserve these invariants:

```txt
nodeIntegration: false
contextIsolation: true
sandbox: true
webSecurity: true
webviewTag: false
renderer navigation restricted to Localtify-owned origins
browser permissions denied by default
privileged IPC restricted to the active Localtify main frame
```

Do not silently add browser-cookie extraction or persist browser cookies for download features.

---

## Pull request checklist

Before opening a pull request:

* `npm run release:check` passes locally
* `npm run dev` starts the app for runtime/UI changes
* no private/generated files are committed
* UI changes include screenshots when useful
* database/settings/updater/preload/IPC/app-data changes are called out clearly
* dynamic CSS was not deleted solely because a static selector scan said it was unused
* compatibility names and user-data paths were preserved

Use this format:

```txt
What changed:
Why it changed:
How I tested it:
Screenshots:
Anything risky:
```

---

## Files you should not commit

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
downloaded music
private analytics exports
```

Use `.env.example` for public example values.

---

## Things to avoid

Please avoid:

* renaming `localitfy` compatibility APIs without a migration
* changing IPC names randomly
* bypassing the trusted IPC router
* removing features as part of an unrelated refactor
* creating duplicate compatibility owners instead of moving ownership
* adding expensive always-on renderer work
* destructive static CSS pruning
* committing private keys, tokens, logs, databases, downloaded media, or generated releases

---

## Testing tips

For UI changes, check Home, Library, Albums, Playlists, Covers, Downloads, Settings, the bottom player, and sidebar states.

For playback changes, test Play, Pause, Next, Previous, Shuffle, Repeat, Queue, Volume, background/focus recovery, and media keys where supported.

For import/download changes, start with a small file or small batch, then check the resulting database/library rows and cover metadata.

For Electron changes, also run:

```bash
npm run hardening:check
npm run bridge:check
npm run db:recovery-test
```

---

## Reporting bugs

A useful bug report includes what you expected, what happened, steps to reproduce, screenshots or recordings, terminal errors, operating system, and localtify version.

Thanks for helping localtify improve.
