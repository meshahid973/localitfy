/* localtify 0.3.5 proximity motion V142 — file patch label only; APP_VERSION stays 0.3.5.
   Small hook, kept in src/useProximityMotion.ts. No hooks folder required. */
import { useEffect, type RefObject } from "react";

type ProximityMotionOptions = {
  rootRef: RefObject<HTMLElement | null>;
  disabled?: boolean;
  suspended?: boolean;
  resetKey?: string;
};

type PaintState = {
  scale: string;
  bg: string;
  line: string;
  glow: string;
};

const PROXIMITY_TARGET_SELECTOR = [
  "button:not(:disabled)",
  "a[href]",
  "[role='button']",
  ".navItem",
  ".heroTinyButton",
  ".homeShelfActionButton",
  ".expandLibraryButton",
  ".homeListenCard",
  ".homeFreshCard",
  ".homeAlbumCard",
  ".libraryCard",
  ".libraryCardV025",
  ".songRow",
  ".songCard",
  ".coverTile",
  ".playlistShelfCard",
  ".playlistTrackRow",
  ".settingSwitchCard",
  ".settingsChoice",
  ".settingsThemeCard",
  ".settingsTinyButton",
  ".softButton",
  ".simpleAction",
  ".simpleGhost",
  ".circleButton",
  ".toolButton",
  ".iconAction",
  ".tabButton",
  ".navButton",
  ".mainAction"
].join(",");

const PROXIMITY_IGNORE_SELECTOR = [
  "[data-proximity-ignore='true']",
  "input",
  "textarea",
  "select",
  "option",
  "label",
  ".progressRow",
  ".progressTrack",
  ".volumeSliderWrap",
  ".volumeSlider",
  ".sidebarResizeHandle",
  ".playerResizeHandle",
  ".titleBar",
  ".titleDrag"
].join(",");

const SAMPLE_OFFSETS: Array<readonly [number, number]> = [
  [0, 0],
  [-86, 0],
  [86, 0],
  [0, -72],
  [0, 72],
  [-62, -50],
  [62, -50],
  [-62, 50],
  [62, 50]
];

const MAX_CANDIDATES = 18;
const MAX_STACK_DEPTH = 7;
const NEIGHBOR_SCAN_LIMIT = 32;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isUsableRect(rect: DOMRect): boolean {
  return rect.width >= 8 && rect.height >= 8 && rect.bottom >= 0 && rect.right >= 0 && rect.top <= window.innerHeight && rect.left <= window.innerWidth;
}

function proximityTargetFromElement(element: Element | null, root: HTMLElement): HTMLElement | null {
  if (!(element instanceof HTMLElement)) return null;

  const target = element.closest<HTMLElement>(PROXIMITY_TARGET_SELECTOR);
  if (!target || target === root || !root.contains(target)) return null;
  if (target.matches(PROXIMITY_IGNORE_SELECTOR) || target.closest(PROXIMITY_IGNORE_SELECTOR)) return null;
  if (target.dataset.proximityIgnore === "true") return null;

  return target;
}

function collectNearbyTargets(root: HTMLElement, x: number, y: number): HTMLElement[] {
  const targets = new Set<HTMLElement>();
  const viewportWidth = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
  const viewportHeight = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);

  for (const [offsetX, offsetY] of SAMPLE_OFFSETS) {
    if (targets.size >= MAX_CANDIDATES) break;

    const sampleX = clamp(x + offsetX, 0, viewportWidth - 1);
    const sampleY = clamp(y + offsetY, 0, viewportHeight - 1);
    const stack = document.elementsFromPoint(sampleX, sampleY).slice(0, MAX_STACK_DEPTH);

    for (const element of stack) {
      if (targets.size >= MAX_CANDIDATES) break;
      const target = proximityTargetFromElement(element, root);
      if (target) targets.add(target);
    }
  }

  // Make rows/cards beside the hovered item react too, but only within the same
  // parent and only a tiny capped slice. This gives the Opus-style proximity
  // feeling without querying every song/card in the app on each pointer move.
  const firstTarget = targets.values().next().value as HTMLElement | undefined;
  const parent = firstTarget?.parentElement;
  if (firstTarget && parent && parent.childElementCount <= NEIGHBOR_SCAN_LIMIT) {
    for (const child of Array.from(parent.children)) {
      if (targets.size >= MAX_CANDIDATES) break;
      const target = proximityTargetFromElement(child, root);
      if (target) targets.add(target);
    }
  }

  return Array.from(targets);
}

function distanceToRect(x: number, y: number, rect: DOMRect): number {
  const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
  const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
  return Math.hypot(dx, dy);
}

function targetRadius(target: HTMLElement): number {
  if (target.matches("button,.circleButton,.iconAction,.toolButton,.tabButton,.navButton,.settingsTinyButton,.heroTinyButton,.homeShelfActionButton,.expandLibraryButton")) {
    return 118;
  }

  if (target.matches(".homeAlbumCard,.homeFreshCard,.libraryCard,.libraryCardV025,.songCard,.coverTile,.playlistShelfCard")) {
    return 158;
  }

  return 138;
}

function maxScaleForTarget(target: HTMLElement): number {
  if (target.matches("button,.circleButton,.iconAction,.toolButton,.tabButton,.navButton,.settingsTinyButton,.heroTinyButton,.homeShelfActionButton,.expandLibraryButton")) {
    return 0.026;
  }

  if (target.matches(".songRow,.homeListenCard,.playlistTrackRow")) {
    return 0.014;
  }

  return 0.021;
}

function paintTarget(target: HTMLElement, state: PaintState): void {
  const previous = target.dataset.proxState;
  const next = `${state.scale}|${state.bg}|${state.line}|${state.glow}`;
  if (previous === next) return;

  target.dataset.proxState = next;
  target.classList.add("localtifyProximityTarget", "localtifyProximityActive");
  target.style.setProperty("--prox-scale", state.scale);
  target.style.setProperty("--prox-bg", state.bg);
  target.style.setProperty("--prox-line", state.line);
  target.style.setProperty("--prox-glow-size", state.glow);
}

function clearTarget(target: HTMLElement): void {
  target.classList.remove("localtifyProximityActive", "localtifyProximityTarget");
  target.style.removeProperty("--prox-scale");
  target.style.removeProperty("--prox-bg");
  target.style.removeProperty("--prox-line");
  target.style.removeProperty("--prox-glow-size");
  delete target.dataset.proxState;
}

export function useProximityMotion({ rootRef, disabled = false, suspended = false, resetKey = "" }: ProximityMotionOptions): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || disabled || suspended) return undefined;

    let pointerX = 0;
    let pointerY = 0;
    let hasPointer = false;
    let frame = 0;
    const activeTargets = new Set<HTMLElement>();

    const clearAll = () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }

      activeTargets.forEach(clearTarget);
      activeTargets.clear();
      hasPointer = false;
    };

    const paint = () => {
      frame = 0;
      if (!hasPointer) return;

      const nextTargets = new Set<HTMLElement>();
      const candidates = collectNearbyTargets(root, pointerX, pointerY);

      for (const target of candidates) {
        const rect = target.getBoundingClientRect();
        if (!isUsableRect(rect)) continue;

        const radius = targetRadius(target);
        const distance = distanceToRect(pointerX, pointerY, rect);
        const strength = clamp(1 - distance / radius, 0, 1);
        if (strength <= 0.02) continue;

        const eased = Math.pow(strength, 1.55);
        const scale = 1 + maxScaleForTarget(target) * eased;
        const background = 0.012 + 0.085 * eased;
        const line = 0.15 + 0.28 * eased;
        const glow = Math.round(6 + 38 * eased);

        nextTargets.add(target);
        paintTarget(target, {
          scale: scale.toFixed(4),
          bg: background.toFixed(4),
          line: line.toFixed(4),
          glow: `${glow}px`
        });
      }

      activeTargets.forEach((target) => {
        if (!nextTargets.has(target)) clearTarget(target);
      });

      activeTargets.clear();
      nextTargets.forEach((target) => activeTargets.add(target));
    };

    const schedulePaint = () => {
      if (!frame) frame = window.requestAnimationFrame(paint);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch" || event.pointerType === "pen") return;
      pointerX = event.clientX;
      pointerY = event.clientY;
      hasPointer = true;
      schedulePaint();
    };

    const handlePointerLeave = () => clearAll();
    const handleBlur = () => clearAll();
    const handleScroll = () => clearAll();

    root.addEventListener("pointermove", handlePointerMove, { passive: true });
    root.addEventListener("pointerleave", handlePointerLeave, { passive: true });
    window.addEventListener("blur", handleBlur, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true, capture: true });

    return () => {
      root.removeEventListener("pointermove", handlePointerMove);
      root.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("scroll", handleScroll, true);
      clearAll();
    };
  }, [disabled, resetKey, rootRef, suspended]);
}
