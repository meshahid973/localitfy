/* localtify 0.3.7 V258 — strict buttons-only proximity motion; download panels and virtual rows skipped.
   Kept:
   - sidebar/nav buttons
   - main action buttons
   - player buttons

   Removed:
   - settings cards
   - reset buttons
   - song rows
   - library cards
   - cover cards/gallery cards
*/
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
  priority: number;
};

const BUTTON_SELECTOR = [
  "button:not(.settingSwitchCard):not(.settingsResetButton):not(.visualOptionButtonV205)",
  "[role='button']:not(.settingSwitchCard):not(.settingsResetButton):not(.visualOptionButtonV205)",
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
  ".playerButton",
  ".playerControlButton",
  ".circleButton",
  ".repeatButton",
  ".volumeIconButton"
].join(",");

const SKIP_SELECTOR = [
  ".songRow",
  ".playlistTrackRow",
  ".playlistSongRow",
  ".libraryRow",
  ".homeListenCard",
  ".homeFreshCard",
  ".homeAlbumCard",
  ".libraryCard",
  ".libraryCardV025",
  ".playlistShelfCard",
  ".coverTile",
  ".coverGalleryCard",
  ".coverSongPick",
  ".coverSongPickVirtual",
  ".coverGalleryImageButton",
  ".coverPreviewApplyButton",
  ".coverGalleryPreviewBar",
  ".settingSwitchCard",
  ".settingsChoice",
  ".settingsThemeCard",
  ".coverSyncChoice",
  ".toggleRow",
  ".rangeRow",
  ".visualOptionButtonV205",
  ".visualOptionGroupV205",
  ".settingsResetButton",
  ".settingsPanelCard",
  ".settingsPageCard",
  ".downloadsLayout",
  ".downloadsLayoutV031",
  ".downloadPanel",
  ".downloadPanelV031",
  ".downloadTabStrip",
  ".downloadTab",
  ".downloadNoticeV031",
  ".downloadTextareaV031",
  ".downloadActionsV031",
  ".spotifyFlowPanelV256",
  ".spotifyAuthCardV256",
  ".spotifyFlowStep",
  ".spotifyUrlRowV256",
  ".spotifyFetchButton",
  ".spotifyTrackListV256",
  ".spotifyTrackItem",
  ".spotifyDownloadRowV256",
  ".spotifyDownloadButton",
  ".converterBoxV031",
  ".downloadQueueItem",
  ".downloadResult"
].join(",");

const RADIUS_IDLE = 104;
const RADIUS_PLAYING = 88;
const MIN_STRENGTH = 0.10;
const TARGET_REFRESH_IDLE_MS = 1200;
const TARGET_REFRESH_PLAYING_MS = 1600;
const MAX_SCAN_IDLE = 34;
const MAX_SCAN_PLAYING = 22;
const MAX_ACTIVE_IDLE = 3;
const MAX_ACTIVE_PLAYING = 2;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distanceToRect(x: number, y: number, rect: DOMRect) {
  const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
  const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
  return Math.hypot(dx, dy);
}

function targetPriority(element: HTMLElement) {
  if (element.closest(".playerBar")) return 3;
  if (element.matches(".navItem")) return 3;
  return 2;
}

function isVisibleTarget(root: HTMLElement, element: HTMLElement) {
  if (!root.contains(element)) return false;
  if (element.matches(SKIP_SELECTOR) || element.closest(SKIP_SELECTOR)) return false;
  if (element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true") return false;

  const style = window.getComputedStyle(element);
  if (style.visibility === "hidden" || style.display === "none" || style.pointerEvents === "none") return false;

  return true;
}

function applyState(element: HTMLElement, strength: number, priority = targetPriority(element)) {
  const weightedStrength = clamp(strength * (priority >= 3 ? 1 : 0.82), 0, 1);
  const scale = 1 + weightedStrength * 0.018;
  const glow = Math.round(weightedStrength * 8);
  const bg = 0.004 + weightedStrength * 0.012;
  const line = 0.06 + weightedStrength * 0.08;
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

export function useProximityMotion({
  rootRef,
  disabled = false,
  suspended = false,
  resetKey = ""
}: UseProximityMotionOptions) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || disabled || suspended) return;

    let frame = 0;
    let lastX = -9999;
    let lastY = -9999;
    let lastRefresh = 0;
    let targets: CachedTarget[] = [];
    let pointerInside = false;
    let visible = !document.hidden;
    const active = new Map<HTMLElement, true>();

    const isAudioPlaying = () => root.dataset.playing === "on" || root.classList.contains("appAudioPlaying");

    const clearAll = () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }

      active.forEach((_value, element) => clearElement(element));
      active.clear();
    };

    const invalidateTargets = () => {
      lastRefresh = 0;
      targets = [];
    };

    const refreshTargets = (now: number) => {
      const playing = isAudioPlaying();
      const refreshMs = playing ? TARGET_REFRESH_PLAYING_MS : TARGET_REFRESH_IDLE_MS;
      if (now - lastRefresh < refreshMs && targets.length > 0) return;

      const radius = playing ? RADIUS_PLAYING : RADIUS_IDLE;
      const viewportW = window.innerWidth || document.documentElement.clientWidth || 0;
      const viewportH = window.innerHeight || document.documentElement.clientHeight || 0;
      const maxScan = playing ? MAX_SCAN_PLAYING : MAX_SCAN_IDLE;

      targets = Array.from(root.querySelectorAll<HTMLElement>(BUTTON_SELECTOR))
        .filter((element) => isVisibleTarget(root, element))
        .map((element) => ({ element, rect: element.getBoundingClientRect(), priority: targetPriority(element) }))
        .filter(({ rect }) => {
          if (rect.width <= 0 || rect.height <= 0) return false;
          return rect.right >= -radius && rect.left <= viewportW + radius && rect.bottom >= -radius && rect.top <= viewportH + radius;
        })
        .sort((a, b) => b.priority - a.priority)
        .slice(0, maxScan);

      lastRefresh = now;
    };

    const paint = (now: number) => {
      frame = 0;
      if (!visible || document.hidden || !pointerInside) return;

      const playing = isAudioPlaying();
      const radius = playing ? RADIUS_PLAYING : RADIUS_IDLE;
      const maxActive = playing ? MAX_ACTIVE_PLAYING : MAX_ACTIVE_IDLE;
      refreshTargets(now);

      const ranked: Array<{ element: HTMLElement; strength: number; priority: number }> = [];

      for (const target of targets) {
        if (!root.contains(target.element)) continue;

        const distance = distanceToRect(lastX, lastY, target.rect);
        const strength = clamp(1 - distance / radius, 0, 1);

        if (strength > MIN_STRENGTH) {
          ranked.push({ element: target.element, strength, priority: target.priority });
        }
      }

      ranked.sort((a, b) => b.strength * b.priority - a.strength * a.priority);
      const nextActive = new Set<HTMLElement>();

      ranked.slice(0, maxActive).forEach(({ element, strength, priority }) => {
        nextActive.add(element);
        applyState(element, strength, priority);
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
      if (frame || !visible || document.hidden) return;
      frame = window.requestAnimationFrame(paint);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!visible || document.hidden || event.pointerType === "touch") return;

      const movedFarEnough = Math.abs(event.clientX - lastX) + Math.abs(event.clientY - lastY) >= 4;
      pointerInside = true;
      lastX = event.clientX;
      lastY = event.clientY;

      if (movedFarEnough) schedulePaint();
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!visible || document.hidden || event.pointerType === "touch") return;

      const element = (event.target as Element | null)?.closest<HTMLElement>(BUTTON_SELECTOR);
      if (!element || !isVisibleTarget(root, element)) return;

      pointerInside = true;
      lastX = event.clientX;
      lastY = event.clientY;
      applyState(element, 0.72);
      active.set(element, true);
    };

    const handlePointerLeave = () => {
      pointerInside = false;
      clearAll();
    };

    const handleVisibilityChange = () => {
      visible = !document.hidden;
      pointerInside = false;
      invalidateTargets();
      clearAll();
    };

    root.addEventListener("pointermove", handlePointerMove, { passive: true });
    root.addEventListener("pointerdown", handlePointerDown, { passive: true });
    root.addEventListener("pointerleave", handlePointerLeave, { passive: true });
    window.addEventListener("blur", clearAll, { passive: true });
    window.addEventListener("scroll", invalidateTargets, { passive: true, capture: true });
    window.addEventListener("resize", invalidateTargets, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      root.removeEventListener("pointermove", handlePointerMove);
      root.removeEventListener("pointerdown", handlePointerDown);
      root.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("blur", clearAll);
      window.removeEventListener("scroll", invalidateTargets, true);
      window.removeEventListener("resize", invalidateTargets);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearAll();
    };
  }, [disabled, resetKey, rootRef, suspended]);
}
