# Localtify Phase 2 — Feature Rebirth

Phase 2 turns the renderer into feature-owned product areas without changing Localtify's visual identity or breaking Electron/data compatibility.

## Migration order

1. Settings
2. Downloads
3. Covers
4. Library/Home
5. Albums/Playlists
6. Player UI

## Non-negotiable rules

- Feature code owns its types, helpers, state, components and styles.
- `src/features`, `src/types`, `src/shared` and `src/platform` must never import from `App.tsx` or `LocaltifyAppView.tsx`.
- `LocaltifyAppView.tsx` is a temporary compatibility source only; new code must not depend on it.
- Keep the existing `PlayerEngine` / HTML audio engine / player controller architecture intact.
- Preserve `window.localitfy`, existing IPC channel names, `com.meshahid973.localitfy`, and existing user-data/database compatibility.
- Do not mix a visual redesign into feature extraction.
- Existing root entry files may temporarily re-export feature implementations so old imports keep working during migration.

## Target ownership

```text
src/features/
├─ home/
├─ library/
├─ albums/
├─ playlists/
├─ search/
├─ player/
├─ downloads/
├─ covers/
├─ settings/
├─ analytics/
├─ onboarding/
├─ updates/
├─ discord/
└─ shell/
```

## Phase 2 checkpoints

### A — remove fake ownership

- canonical `Song`, `Settings`, playlist, download, update, cover, Discord, theme and view types live under their owning feature
- legacy `src/types/*` files may remain only as compatibility exports to feature-owned types
- no type facade re-exports from `LocaltifyAppView`

### B — move feature implementations

- Settings and Cover Studio move behind feature entry points first
- root compatibility files become tiny re-export shims
- then Downloads, Library/Home, Albums/Playlists and Player UI are extracted in that order

### C — remove the renderer monolith

- `App.tsx` becomes bootstrap/composition
- `LocaltifyAppView.tsx` is deleted or reduced to a tiny compatibility shell
- feature CSS has one owner; global legacy CSS stops accumulating feature patches

## Exit criteria

- Settings, Downloads, Covers, Library, Albums, Playlists and Player UI have feature-owned entry points
- shared/types/constants/utils no longer re-export from `LocaltifyAppView`
- Settings is split into category-owned components instead of one giant prop-driven implementation
- Cover Studio is owned by `features/covers`
- `App.tsx` is composition/bootstrap rather than feature implementation
- `LocaltifyAppView.tsx` is deleted or reduced to a tiny compatibility shell
- no feature CSS relies on unrelated global ownership for new work
