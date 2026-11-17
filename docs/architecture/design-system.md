# Shared UI foundations

Localtify keeps its mint accents, Space Grotesk headings, pixel art and user palettes. This foundation changes reusable controls; page layouts remain feature-owned.

## Ownership

- `src/styles/tokens.css`: primitive spacing, type, radius, motion and elevation scales. Semantic `--lt-*` colors remain owned by the theme and custom palette builders.
- `src/shared/ui/controls.css`: shared action, secondary, danger and icon button skins; text input colors, placeholders, range defaults and keyboard outlines. Features retain geometry and intentional exceptions.
- `ArcDropdownMenu`: anchored, theme-aware option menus with disabled options, arrow/Home/End navigation, Escape and logical Tab order. Desktop rows are 36px; coarse-pointer rows are 44px. Placement and highlight use the same computed row token.
- `ContextMenuLayer`: existing measured positioning, dismissal and focus restoration. Song, collection and sidebar menus reuse it.
- `Surface`: existing semantic status/elevation variants and density presets; use only when a surface helps group content.
- `App.css`: dialog layout and compact dialog headings. Existing dialog focus traps remain in their components.
- `performance.css`: application motion policy. Body-portaled dropdowns also observe the app preference because they sit outside that CSS subtree.

## Tokens and use

| Family | Values | Use |
| --- | --- | --- |
| `--lt-space-1` through `--lt-space-5` | 4, 8, 12, 16, 24px | Tight control groups and surface padding |
| `--lt-text-sm`, `--lt-text-base`, `--lt-text-title` | 12, 13, 20px | Labels, control copy and dialog headings |
| `--lt-control-height` | 42px; 44px on coarse pointers | Default controls; feature-specific row/player sizes remain local |
| `--lt-control-radius`, `--lt-radius-item` | 12, 8px | Controls/menu panels and nested menu options |
| `--lt-duration-fast`, `--lt-duration-normal` | 120, 180ms | Feedback and short transitions |
| `--lt-ease-out` | cubic-bezier(.16, 1, .3, 1) | Small, interruptible interactions |
| `--lt-shadow-menu`, `--lt-shadow-low` | Offset soft shadows | Floating menus and elevated status surfaces |

Use semantic theme colors directly at the consuming element. Do not resolve theme-dependent aliases on `:root`: they would keep the root palette when `.app` changes theme. Dropdown portals copy the active palette; other shared overlays live inside `.app`.

Opaque accent buttons use `--button-text-on-accent`, calculated from relative luminance for presets, custom colors and live previews. Do not apply this foreground to a translucent accent background. Placeholders mix the theme foreground with its background rather than white transparency.

## Interaction and performance

Reuse native buttons and inputs, give icon actions an accessible name, and keep native `title` hints for existing tooltips. A custom tooltip dependency is unnecessary for this foundation. Preserve dialog focus traps and context-menu focus restoration. A visible outline is required for keyboard navigation; menu rows use an inset outline to avoid clipping.

Keep menu surfaces opaque and readable; do not add backdrop blur behind an already opaque panel. Preserve existing bounded dialog/album-art blur. Animate small transforms and opacity; respect OS and app reduced-motion preferences. Do not add page entrance animations or raise performance budgets for decorative effects.

## Collection pages

Custom palettes derive secondary copy at 70% foreground opacity so light backgrounds retain readable metadata.

Browse pages share `PageHeader` search/actions, the 28px `--lt-text-page` heading, and artwork-led `collectionBrowseGrid` / `collectionBrowseCard` primitives. Artist artwork stays round; albums stay square. Keep active/drop feedback on the existing `MediaCard` instead of adding framed containers.

Album, artist, genre, playlist and mix details reuse `CollectionHero` with a 32px `--lt-text-collection` title. Collection type and statistics sit below the title. Page-specific management actions retain their existing handlers and Android restrictions.

`TrackList` uses the existing `usePageVirtualizer` above 80 tracks, measures real row heights and preserves original collection indices and song IDs. Keep positioning on its wrapper (`trackVirtualRow`), outside row hover/performance transforms. Short collections render directly. Library and playlist virtualizers retain their own geometry and drag/drop behavior.

`CollectionLoading` provides a static, accessible status and stable placeholders for pending mixes. Empty and failed states keep their recovery actions; do not substitute an empty result for a pending request.
