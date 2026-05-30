/* localtify 0.3.5 proximity motion V147 — file patch label only; APP_VERSION stays 0.3.5.
   Real proximity without input lag: cached visible button/card rects, rAF writes only,
   no React state, no dense song-row scanning, and no feature removal for buttons. */
import { useEffect, type RefObject } from "react";

type UseProximityMotionOptions = {
  rootRef: RefObject<HTMLElement | null>;
  disabled?: boolean;
  suspended?: boolean;
  resetKey?: string;
};

type CachedTarget = {
  element: HTMLElement;
  rect: DOMRect;
};

const TARGET_SELECTOR = [
  "button",
  "[role='button']",
  ".navItem",
  ".mainAction",
  ".heroMain",
  ".heroGhost",
  ".heroTinyButton",
  ".homeShelfActionButton",
  ".expandLibraryButton",
  ".softButton",
  ".simpleAction",
  ".simpleGhost",
  ".toolButton",
  ".iconAction",
  ".songMenuButton",
  ".tabButton",
  ".navButton",
  ".tinyToggle",
  ".settingsTinyButton",
  ".settingsChoice",
  ".settingSwitchCard",
  ".settingsThemeCard",
  ".coverSyncChoice",
  ".coverTile",
  ".coverGalleryCard",
  ".homeAlbumCard",
  ".libraryCard",
  ".libraryCardV025",
  ".playlistShelfCard"
].join(",");

const DENSE_ROW_SELECTOR = ".songRow,.playlistTrackRow,.playlistSongRow,.libraryRow,.homeListenCard";
const RADIUS = 165;
const MIN_STRENGTH = 0.045;
const MAX_ACTIVE_TARGETS = 9;
const TARGET_REFRESH_MS = 520;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distanceToRect(x: number, y: number, rect: DOMRect) {
  const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
  const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
  return Math.hypot(dx, dy);
}

function isVisibleTarget(root: HTMLElement, element: HTMLElement) {
  if (!root.contains(element) || element.matches(DENSE_ROW_SELECTOR)) return false;
  if (element.closest(DENSE_ROW_SELECTOR)) return false;
  if (element.closest(".playerBar") && element.matches(".homeAlbumCard,.libraryCard,.libraryCardV025,.playlistShelfCard")) return false;
  if (element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true") return false;
  return true;
}

function applyState(element: HTMLElement, strength: number) {
  const scale = 1 + strength * 0.038;
  const glow = Math.round(strength * 26);
  const bg = 0.012 + strength * 0.036;
  const line = 0.11 + strength * 0.25;
  const signature = `${Math.round(scale * 10000)}:${glow}:${Math.round(bg * 1000)}:${Math.round(line * 1000)}`;

  if (element.dataset.localtifyProxSignature === signature && element.classList.contains("localtifyProximityActive")) return;

  element.dataset.localtifyProxSignature = signature;
  element.classList.add("localtifyProximityTarget", "localtifyProximityActive");
  element.style.setProperty("--prox-scale", scale.toFixed(4));
  element.style.setProperty("--prox-glow-size", `${glow}px`);
  element.style.setProperty("--prox-bg", bg.toFixed(3));
  element.style.setProperty("--prox-line", line.toFixed(3));
}

function clearElement(element: HTMLElement) {
  element.classList.remove("localtifyProximityActive");
  element.style.removeProperty("--prox-scale");
  element.style.removeProperty("--prox-glow-size");
  element.style.removeProperty("--prox-bg");
  element.style.removeProperty("--prox-line");
  delete element.dataset.localtifyProxSignature;
}

export function useProximityMotion({ rootRef, disabled = false, suspended = false, resetKey = "" }: UseProximityMotionOptions) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || disabled || suspended) return;

    let frame = 0;
    let lastX = -9999;
    let lastY = -9999;
    let lastRefresh = 0;
    let targets: CachedTarget[] = [];
    const active = new Map<HTMLElement, true>();

    const clearAll = () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }

      active.forEach((_value, element) => clearElement(element));
      active.clear();
    };

    const refreshTargets = (now: number) => {
      if (now - lastRefresh < TARGET_REFRESH_MS && targets.length > 0) return;

      const viewportW = window.innerWidth || document.documentElement.clientWidth || 0;
      const viewportH = window.innerHeight || document.documentElement.clientHeight || 0;

      targets = Array.from(root.querySelectorAll<HTMLElement>(TARGET_SELECTOR))
        .filter((element) => isVisibleTarget(root, element))
        .map((element) => ({ element, rect: element.getBoundingClientRect() }))
        .filter(({ rect }) => {
          if (rect.width <= 0 || rect.height <= 0) return false;
          return rect.right >= -RADIUS && rect.left <= viewportW + RADIUS && rect.bottom >= -RADIUS && rect.top <= viewportH + RADIUS;
        })
        .slice(0, 180);

      lastRefresh = now;
    };

    const paint = (now: number) => {
      frame = 0;
      refreshTargets(now);

      const ranked: Array<{ element: HTMLElement; strength: number }> = [];

      for (const target of targets) {
        if (!root.contains(target.element)) continue;

        const distance = distanceToRect(lastX, lastY, target.rect);
        const strength = clamp(1 - distance / RADIUS, 0, 1);

        if (strength > MIN_STRENGTH) ranked.push({ element: target.element, strength });
      }

      ranked.sort((a, b) => b.strength - a.strength);
      const nextActive = new Set<HTMLElement>();

      ranked.slice(0, MAX_ACTIVE_TARGETS).forEach(({ element, strength }) => {
        nextActive.add(element);
        applyState(element, strength);
        active.set(element, true);
      });

      active.forEach((_value, element) => {
        if (!nextActive.has(element)) {
          clearElement(element);
          active.delete(element);
        }
      });
    };

    const schedulePaint = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(paint);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const movedFarEnough = Math.abs(event.clientX - lastX) + Math.abs(event.clientY - lastY) >= 1;
      lastX = event.clientX;
      lastY = event.clientY;
      if (movedFarEnough) schedulePaint();
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const element = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>(TARGET_SELECTOR);
      if (element && isVisibleTarget(root, element)) applyState(element, 1);
    };

    const invalidateTargets = () => {
      lastRefresh = 0;
      targets = [];
      clearAll();
    };

    root.addEventListener("pointermove", handlePointerMove, { passive: true });
    root.addEventListener("pointerdown", handlePointerDown, { passive: true });
    root.addEventListener("pointerleave", clearAll, { passive: true });
    window.addEventListener("blur", clearAll, { passive: true });
    window.addEventListener("scroll", invalidateTargets, { passive: true, capture: true });
    window.addEventListener("resize", invalidateTargets, { passive: true });

    return () => {
      root.removeEventListener("pointermove", handlePointerMove);
      root.removeEventListener("pointerdown", handlePointerDown);
      root.removeEventListener("pointerleave", clearAll);
      window.removeEventListener("blur", clearAll);
      window.removeEventListener("scroll", invalidateTargets, true);
      window.removeEventListener("resize", invalidateTargets);
      clearAll();
    };
  }, [disabled, resetKey, rootRef, suspended]);
}
