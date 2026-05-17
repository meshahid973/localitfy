<div align="center">

<img src="build/icon.ico" alt="localtify logo" height="120" />

# localtify

**your local music, but prettier.**

A clean Windows music player for people who still keep their songs on their PC.

No account. No subscription. Your music stays local.

</div>

---

## About

localtify is a desktop music player made for local music libraries.

It gives your own songs a modern app experience with a dark interface, smooth animations, playlists, covers, stats, Discord Rich Presence, Windows media controls, and a tray menu.

The goal is simple: make local music feel nice again.

---

## Features

- Local music library
- Clean dark UI
- Smooth animations and ambience
- Bottom player with progress and volume controls
- Playlists with covers, song count, and total duration
- Liked songs
- Search
- Pixel-art cover system
- Cover tools
- Listening stats
- Discord Rich Presence
- Windows media key support
- Windows tray controls
- Optional startup with Windows
- Auto-update support

---

## Install

Download the latest installer from the **Releases** page.

For Windows, download:

```txt
localtify-setup-0.2.9.exe
```

Install it, open localtify, then import your songs.

---

## Run from source

You need:

- Node.js
- npm
- Git
- Windows, for the full desktop features

Clone the repo:

```bash
git clone https://github.com/meshahid973/localitfy.git
cd localitfy
```

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
copy .env.example .env
```

You can leave the values empty for normal development.

Start the app:

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

The installer will be created in the `release` folder.

---

## Project structure

```txt
src/          React app and UI
electron/     Electron main process, preload, database, updater, Discord, Windows integration
pixelart/     bundled pixel-art cover images
public/       public static files
build/        app icon and build resources
```

The app is built with:

- Electron
- React
- TypeScript
- Vite
- SQLite / better-sqlite3
- electron-builder
- Discord RPC

---

## Important note about naming

The visible app name is:

```txt
localtify
```

Some internal names still use the old spelling:

```txt
localitfy
```

This is intentional for compatibility with older installs.

Please do not rename these unless you are doing a proper migration:

```txt
window.localitfy
localitfy:* IPC channels
com.meshahid973.localitfy
```

Changing them randomly can break saved data, preload APIs, app updates, or older user installs.

---

## CSS file ownership

localtify has a lot of CSS, so try to edit the correct file.

```txt
app-core.css      app shell, sidebar, titlebar, layout, update popup
App.css           older shared app-level styles
home.css          home page, library, song cards, shelves, playlist UI
player.css        bottom player, progress bar, volume, player controls
settings.css      settings page and settings cards
themes.css        theme variables and theme mappings
motion.css        animations and transitions
effects.css       ambience and decorative effects
mini-player.css   detached mini-player window
```

Simple rule:

```txt
player bug      -> player.css
settings bug    -> settings.css
home card bug   -> home.css
theme change    -> themes.css
animation bug   -> motion.css
mini-player bug -> mini-player.css
```

Please avoid dumping random fixes at the bottom of unrelated files.

---

## Contributing

Pull requests are welcome.

You can help with:

- bug fixes
- UI polish
- playlist improvements
- player improvements
- settings cleanup
- Windows integration
- performance improvements
- accessibility
- code cleanup
- better empty states

### How to contribute

Fork the repo.

Clone your fork:

```bash
git clone https://github.com/YOUR_USERNAME/localitfy.git
cd localitfy
```

Install dependencies:

```bash
npm install
```

Create a new branch:

```bash
git checkout -b fix/your-change-name
```

Run the app:

```bash
npm run dev
```

Before opening a pull request, make sure the app builds:

```bash
npm run build
```

Commit your changes:

```bash
git add .
git commit -m "fix: describe your change"
```

Push your branch:

```bash
git push origin fix/your-change-name
```

Then open a pull request on GitHub.

### Pull request checklist

When opening a pull request, please include:

- what you changed
- why you changed it
- screenshots if the UI changed
- how you tested it
- whether it affects the database, settings, playlists, updater, or app data path

If your change touches the database, app data path, updater, or preload API, please explain it clearly.

---

## Privacy

localtify is local-first.

Your songs stay on your PC.  
You do not need an account.  
Discord activity is optional and can be turned off in settings.

Do not commit private files like:

```txt
.env
local databases
logs
release builds
node_modules
dist
downloaded music
private analytics exports
```

Use `.env.example` for public environment examples.

---

## Common commands

Start development mode:

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

Publish with electron-builder:

```bash
npm run publish
```

---

## Notes

- Dev mode may still show Electron in some Windows places because it runs through Electron directly.
- The packaged installer should show localtify properly.
- If Windows keeps an old icon or name, unpin the old shortcut and pin the newly installed app again.
- Windows SmartScreen warnings may appear because the app is not code-signed yet.

---

## License

MIT License

---

## Credits

Made by [@meshahid973](https://github.com/meshahid973)

Contributors:

- @todouro
- @yudafao