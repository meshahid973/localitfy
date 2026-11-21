# Source-installed UI components

These files are copied from the original public component registries, not rewritten lookalikes. Source imports are adjusted only to use this project's relative module paths. Keep licenses/attribution with future updates.

- **React Bits** `@react-bits/FadeContent-TS-CSS`: `DavidHDev/react-bits/src/ts-default/Animations/FadeContent/FadeContent.tsx` (GSAP). Original license: see https://github.com/DavidHDev/react-bits/blob/main/LICENSE
- **Arc UI** `@uiarc/segmented-control`, `@uiarc/dropdown-menu`, `@uiarc/progress`, and shared motion tokens: `kuratlielia/arc-library/registry/` (CSS Modules + Radix + Motion). Original license: https://github.com/kuratlielia/arc-library/blob/main/LICENSE
- **beUI** `@beui/button-base` and `@beui/tabs`: `starc007/ui-components/components/motion/`; required original helpers from `lib/` (Motion + Tailwind utilities). Original license: https://github.com/starc007/ui-components/blob/main/LICENSE

The Arc dropdown CSS additionally maps Localtify theme tokens inside its Radix portal. `src/styles/vendor-tailwind.css` imports only utilities/theme and deliberately excludes Tailwind's Preflight reset.
