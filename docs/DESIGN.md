# Localtify design system

Localtify uses neutral light and dark chrome with a single real cover-image backdrop under the entire shell. The current listening track (including a paused track) has priority, then the active entity or Home's available art, then a neutral fallback. Utility pages keep the current listening ambience. Missing or unreadable art falls through to the next bounded source. Immersive listening retains its own backdrop. Cancel obsolete reads and suspend decorative work while hidden.

## Shared owners

- `src/styles/tokens.css`: type scale, spacing, geometry, motion and glass tokens.
- `src/styles/themes.css`: theme colors and derived values. Never derive a theme-dependent custom property only at the document root.
- `src/shared/ui/Surface.tsx` and `surface.css`: transparent, quiet fill and glass surfaces. Glass belongs on the outer overlay only. Use `ltOverlaySurface` for positioned overlays that require their own geometry or refs.
- `IconButton`: labelled native icon controls. Use existing feature classes for dimensions; preserve tooltips, focus, disabled state and touch sizes.
- `ArcDropdownMenu` / `ContextMenuLayer`: menus with keyboard navigation and typeahead. Portals synchronize active theme tokens.
- `PageHeader` / `CollectionHero` / `MediaCard`: common content hierarchy; avoid one-off control skins.

Use semantic tokens rather than hard-coded colors or duplicate surface rules. Use existing typography and small spacing increments. Preserve visible focus and semantic native controls. Respect reduced motion; avoid continuous or nested expensive effects. Feature styles own layout, not redundant copies of shared skin.

## Verification

Run lightweight type/bridge checks, CSS audits, node tests, production build and real desktop smoke. Check light and dark themes at narrow and wide widths. Verify Android separately. Keep security gates enabled. No external proprietary UI code or assets are included.
