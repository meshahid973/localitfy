# localtify

> your local music, but prettier.

localtify is a Windows desktop music player for people who still keep songs on their PC.

It gives your local library a clean dark interface, smooth animations, ambient cover glow, playlists, themes, listening stats, Discord Rich Presence, Windows media controls, and a more polished local music experience without needing an account or subscription.

No account.  
No subscription.  
Your songs stay on your PC.

![localtify screenshot](screenshots/localtify-home.png)

---

## What is localtify?

localtify is a Spotify-inspired music player, but for your own local files.

You import the songs you already have on your computer, and localtify turns them into a proper music library with covers, playlists, stats, smooth animations, a bottom player, and Windows desktop integration.

It is built for people who want their local music to feel modern again.

---

## Features

- play your own local songs
- import music into your library
- clean OLED-style dark interface
- smooth animations and ambient visuals
- bottom player with progress, volume, shuffle, repeat, next, and previous controls
- playlists with covers, song count, and total duration
- rename and duplicate playlists
- add songs to playlists
- pixel-art cover system
- cover studio tools
- listening stats
- liked songs
- search
- Discord Rich Presence
- Windows media key support
- Windows tray menu controls
- optional startup with Windows
- update popup and auto-update support
- no account needed
- local-first design

---

## Screenshots

![home](screenshots/localtify-home.png)

More screenshots can be added later:

```txt
screenshots/home.png
screenshots/settings.png
screenshots/covers.png
screenshots/playlists.png
```

---

## Download

The easiest way to use localtify is to download the latest Windows installer from the Releases page.

Download the latest installer:

```txt
localtify-setup-0.2.9.exe
```

Then install it, open localtify, and import your songs.

---

## Run from source

You need:

- Node.js
- npm
- Git
- Windows is recommended for the full desktop features

Clone the repo:

```bash
git clone https://github.com/meshahid973/localitfy.git
cd localitfy
```

Install dependencies:

```bash
npm install
```

Create your local environment file:

```bash
copy .env.example .env
```

You can leave the values empty for normal local development.

Run localtify in development mode:

```bash
npm run dev
```

Build the frontend:

```bash
npm run build
```

Build the Windows installer:

```bash
npm run dist
```

The installer will be created inside the `release` folder.

---

## Project structure

```txt
src/          React app and UI
electron/     Electron main process, database, preload, updater, Discord, Windows features
pixelart/     bundled pixel-art cover images
public/       public static files
build/        app icons and build resources
analytics/    local dev helper data; private exports should not be committed
```

---

## Development notes

localtify uses:

- Electron
- React
- TypeScript
- Vite
- SQLite with better-sqlite3
- Discord RPC
- electron-builder

Some internal names still use `localitfy` because that was the original project and repo name.  
The visible app name is `localtify`.

Please do not rename internal bridge names, IPC names, app IDs, or app data paths unless you are doing a proper migration.

Important internal names include:

```txt
window.localitfy
localitfy:* IPC channels
com.meshahid973.localitfy
```

These names are kept for compatibility with older installs.

---

## CSS ownership

The app has a lot of CSS, so please keep styling in the correct file.

```txt
app-core.css      app shell, titlebar, sidebar, layout, update popup
App.css           older shared styles and remaining app-level styles
home.css          home page, library, song cards, shelves, playlist UI
player.css        bottom player, progress bar, volume, controls
settings.css      settings page and settings cards
themes.css        theme variables and theme mappings
motion.css        animations and transitions only
effects.css       decorative effects and ambience
mini-player.css   detached mini-player window only
```

Please avoid random fixes at the bottom of unrelated CSS files.

Use this rule:

```txt
player issue   -> player.css
settings issue -> settings.css
home card bug  -> home.css
theme variable -> themes.css
animation      -> motion.css
mini-player    -> mini-player.css
```

---

## Contributing

Pull requests are welcome.

Good things to work on:

- UI polish
- playlist improvements
- player improvements
- performance fixes
- Windows integration
- bug fixes
- accessibility improvements
- cleaner settings pages
- better empty states
- safer update flow
- code cleanup

Before opening a pull request, run:

```bash
npm install
npm run build
```

When making a pull request, please include:

- what changed
- why it changed
- screenshots if the UI changed
- how you tested it
- whether it affects the database, settings, updater, playlists, or app data path

---

## Privacy

localtify is built around local music.

Your songs stay on your PC.  
You do not need an account.  
Discord activity is optional and can be turned off in settings.

Do not commit private files such as:

```txt
.env
local databases
logs
release builds
node_modules
dist
user data
downloaded music
private analytics exports
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
analytics/*.json
```

Use `.env.example` for public environment examples.

---

## Common commands

Run dev mode:

```bash
npm run dev
```

Build frontend:

```bash
npm run build
```

Build Windows installer:

```bash
npm run dist
```

Publish release build:

```bash
npm run publish
```

---

## How to publish changes

This is the normal flow for pushing source code changes to GitHub.

Check what changed:

```bash
git status
```

Add the files you want to publish:

```bash
git add README.md src electron package.json package-lock.json .gitignore .env.example public pixelart build
```

Commit the changes:

```bash
git commit -m "chore: update localtify source"
```

Push to GitHub:

```bash
git push
```

For the first push from a new local folder, use:

```bash
git push -u origin main
```

---

## How to publish a new app release

Use this when releasing a new version like `0.2.9`.

Make sure the version is correct in `package.json` and inside the app.

Build the app:

```bash
npm run build
```

Build the Windows installer:

```bash
npm run dist
```

The release files will be inside:

```txt
release/
```

For GitHub Releases, upload the installer and update files from the `release` folder.

Usually you need:

```txt
localtify-setup-0.2.9.exe
latest.yml
```

If you use the publish script:

```bash
npm run publish
```

Make sure the GitHub release looks correct after publishing.

---

## Release checklist

Before publishing a release, check:

- the app opens
- songs still load
- playlists still load
- importing songs works
- update popup looks correct
- tray menu works
- media keys work
- startup option works
- app name says localtify
- icon looks correct
- `npm run build` passes
- installer builds successfully
- `.env`, `node_modules`, `dist`, and `release` are not committed

---

## Known notes

- Dev mode may show Electron in some Windows places because it runs through Electron directly.
- The packaged installer should show localtify properly.
- If Windows caches the old icon or name, unpin the old shortcut and pin the newly installed app again.
- Some Windows SmartScreen warnings can happen because the app is not code-signed yet.

---

## License

MIT License

---

## Credits

Made by [@meshahid973](https://github.com/meshahid973)

Contributors:

- @todouro
- @yudafao