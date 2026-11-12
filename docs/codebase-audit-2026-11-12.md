# Codebase audit — 12 November 2026

Reviewed local checkout `C:\dev\localitfy` on
`release/0.5.0-css-hygiene-20261111`, starting at `471b7c0`.
`git pull --ff-only` reported that the branch was already up to date.

## Findings and changes

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

## PR review

[PR #133](https://github.com/meshahid973/localitfy/pull/133) corresponds to this
checkout. Reviewed its local diff against `origin/main`, release configuration,
CSS changes, modal focus handling, and review-thread status. Its existing review
thread was resolved. The head commit's `quality`, `analysis-native`,
`rust-kernels-experimental` and `release-candidate` workflows all reported success.
Those remote results apply to the original head, not these unpushed changes.

Also identified open [PR #127](https://github.com/meshahid973/localitfy/pull/127)
(Android sync) and [PR #134](https://github.com/meshahid973/localitfy/pull/134)
(live connection, stacked on #127). Reviewed sync persistence, file cleanup,
server authorization, playback handoff and disconnect handling in isolated
checkouts. Reproduced two issues; see the
[focused PR review](reviews/phone-sync-pr-review-2026-11-12.md).
Their implementations were not merged into this checkout.

## Validation and limits

`npm run release:check` passed after the final code cleanup: 458 tests,
bridge and TypeScript checks, boundaries, CSS audits,
production build, database recovery, performance benchmarks, asset dry run and
chunk audit. `git diff --check` passed. The cleanup removes 32,208 bytes of CSS
source after normalizing newlines. The focused PR test runs passed 20 tests on
#127 and 33 tests on #134; the additional reproductions expose gaps in those tests.

This was a source and automated-check audit. Installed-app visual QA, real music
libraries, cross-platform manual playback and update testing were not performed.
PR #133 still lists installed Windows QA as a release gate. This cleanup targets
that existing PR. No PR was merged, and no release was tagged or published.
