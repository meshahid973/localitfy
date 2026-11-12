# Codebase audit — 12 November 2026

Reviewed local checkout `C:\dev\localitfy` on
`release/0.5.0-css-hygiene-20261111`, starting at `471b7c0`.
The first pass started with an up-to-date checkout. A subsequent pass merged
`main` at `c15f15c`, incorporating Android sync and live device connection while
keeping the 0.5.0 release PR open.

## First cleanup pass

- Removed 241 unused CSS custom-property declarations. This includes 127
  declarations whose names appeared only once, followed by 114 declarations
  with no consumers after excluding declaration names from reference searches.
  Runtime property access and theme preview maps were inspected before removal.
  Shared theme/token definitions and dynamically supplied properties were preserved.
- Removed 76 unreferenced keyframe definitions. Their names occurred only at
  their definitions across tracked code and tests; renderer code does not
  construct CSS animation names dynamically. Removed blocks emptied by cleanup.
- Removed 79 unused exported functions, constants and types, including 54
  analytics wrappers and unused playlist, download, theme and drag helpers.
  Checked tracked source, tests, scripts and re-exports for callers; retained
  tested helpers and the analytics functions used by the running application.
- Updated or removed 20 obsolete CSS comments describing old releases or
  deleted behavior. Active selectors and compatibility identifiers retain
  their existing names.
- Removed three self-referencing custom-property declarations (`--panel`,
  `--accent-2`, `--accent-2-rgb`) from a legacy `.app` block. A property's own
  name inside `var()` creates a cycle, even with a fallback. Existing root
  defaults and theme-specific declarations now provide these values.
- Fixed the player artwork hover/focus shadow's undefined `--player-accent-rgb`
  reference to use the existing progress color with an accent fallback.
- Fixed Windows-only source-budget failures: source text is measured with LF
  newlines, so Git's CRLF checkout does not inflate source sizes. No thresholds
  were increased. Built JavaScript/CSS assets still use actual disk sizes.

An AST comparison verified that all retained CSS declaration values,
importance, selector contexts and order were unchanged by dead-code removal,
apart from the deliberate player shadow repair. The three cyclic declarations
were removed separately after that comparison. No renderer modules were deleted:
the existing import-graph audit found no unreachable renderer source files.

## Android integration and additional cleanup

- Resolved three merge conflicts while retaining page-based virtualization,
  contextual cover/song empty messages, platform labels and disabled toggles.
- Removed six uncalled private Electron helpers: obsolete path normalization,
  Spotify query construction, pixel-pack enumeration, packaged environment path
  enumeration and a Discord asset fallback wrapper. No exported service API or
  IPC channel was removed.
- Removed another 59 unused theme custom-property declarations and 25 selector
  branches for seven obsolete classes. Reference checks distinguish complete
  class names from substrings such as `loadingLogoImage` and `loadingLogo`.
  Runtime theme-property access was inspected before removal.
- Removed the unused ESLint scaffold: no package script, CI job or documentation
  used it, and its ESLint dependencies were absent from the package manifest.
- Replaced a stale token-migration comment with a description of current usage.
- Aligned Android's package version with 0.5.0 and included it in the existing
  release-version guard. Android's version code remains unchanged.

AST comparisons confirmed the retained CSS declarations and JavaScript
statements match the merged baseline after excluding the verified removals.
Across the cleanup passes, 300 unused custom-property declarations were removed.

[PR #127](https://github.com/meshahid973/localitfy/pull/127) and
[PR #134](https://github.com/meshahid973/localitfy/pull/134) are now merged into
main and integrated here. The major phone-cache deletion issue was fixed before
those merges. The lower-severity stale-handoff race was left unchanged, as
requested. See the [focused PR review](reviews/phone-sync-pr-review-2026-11-12.md).

## Validation and limits

`npm run release:check` passed after integration and Android follow-up: 507 tests,
bridge and TypeScript checks, boundaries, CSS audits,
production build, database recovery, performance benchmarks, asset dry run and
chunk audit. `git diff --check origin/main` passed. The current advisory scan
reports no unreachable renderer modules or unreferenced class-name candidates
across 308 source files and 48 stylesheets.

Android `assembleDebug lintDebug testDebugUnitTest` passed with JDK 21 and SDK 36.
The native unit-test task includes template smoke tests; application behavior is
covered by the Node sync suites and still requires real-device QA.

The [Android UI follow-up](android-ui-audit-2026-11-12.md) records reproduced
layout fixes, additional dead native code removal, targeted performance work
and installed-APK emulator checks with synthetic data. Real music libraries,
cross-platform manual playback and update testing were not performed.
PR #133 still lists installed Windows QA as a release gate. The release PR
remains unmerged; no release was tagged or published. Remote CI must validate
the newly pushed head independently of these local results.
