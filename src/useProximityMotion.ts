/* localtify 0.3.8 V311 — cursor velocity proximity motion.
   Adds physical velocity response without scanning the whole UI on every pointer move.
   - Uses the actual hovered interactive target only.
   - Keeps heavy rows/cards/gallery panels skipped.
   - Adds small velocity stretch/rotate/soft blur variables for CSS.
*/
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
  ".downloadResult",
  ".albumFolderImportPanelV308",
  ".albumFolderImportPanelV309",
  ".albumFolderPreviewGridV309",
  ".albumFolderPreviewCardV309"
].join(",");

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function targetPriority(element: HTMLElement) {
  if (element.closest(".playerBar")) return 3;
  if (element.closest(".sidebar") || element.matches(".navItem")) return 3;
  if (element.matches(".heroMain,.heroGhost,.heroTinyButton,.expandLibraryButton,.homeShelfActionButton")) return 2.7;
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

type MotionPayload = {
  strength: number;
  velocityX: number;
  speed: number;
  priority: number;
};

function applyState(element: HTMLElement, payload: MotionPayload) {
  const priorityBoost = payload.priority >= 3 ? 1 : 0.82;
  const weightedStrength = clamp(payload.strength * priorityBoost, 0, 1);
  const safeSpeed = clamp(payload.speed, 0, 2.4);
  const safeVelocityX = clamp(payload.velocityX, -2.4, 2.4);

  const scale = 1 + weightedStrength * 0.018 + Math.min(safeSpeed * 0.0035, 0.008);
  const stretchX = 1 + Math.min(safeSpeed * 0.026, 0.045);
  const stretchY = 1 - Math.min(safeSpeed * 0.008, 0.014);
  const rotate = clamp(safeVelocityX * 1.85, -3.2, 3.2);
  const shiftX = clamp(safeVelocityX * 1.4, -3.5, 3.5);
  const glow = Math.round(weightedStrength * 8 + Math.min(safeSpeed * 4, 6));
  const bg = 0.004 + weightedStrength * 0.012 + Math.min(safeSpeed * 0.002, 0.005);
  const line = 0.06 + weightedStrength * 0.08 + Math.min(safeSpeed * 0.006, 0.018);

  // Very small blur only at high pointer speed. It gives a physical burst without
  // turning hover into an expensive blurry surface.
  const blur = safeSpeed > 1.15 ? Math.min((safeSpeed - 1.15) * 0.16, 0.24) : 0;

  const signature = [
    Math.round(scale * 10000),
    Math.round(stretchX * 10000),
    Math.round(stretchY * 10000),
    Math.round(rotate * 100),
    Math.round(shiftX * 100),
    Math.round(blur * 100),
    glow,
    Math.round(bg * 1000),
    Math.round(line * 1000)
  ].join(":");

  if (element.dataset.localtifyProxSignature === signature && element.classList.contains("localtifyProximityActive")) return;

  element.dataset.localtifyProxSignature = signature;
  element.classList.add("localtifyProximityTarget", "localtifyProximityActive", "localtifyVelocityMotion");
  element.style.setProperty("--prox-scale", scale.toFixed(4));
  element.style.setProperty("--prox-stretch-x", stretchX.toFixed(4));
  element.style.setProperty("--prox-stretch-y", stretchY.toFixed(4));
  element.style.setProperty("--prox-rotate", `${rotate.toFixed(2)}deg`);
  element.style.setProperty("--prox-shift-x", `${shiftX.toFixed(2)}px`);
  element.style.setProperty("--prox-blur", `${blur.toFixed(2)}px`);
  element.style.setProperty("--prox-glow-size", `${glow}px`);
  element.style.setProperty("--prox-bg", bg.toFixed(3));
  element.style.setProperty("--prox-line", line.toFixed(3));
}

function clearElement(element: HTMLElement) {
  element.classList.remove("localtifyProximityActive", "localtifyVelocityMotion");
  element.style.removeProperty("--prox-scale");
  element.style.removeProperty("--prox-stretch-x");
  element.style.removeProperty("--prox-stretch-y");
  element.style.removeProperty("--prox-rotate");
  element.style.removeProperty("--prox-shift-x");
  element.style.removeProperty("--prox-blur");
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
    let pendingPayload: MotionPayload = { strength: 0.76, velocityX: 0, speed: 0, priority: 2 };
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
      applyState(activeTarget, pendingPayload);
    };

    const schedulePaint = () => {
      if (frame || !visible || document.hidden) return;
      frame = window.requestAnimationFrame(paint);
    };

    const scheduleClear = (delay = 140) => {
      if (clearTimer) window.clearTimeout(clearTimer);
      clearTimer = window.setTimeout(() => {
        clearTimer = 0;
        clearActive();
      }, delay);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!visible || document.hidden || event.pointerType === "touch") return;

      const now = performance.now();
      const dt = Math.max(12, now - (lastMoveAt || now - 16));
      const dx = lastX === -9999 ? 0 : event.clientX - lastX;
      const dy = lastY === -9999 ? 0 : event.clientY - lastY;
      const moved = Math.abs(dx) + Math.abs(dy);
      const minInterval = isAudioPlaying() ? 34 : 20;

      if (moved < 3 && now - lastMoveAt < minInterval) return;
      if (now - lastMoveAt < minInterval) return;

      lastMoveAt = now;
      lastX = event.clientX;
      lastY = event.clientY;

      const target = findTarget(root, event.target);
      if (!target) {
        scheduleClear(isAudioPlaying() ? 180 : 120);
        return;
      }

      if (clearTimer) {
        window.clearTimeout(clearTimer);
        clearTimer = 0;
      }

      const priority = targetPriority(target);
      const velocityX = dx / dt;
      const speed = Math.sqrt(dx * dx + dy * dy) / dt;
      const velocityBoost = clamp(speed * 0.26, 0, 0.22);

      pendingTarget = target;
      pendingPayload = {
        strength: clamp((priority >= 3 ? 0.86 : 0.72) + velocityBoost, 0, 1),
        velocityX,
        speed,
        priority
      };
      schedulePaint();
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!visible || document.hidden || event.pointerType === "touch") return;
      const target = findTarget(root, event.target);
      if (!target) return;
      pendingTarget = target;
      pendingPayload = { strength: 1, velocityX: 0, speed: 0.75, priority: targetPriority(target) };
      schedulePaint();
    };

    const handlePointerOut = (event: PointerEvent) => {
      const next = event.relatedTarget instanceof Element ? event.relatedTarget : null;
      if (next && activeTarget && activeTarget.contains(next)) return;
      scheduleClear(120);
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
