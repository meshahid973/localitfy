# Contributing to localtify

Thanks for helping improve the desktop music player. Keep pull requests focused and preserve existing libraries, settings, playback behavior, and update compatibility.

## Setup and validation

~~~bash
git clone https://github.com/meshahid973/localitfy.git
cd localitfy
npm ci
npm run dev
~~~

Before submitting a change, run:

~~~bash
npm run release:check
~~~

For Electron-specific changes, also check `npm run bridge:check` and `npm run db:recovery-test`. Native changes require `npm run rust:build`, `npm run rust:test`, and Windows/Linux/macOS CI.

## Boundaries

- Keep feature-specific state, UI, and CSS under `src/features/`; shared primitives belong in `src/shared/`.
- Keep privileged operations in `electron/`, behind the trusted preload/IPC router. Do not weaken sandboxing, navigation restrictions, or context isolation.
- Preserve `window.localitfy`, `localitfy:*` IPC names, `com.meshahid973.localitfy`, and the existing user-data location unless a backward-compatible migration is tested.
- Preserve database backups, playlists, audio files, and recovery paths. Never use a real user library as a destructive test fixture.
- CSS may use dynamic classes. Do not delete selectors or modules solely because a static scan cannot find imports; confirm actual runtime usage and run the ownership audits.
- Native code must be opt-in with a JavaScript fallback and measured benefit. Keep numerical and data-policy behavior equivalent.

## Pull request checklist

- Explain the issue, the change, and any compatibility or security impact.
- Include test commands/results and screenshots for visible UI changes.
- Verify keyboard navigation, themes, reduced motion, and Windows/Linux desktop behavior where relevant.
- Keep commits free of `.env`, credentials, private media, databases, backups, `node_modules/`, `dist/`, and generated installers.

Report security vulnerabilities privately according to [SECURITY.md](SECURITY.md). See the [native release checklist](docs/architecture/native-kernels.md) for packaging and manual QA.
