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

The main goal is simple.

Make a clear change, test it, and explain what you did.

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

The public app name is:

```txt
localtify
```

Some internal names still use the older spelling:

```txt
localitfy
```

That spelling is kept for compatibility. Please do not rename it unless there is a proper migration plan.

Important internal names:

```txt
window.localitfy
localitfy:* IPC channels
com.meshahid973.localitfy
```

Changing these randomly can break existing installs, saved settings, app data, updates, or the preload bridge.

---

## Quick start

### 1. Fork the repo

Click **Fork** on GitHub.

### 2. Clone your fork

```bash
git clone https://github.com/meshahid973/localitfy.git
cd localitfy
```

### 3. Install dependencies

```bash
npm install
```

### 4. Create your local environment file

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

On macOS or Linux:

```bash
cp .env.example .env
```

For normal development, you can leave most values empty.

### 5. Start the app

```bash
npm run dev
```

### 6. Build before opening a pull request

```bash
npm run build
```

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

Try to keep your pull request focused on one thing. A small clean change is much easier to review than one huge pull request that edits the whole app.

---

## Good first contributions

If you are new, these are good places to start.

<table>
  <tr>
    <td><strong>UI fixes</strong></td>
    <td>Fix spacing, alignment, button states, hover states, or empty screens.</td>
  </tr>
  <tr>
    <td><strong>Docs</strong></td>
    <td>Improve README text, setup steps, screenshots, or wording.</td>
  </tr>
  <tr>
    <td><strong>Bug reports</strong></td>
    <td>Report crashes, broken layouts, confusing behavior, or missing details.</td>
  </tr>
  <tr>
    <td><strong>Accessibility</strong></td>
    <td>Improve labels, focus states, keyboard support, or contrast.</td>
  </tr>
  <tr>
    <td><strong>CSS cleanup</strong></td>
    <td>Move styles to the right file and remove old patchy rules.</td>
  </tr>
</table>

---

## CSS guide

localtify has many CSS files. Please edit the file that owns the thing you are fixing.

| File              | What it owns                                         |
| ----------------- | ---------------------------------------------------- |
| `app-core.css`    | App shell, sidebar, titlebar, layout, update popup   |
| `App.css`         | Older shared app level styles                        |
| `home.css`        | Home page, library, albums, playlists, song cards    |
| `player.css`      | Bottom player, progress bar, volume, player controls |
| `settings.css`    | Settings page and settings cards                     |
| `themes.css`      | Theme variables and theme mappings                   |
| `motion.css`      | Animations and transitions                           |
| `effects.css`     | Small visual effects and decorative effects          |
| `mini-player.css` | Detached mini-player window                          |

Simple rule:

| If you are fixing | Edit this first   |
| ----------------- | ----------------- |
| Player issue      | `player.css`      |
| Settings issue    | `settings.css`    |
| Home page issue   | `home.css`        |
| Album page issue  | `home.css`        |
| Theme issue       | `themes.css`      |
| Animation issue   | `motion.css`      |
| Mini-player issue | `mini-player.css` |

Please do not add random fixes at the bottom of unrelated CSS files. It makes future bugs harder to fix.

---

## Database and user data

Be careful with anything that touches user data.

Important areas:

```txt
electron/db.cjs
playlist saving
settings saving
song metadata
app data path
migrations
backups
```

Users should not lose their library, playlists, covers, or settings after an update.

If your change touches the database, explain:

```txt
What changed
Why it changed
Whether it needs a migration
How you tested old user data
```

Do not change the app data folder name unless it is part of a proper migration.

---

## Pull request checklist

Before opening a pull request, please check this:

* `npm run dev` starts the app
* `npm run build` works
* no private files are committed
* UI changes include screenshots if possible
* database changes are explained clearly
* settings changes are explained clearly
* updater, preload, IPC, and app data changes are mentioned clearly

Use this format in your pull request:

```txt
What changed:
Why it changed:
How I tested it:
Screenshots:
Anything risky:
```

If you are new, do not worry about writing a perfect pull request. Just explain your change in normal words.

---

## Files you should not commit

Do not commit private files, generated files, or local user data.

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

* renaming `localitfy` internal APIs without discussion
* changing IPC names randomly
* removing features without asking
* rewriting huge parts of the app in one pull request
* mixing unrelated fixes together
* adding heavy animations that make the app lag
* committing private keys, tokens, logs, or local database files

---

## Testing tips

When testing UI changes, check these pages:

```txt
Home
Library
Albums
Downloads
Settings
Bottom player
Sidebar collapsed
Sidebar expanded
```

If your change affects playback, test:

```txt
Play
Pause
Next
Previous
Shuffle
Repeat
Queue
Volume
```

If your change affects imports or downloads, test with a small file first.

---

## Reporting bugs

A good bug report includes:

```txt
What you expected to happen
What actually happened
Steps to reproduce it
Screenshots or screen recordings
Error messages from the terminal
Your operating system
Your localtify version
```

Screenshots help a lot. Terminal logs also help a lot.

---

## Need help?

Open an issue if you are stuck or unsure.

You can also open a pull request even if your change is not perfect yet. Just say what you need help with.

Thanks for helping localtify improve.

