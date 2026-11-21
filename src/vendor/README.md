# Source-installed UI components

These files are copied from the original public component registries, not rewritten lookalikes. Source imports are adjusted only to use this project's relative module paths. Keep licenses/attribution with future updates.

- **React Bits** `@react-bits/FadeContent-TS-CSS`: `DavidHDev/react-bits/src/ts-default/Animations/FadeContent/FadeContent.tsx` (GSAP). Original license: see https://github.com/DavidHDev/react-bits/blob/main/LICENSE
- **Arc UI** `@uiarc/segmented-control`, `@uiarc/dropdown-menu`, `@uiarc/progress`, and shared motion tokens: `kuratlielia/arc-library/registry/` (CSS Modules + Radix + Motion). Original license: https://github.com/kuratlielia/arc-library/blob/main/LICENSE
- **beUI** `@beui/button-base` and `@beui/tabs`: `starc007/ui-components/components/motion/`; required original helpers from `lib/` (Motion + Tailwind utilities). Original license: https://github.com/starc007/ui-components/blob/main/LICENSE

The Arc dropdown CSS additionally maps Localtify theme tokens inside its Radix portal. `src/styles/vendor-tailwind.css` imports only utilities/theme and deliberately excludes Tailwind's Preflight reset.

- **beUI** `@beui/line-chart`: original chart, XY interaction and Motion dependencies installed with `bunx --bun shadcn add @beui/line-chart` and remapped to `src/vendor/charts/`.
- **Arc UI** `@uiarc/dropdown-menu`: original registry installed with `pnpm dlx shadcn@latest add @uiarc/dropdown-menu`; reused the previously source-installed accessible icon-only adaptation to prevent regressions.
