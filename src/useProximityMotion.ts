/* localtify 0.3.8 V307 — measured proximity motion.
   Keeps button/player/sidebar motion alive, but removes broad target scanning from pointermove. */
import { useEffect, type RefObject } from "react";

type UseProximityMotionOptions = {
  rootRef: RefObject<HTMLElement | null>;
  disabled?: boolean;
  suspended?: boolean;
  resetKey?: string;
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
  ".albumCardV318",
  ".albumDetailPanelV318",
  ".albumTrackRowV318",
  ".albumBuilderPanelV318",
  ".albumSongPickerRowV318",
  ".albumsShelfGridV318",
  ".coverTile",
  ".coverGalleryCard",
  ".coverGalleryCardCleanOnly",
  ".coverSongPick",
  ".coverSongPickVirtual",
  ".coverGalleryImageButton",
  ".coverGalleryImageButtonCleanOnly",
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function targetPriority(element: HTMLElement) {
  if (element.closest(".playerBar")) return 3;
  if (element.closest(".sidebar") || element.matches(".navItem")) return 3;
  if (element.matches(".heroMain,.heroGhost,.heroTinyButton,.expandLibraryButton,.homeShelfActionButton")) return 2.6;
  return 2;
}

function isUsableTarget(root: HTMLElement, element: HTMLElement | null) {
  if (!element || !root.contains(element)) return false;
  if (element.matches(SKIP_SELECTOR) || element.closest(SKIP_SELECTOR)) return false;
  if (element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true") return false;
  return true;
}

function findTarget(root: HTMLElement, eventTarget: EventTarget | null) {
  const target = eventTarget instanceof Element ? eventTarget.closest<HTMLElement>(BUTTON_SELECTOR) : null;
  return isUsableTarget(root, target) ? target : null;
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
    let clearTimer = 0;
    let activeTarget: HTMLElement | null = null;
    let pendingTarget: HTMLElement | null = null;
    let pendingStrength = 0;
    let lastX = -9999;
    let lastY = -9999;
    let lastMoveAt = 0;
    let visible = !document.hidden;

    const isAudioPlaying = () => root.dataset.playing === "on" || root.classList.contains("appAudioPlaying");

    const clearActive = () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }

      if (clearTimer) {
        window.clearTimeout(clearTimer);
        clearTimer = 0;
      }

      if (activeTarget) {
        clearElement(activeTarget);
        activeTarget = null;
      }

      pendingTarget = null;
    };

    const paint = () => {
      frame = 0;
      if (!visible || document.hidden) return;

      if (activeTarget && activeTarget !== pendingTarget) {
        clearElement(activeTarget);
        activeTarget = null;
      }

      if (!pendingTarget || !isUsableTarget(root, pendingTarget)) return;

      activeTarget = pendingTarget;
      applyState(activeTarget, pendingStrength, targetPriority(activeTarget));
    };

    const schedulePaint = () => {
      if (frame || !visible || document.hidden) return;
      frame = window.requestAnimationFrame(paint);
    };

    const scheduleClear = (delay = 120) => {
      if (clearTimer) window.clearTimeout(clearTimer);
      clearTimer = window.setTimeout(() => {
        clearTimer = 0;
        clearActive();
      }, delay);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!visible || document.hidden || event.pointerType === "touch") return;

      const now = performance.now();
      const minInterval = isAudioPlaying() ? 42 : 24;
      const movedFarEnough = Math.abs(event.clientX - lastX) + Math.abs(event.clientY - lastY) >= 7;

      if (!movedFarEnough && now - lastMoveAt < minInterval) return;
      if (now - lastMoveAt < minInterval) return;

      lastMoveAt = now;
      lastX = event.clientX;
      lastY = event.clientY;

      const target = findTarget(root, event.target);
      if (!target) {
        scheduleClear(isAudioPlaying() ? 160 : 110);
        return;
      }

      if (clearTimer) {
        window.clearTimeout(clearTimer);
        clearTimer = 0;
      }

      // One-target motion only: no querySelectorAll, no broad getBoundingClientRect scan.
      // This keeps the sidebar/player/hero buttons lively without the profiler's pointermove spike.
      pendingTarget = target;
      pendingStrength = targetPriority(target) >= 3 ? 0.9 : 0.74;
      schedulePaint();
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!visible || document.hidden || event.pointerType === "touch") return;
      const target = findTarget(root, event.target);
      if (!target) return;
      pendingTarget = target;
      pendingStrength = 1;
      schedulePaint();
    };

    const handlePointerOut = (event: PointerEvent) => {
      const next = event.relatedTarget instanceof Element ? event.relatedTarget : null;
      if (next && activeTarget && activeTarget.contains(next)) return;
      scheduleClear(100);
    };

    const handleVisibilityChange = () => {
      visible = !document.hidden;
      clearActive();
    };

    root.addEventListener("pointermove", handlePointerMove, { passive: true });
    root.addEventListener("pointerdown", handlePointerDown, { passive: true });
    root.addEventListener("pointerout", handlePointerOut, { passive: true });
    root.addEventListener("pointerleave", clearActive, { passive: true });
    window.addEventListener("blur", clearActive, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      root.removeEventListener("pointermove", handlePointerMove);
      root.removeEventListener("pointerdown", handlePointerDown);
      root.removeEventListener("pointerout", handlePointerOut);
      root.removeEventListener("pointerleave", clearActive);
      window.removeEventListener("blur", clearActive);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearActive();
    };
  }, [disabled, resetKey, rootRef, suspended]);
}
