# Localtify Phase 1 — Foundation Reset

Phase 1 stabilizes the current application before feature extraction. It is intentionally a no-redesign phase: behavior, data compatibility, IPC channel names, and the visible product should remain unchanged unless a bug fix explicitly requires otherwise.

## Non-negotiable compatibility contracts

The following names are compatibility surfaces and must not be renamed during the retransform:

- `window.localitfy`
- existing `localitfy:*` IPC channel names
- Electron app id `com.meshahid973.localitfy`
- the existing Localtify user-data/database location

Any migration of these surfaces requires a backward-compatible adapter and its own reviewed change.

## Dependency direction

New or extracted code must move toward this direction:

```text
app / feature views
        ↓
feature domain modules
        ↓
shared + core modules
        ↓
platform/electron bridge
```

Shared/core/type/utility modules must not import from or re-export definitions from `LocaltifyAppView.tsx` or `App.tsx`.

The current `localtifyConstants.ts`, `localtifyUtils.ts`, and type facades are grandfathered legacy seams. Phase 1 stops adding new dependencies to that pattern; Phase 2 will move ownership out of the view monolith.

## TypeScript policy

- Do not remove `// @ts-nocheck` from a giant legacy file in one shot.
- New modules must be type checked.
- Extracted modules must not add a new `// @ts-nocheck` unless the change documents why.
- `npm run typecheck` is the renderer/node TypeScript baseline.
- Existing type debt should be paid down incrementally as code is extracted.

## CSS ownership

Legacy CSS stays live during Phase 1 to avoid visual regressions, but ownership is frozen:

| File | Owner |
| --- | --- |
| `src/styles/tokens.css` | shared design tokens only |
| `src/app-core.css` | app shell, title bar, base layout |
| `src/themes.css` | theme variable/token mappings |
| `src/motion.css` | shared motion/keyframes |
| `src/player.css` | player UI |
| `src/settings.css` | settings UI |
| `src/home.css` | temporary legacy home/library/albums/playlists bucket |
| `src/effects.css` | small cross-feature visual effects only |
| `src/App.css` | frozen legacy compatibility stylesheet |

Rules for new CSS:

1. Do not append new feature fixes to `App.css`.
2. Prefer a feature stylesheet under `src/features/<feature>/` for newly extracted UI.
3. Scope feature selectors under a feature root instead of adding generic selectors such as `.panel`, `.search`, or `.button` globally.
4. Shared reusable visuals belong to shared UI primitives, not a feature stylesheet.
5. Do not bulk-delete `!important`; remove it only when the competing ownership has been resolved.
6. Themes should increasingly change tokens instead of reaching into feature DOM internals.

## Electron bridge ownership

`src/platform/electron/` is the renderer-side boundary for new Electron bridge access. Existing direct `window.localitfy` usage is grandfathered and will be migrated incrementally.

The bridge surface exposed by `electron/preload.cjs` and the renderer declarations in `src/localitfy.d.ts` must be kept in sync. A mismatch is treated as a runtime bug even if a legacy `@ts-nocheck` file hides it.

## Build hygiene

A normal `npm run build` must be read-only with respect to tracked source assets. Asset compression remains an explicit maintenance command (`npm run assets:compress`) instead of an automatic `prebuild` hook.

## Phase 1 review checklist

Before merging a Phase 1 change:

- renderer build completes
- TypeScript baseline is checked
- no intentional UI redesign is mixed in
- player playback still works
- library import/open still works
- albums/playlists still open
- downloads screen still opens
- settings still open and persist after restart
- onboarding still renders for a fresh profile
- updater/Discord/native-media compatibility names are unchanged
- no new global CSS patch was added to an unrelated owner file

## Phase 1 exit criteria

Phase 1 is complete when:

- build/validation commands are repeatable in CI
- normal builds do not mutate tracked source assets
- new code has an enforced ownership direction
- Electron renderer access has a single migration boundary
- CSS ownership is documented and new legacy patch accumulation has stopped
- dead/duplicate legacy artifacts have been verified before removal
- the current UI and user data remain compatible
