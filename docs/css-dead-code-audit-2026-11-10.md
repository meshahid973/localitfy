# CSS and dead-code cleanup audit — 2026-11-10

This is a focused, evidence-backed follow-up to [the structural refactoring decision log](./refactoring-decision-log-2026-11-10.md). It is not a claim that every possible dynamic selector or external runtime reference can be inferred statically.

## Verified removals

1. **Overlapping global CSS blocks** — `src/App.css` contained two immediately repeated sets of declarations: `.editorModal, .deleteModal, .whatsNewCard` duplicated the later `.hero, .editorModal, .deleteModal, .whatsNewCard` declaration; `.songRow` duplicated the later `.hero, .songRow` transition declaration. Earlier blocks contributed no additional properties. Keep the later superset selectors and remove only the earlier duplicates. No responsive/media/importance or specificity change.
2. **Unused queue-preview calculation stub** — `src/App.tsx` had `const queuePreviewSongs = useMemo(() => [] as Song[], [])` followed by `void queuePreviewSongs;`. It had no consumers, always yielded an empty array, and cost a React hook. Remove the hook and its now-obsolete comment; queue panel's actual entries are unaffected.

## Improved dependency/type boundary

3. **Downloads view prop types** — `src/features/downloads/DownloadsView.tsx` exposed 43 `any` fields plus an `item: any` mapping annotation. Specify callback signatures, React dispatch setters, `Settings`, `DownloadsTab`, `SpotifyTrack`, and queue/result data types. This is TypeScript-only, does not alter JSX, runtime behavior, persistence, or IPC. Existing `AppShellProps` imports the view contract automatically.

## CSS duplication audit methodology

- The repository already runs deterministic `css:dedup:check`, `css:cross-file`, `css:unused`, `css:cascade` (via `release:check`). This includes duplicate declaration removal checks, cascade-shadow checks and cross-file import-order checks.
- Examined the eight largest renderer CSS files, including App, player, shell, effects, themes, premium settings, onboarding, and home. Found **166 keyframes without duplicate names** in that set.
- Apparent same-selector repeats in different `@media` blocks are **not** necessarily redundant. Preserve the responsive overrides in Settings/Onboarding and the update banner's media-specific rules.
- The app's prior CI unused-code audit found zero unreachable source modules and zero CSS class candidates, but this is advisory for dynamic class names. No broad selector/file pruning was justified.

## Remaining intentionally deferred work

- The ~9k-line `src/App.tsx` is still large and orchestrates media-critical state; do not bulk-extract playback effects without isolated regression coverage.
- The `showStarBackdrop = false` and empty `starParticleStyles` pathways are dormant but entangled with hidden star-theme CSS and user-facing secret-mode behavior. Do not delete these from scattered CSS files in this PR without mapping all theme modes and indirect dependencies.
- Manual UI QA needs an attached desktop machine. Green Electron startup smoke tests cannot prove responsive visuals in every theme.

## Quality gates

Require Linux `npm run release:check`, Windows `npm run check` including Electron runtime smoke, Discord Activity, CodeQL, and review results before merging.
