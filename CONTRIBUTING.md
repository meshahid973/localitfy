# Contributing to localtify

Thanks for wanting to help with localtify.

localtify is still growing, so small fixes, UI polish, cleanup, and bug reports are all useful. You do not need to be a perfect developer to contribute. Just try to keep changes clear, tested, and easy to review.

---

## Before you start

Please keep these things in mind:

- localtify is a Windows desktop app built with Electron, React, TypeScript, Vite, and SQLite.
- The visible app name is `localtify`.
- Some internal names still use the old spelling `localitfy` for compatibility.
- Do not rename internal IPC names, preload APIs, app IDs, or app data paths unless the change is a planned migration.

Important internal names:

```txt
window.localitfy
localitfy:* IPC channels
com.meshahid973.localitfy
```

Changing these randomly can break old installs, saved data, settings, updates, or the preload bridge.

---

## How to set up the project

Fork the repo, then clone your fork:

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

Build the app to make sure your changes do not break anything:

```bash
npm run build
```

---

## Making changes

Create a new branch before editing:

```bash
git checkout -b fix/your-change-name
```

Good branch names:

```txt
fix/player-alignment
fix/settings-spacing
feature/playlist-cover
docs/update-readme
refactor/player-css
```

Try to keep your change focused. A small clean pull request is easier to review than a huge one that changes everything.

---

## CSS ownership

localtify has a lot of CSS, so please edit the correct file.

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

Please avoid dumping random fixes at the bottom of unrelated CSS files.

---

## Database and data safety

Be extra careful with anything that touches:

```txt
electron/db.cjs
playlist saving
settings saving
app data path
migrations
backups
```

Do not change the app data folder name unless it is part of a proper migration. Users should not lose their library, playlists, covers, or settings after an update.

If your pull request changes the database, explain:

- what changed
- why it changed
- whether it needs a migration
- how you tested old user data

---

## Pull request checklist

Before opening a pull request, please check:

- the app starts with `npm run dev`
- the app builds with `npm run build`
- no private files are committed
- UI changes include screenshots if possible
- database/settings/updater changes are explained clearly

When opening a pull request, include:

- what you changed
- why you changed it
- how you tested it
- screenshots if the UI changed
- whether it affects database, settings, playlists, updater, preload, or app data path

---

## Files you should not commit

Do not commit private or generated files:

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

Use `.env.example` for public environment examples.

---

## Good first contributions

Good areas to help with:

- fixing small UI bugs
- improving settings layout
- polishing the bottom player
- improving empty states
- improving playlist UI
- fixing typos
- cleaning CSS ownership problems
- improving documentation
- adding screenshots to docs
- accessibility improvements

---

## Code style

There is no giant rulebook right now. Just keep things simple:

- use clear names
- avoid huge unrelated rewrites
- avoid breaking existing IPC names
- avoid removing features without discussion
- keep UI changes consistent with the localtify style
- test before opening a pull request

---

## Need help?

Open an issue or pull request with as much detail as you can.

Screenshots, error messages, and steps to reproduce make bugs much easier to fix.
