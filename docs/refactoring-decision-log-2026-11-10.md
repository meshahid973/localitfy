# Localtify structural refactoring decision log

**Base:** `main` at `80e5df9d915a9af1db7f8617760dd011f841e94e` (2026-11-10)  
**Scope:** source organization and dependency direction only; no UI redesign, player/database/IPC changes, or speculative removal.  
**Other active work:** PR #129 owns context menus and Spotify Downloads UI; PR #127 owns Android support. This PR deliberately avoids both areas.

## Architecture and constraints

- Electron main/preload and native SQLite/media/OS services live in `electron/`. React/Vite renderer lives in `src/`.
- `src/App.tsx` is the orchestration root; `src/features/*` has controllers and views; `src/shared/*` and `src/styles/*` own reusable primitives and tokens.
- The `src/features/settings/index.ts` barrel provides a stable public import path; `src/features/downloads/useDownloadsRuntime.ts` is the runtime state hook.
- Existing quality gates: `npm run release:check` (bridge and boundary checks, CSS audits, tests, TS build, database recovery, performance benchmarks and budgets), Windows Electron smoke, CodeQL.
- History supports preserving ownership boundaries: major Phase 2 foundation split (2026-08-19), subsequent cleanup (#40), and downloads hot-path optimization (2026-10-20). Preserve Spotify-ID > absolute-file-path > filename-suffix matching precedence and first-match semantics.

## Confirmed problems and decisions (recorded before code changes)

### D1 — Pure download matching depends on a React hook implementation

**Evidence:** `src/features/downloads/useDownloadsRuntime.ts:14-151` exports `parseDownloadUrls`, `makeQueuedDownloads`, error/Spotify message formatting, index creation, matching, and enrichment before the hook begins at line 152. `src/App.tsx:49-58` imports those helpers and `useDownloadsRuntime` from one module. `scripts/benchmark-download-matches.mjs:6-16` and `tests/phase4/download-match-hotpath.test.mjs:7-19` transpile the *entire hook file* and inject a fake React module just to execute pure functions.

**Cause:** unrelated stateful orchestration and deterministic domain calculations share a module; tests and build tools must depend on volatile React machinery.

**Decision:** move the unchanged deterministic helpers and lookup type to `src/features/downloads/downloadProcessing.ts` next to their owning feature; import the helper module from the hook and `App`. Update existing benchmark and tests to execute the pure module directly, preserving regression assertions. Do not introduce a wrapper/re-export layer.

**Expected benefit:** one cohesive place for download processing changes, benchmarks independent of React, clearer dependency direction from hook to pure domain functions.

**Risk/validation:** accidental export or algorithm changes, case-insensitive lookup precedence, failure text changes, queuing ID format. Preserve function bodies verbatim; run all download tests, benchmark, typecheck and Windows smoke.

### D2 — Preset CSS tokens unnecessarily depend on persisted theme management

**Evidence:** `src/features/settings/customTheme.ts:1-13` defines `THEME_PRESET_COLORS`, `ThemeVisualPalette`, and `makeThemePresetStyle`, while `src/features/settings/customTheme.ts:14-27` handles color patches, built-in saved presets, local-storage reads/writes and random colors. `src/App.tsx:960-972` needs only the pure token builder. `src/features/settings/useSettingsController.ts` needs the storage helpers. All of this is exported via `src/features/settings/index.ts`.

**Cause:** palette/token composition and persistence are independent responsibilities. Highly compressed 11.5-KB / 27-line source also makes semantic review unusually difficult.

**Decision:** move the existing palette data and CSS-token builder to `src/features/settings/themePresetStyle.ts`. Keep public names exported by the existing settings barrel so `App` consumers are unchanged. Leave storage and custom-preset CRUD in `customTheme.ts`. Format the extracted tokens and remaining data for easier review without changing values.

**Expected benefit:** pure preset rendering can be reasoned about without local storage; less coupling and better maintainability.

**Risk/validation:** color/RGB/token regressions and barrel-export breaks. Compare every existing palette and style output with regression tests, then run TS, build, CSS and UI contracts.

### D3 — Large orchestration root and untyped downloads view (deferred from this isolated change)

**Evidence:** `src/App.tsx` is 8,958 lines; `src/features/downloads/DownloadsView.tsx:5-48` declares its entire view-prop contract with `any`; `src/features/shell/appShell.contract.ts` then imports that contract for the renderer shell.

**Cause:** orchestration and UI contracts are too broad. These need a separately planned change with full caller/type-shape and runtime coverage.

**Decision:** leave them unchanged in this first tightly scoped dependency refactor; do not turn an architectural pass into a rewrite or claim all coupling is fixed. Suggested next PR: add typed downloads view boundaries based on domain types and split independent orchestration handlers only after measuring consumers.

**Regression risk:** changing 40+ prop contracts and a media-critical app root in the same PR makes failures hard to isolate.

### D4 — Dead CSS / unreachable source audit (no destructive action)

**Evidence:** existing `scripts/audit-unused.mjs` and `scripts/css-unused-selectors.mjs` are already executed by `npm run release:check`; the preceding green run reported zero unused CSS class candidates and zero unreachable source modules, across 42 CSS files and 273 scanned source files.

**Decision:** do not delete CSS/modules without a dynamic-class, runtime-entrypoint and indirect-consumer proof. Keep existing ownership and CSS consistency tests.

**Risk:** removing dynamically selected classes or modules could silently break themes, animations and Electron runtime registration.

## Optional cleanup deliberately excluded

Comments that only repeat code and tests judged redundant are optional in the supplied refactoring brief. Neither was separately requested for pruning, so this PR preserves existing comments and tests other than updates necessary for moving live source contracts.

## Verification and repeat-audit checklist

1. Verify extracted exports and source imports, no circular modules or duplicate entrypoints.
2. Preserve matching outputs on edge cases and performance baseline; assert palette/token parity against original static data.
3. Run `npm run release:check`, Windows `npm run check` plus Electron smoke, Discord Activity, CodeQL and PR review.
4. Re-run unused-code/CSS and boundary checks. Assess whether any new wrapper or dead code was introduced.
5. Audit diff: only pure extraction, import movement, tests and this log; avoid playback/SQLite/IPC or visual changes.
6. No live Electron desktop is connected for manual UI QA; describe this limitation without claiming screenshot verification.

**Merge policy:** create a PR; never merge automatically without explicit instruction for this refactoring task.
