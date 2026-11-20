# Localtify contributor instructions

These instructions apply to all AI coding assistants and human contributors working in this repository.

## Focus on shipping real improvements
- Inspect the implementation and existing tests before editing anything.
- Prioritize correctness, performance, accessibility, user data safety, stable playback and clean UI. Keep design system, collection presentation and immersive listening behavior intact.
- Avoid busywork, unnecessary CI runs, speculative refactors, new dependencies, and unrelated formatting changes.
- Reuse existing utilities, components, tests, fixtures and scripts instead of creating parallel systems.
- Never claim that unrun checks, real-provider requests, physical-device QA or benchmarks have passed.

## Tests: reuse before adding
- First search `tests/phase3`, `tests/phase4` and `tests/helpers` for an existing test file matching the changed behavior. Extend that file with the smallest meaningful regression check.
- Do NOT create a separate `*.test.mjs` for each bug, CSS selector, component, PR, commit or refactor. Avoid tiny source-text and regex snapshot tests that only enforce a particular implementation shape.
- Create a new test file only when there is a genuinely new independent module with behavior or security boundaries that are not naturally covered by an existing suite. Keep fixtures shared.
- Favor behavioral tests of invariants, failures and recovery over exact source strings. Update tests after a legitimate refactor to verify the preserved behavior, not to demand obsolete code structure.
- Remove duplicated assertions and obsolete tests after inspecting their coverage. Do NOT weaken tests covering playback continuity, database migrations/restore, user data, file safety, provider authorization, IPC security, downloads or concurrency.
- Do not generate one-off test harnesses, duplicate benchmark variants or extra documentation solely to demonstrate routine changes.
- Fix the underlying failure instead of deleting a meaningful failing test or raising a performance budget to hide a regression.

## Validation: use the smallest useful set
- For routine changes, run focused existing tests and `npm run check:quick` where appropriate. Do not run the full suite after every edit.
- Before merging nontrivial changes, ensure the standard `quality` PR checks pass. Linux runs the full gate; Windows validates TypeScript, build and real Electron smoke. Do not manually re-run successful jobs without a relevant code change or confirmed flaky infrastructure failure.
- `integrated-validation` is deliberately **manual** and expensive. Run it only for changes with meaningful desktop-vs-baseline, playback, media/cache, Android or large-library performance risk. The workflow still provides its own extended regression evidence.
- Release installer and experimental Rust workflows are opt-in. Do not trigger them for unrelated frontend/code cleanup.
- Avoid repeated `npm ci`, full benchmarks, emulator boot, packaging, audit or release checks across overlapping workflows.
- Preserve reproducible performance data, meaningful coverage and security gates; reduce duplicated work, not safety.

## Working with GitHub
- Keep changes in the existing relevant pull request; avoid extra PRs or commits solely for status updates.
- Use simple commit messages and keep scope narrow. Review the final diff.
- Do not merge if meaningful CI gates fail, if critical bugs are known, or if data safety/recovery claims are unverified.
- Report exactly what was implemented, validated, not validated and remains incomplete. No version bump or release unless explicitly requested.
