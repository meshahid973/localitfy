/* localtify 0.3.8 V319 — stabilized physical proximity motion.
   Only sidebar / player / hero controls get velocity motion.
   Home cards and big lists stay out of the pointer hot path.
*/
import { useEffect, type RefObject } from "react";

type UseProximityMotionOptions = {
  rootRef: RefObject<HTMLElement | null>;
  disabled?: boolean;
  suspended?: boolean;
  resetKey?: string;
};

const BUTTON_SELECTOR = [
  ".sidebar button",
  ".sidebar .navItem",
  ".playerBar button",
  ".playerBar [role='button']",
  ".playerBar .circleButton",
  ".playerBar .playerButton",
  ".playerBar .playerControlButton",
  ".playerBar .repeatButton",
  ".playerBar .volumeIconButton",
  ".hero .heroMain",
  ".hero .heroGhost",
  ".hero .heroTinyButton",
  ".hero .expandLibraryButton",
  ".hero .homeShelfActionButton"
].join(",");

const SKIP_SELECTOR = [
  ".homeListenCard",
  ".homeFreshCard",
  ".homeAlbumCard",
  ".songRow",
  ".libraryRow",
  ".playlistTrackRow",
  ".playlistSongRow",
  ".albumCardV318",
  ".albumDetailPanelV318",
  ".albumTrackRowV318",
  ".albumBuilderPanelV318",
  ".coverGalleryCard",
  ".coverGalleryCardCleanOnly",
  ".coverSongPick",
  ".coverSongPickVirtual",
  ".settingSwitchCard",
  ".settingsChoice",
  ".settingsThemeCard",
  ".toggleRow",
  ".rangeRow",
  ".visualOptionButtonV205",
  ".settingsPanelCard",
  ".settingsPageCard",
  ".downloadsLayout",
  ".downloadPanel",
  ".downloadPanelV031",
  ".spotifyFlowPanelV256",
  ".albumFolderImportPanelV308",
  ".albumFolderImportPanelV309"
].join(",");

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isUsableTarget(root: HTMLElement, element: HTMLElement | null) {
  if (!element || !root.contains(element)) return false;
  if (element.matches(SKIP_SELECTOR) || element.closest(SKIP_SELECTOR)) return false;
  if (element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true") return false;
  return true;
}

function findTarget(root: HTMLElement, eventTarget: EventTarget | null) {
  if (!(eventTarget instanceof Element)) return null;
  const target = eventTarget.closest<HTMLElement>(BUTTON_SELECTOR);
  return isUsableTarget(root, target) ? target : null;
}

type MotionPayload = {
  scale: number;
  stretchX: number;
  stretchY: number;
  rotate: number;
  shiftX: number;
};

function targetPriority(element: HTMLElement) {
  if (element.closest(".playerBar")) return 1.12;
  if (element.closest(".sidebar")) return 1.06;
  if (element.closest(".hero")) return 0.98;
  return 0.9;
}

function buildPayload(velocityX: number, velocityY: number, speed: number, priority = 1): MotionPayload {
  // Physical feel from velocity, but clamped and transform-only.
  const vx = clamp(velocityX * priority, -1, 1);
  const vy = clamp(velocityY * priority, -0.75, 0.75);
  const safeSpeed = clamp(speed * priority, 0, 1.2);
  const stretch = Math.min(Math.abs(vx) * 0.08, 0.08);
  const squash = Math.min((Math.abs(vx) + Math.abs(vy)) * 0.012, 0.018);

  return {
    scale: 1 + Math.min(safeSpeed * 0.014, 0.022),
    stretchX: 1 + stretch,
    stretchY: 1 - squash,
    rotate: clamp(vx * 6, -6, 6),
    shiftX: clamp(vx * 3.2 + vy * 0.35, -4.2, 4.2)
  };
}

function restPayload(): MotionPayload {
  return { scale: 1.004, stretchX: 1, stretchY: 1, rotate: 0, shiftX: 0 };
}

function pressPayload(): MotionPayload {
  return { scale: 0.988, stretchX: 1.025, stretchY: 0.988, rotate: 0, shiftX: 0 };
}

function payloadSignature(payload: MotionPayload) {
  return [
    Math.round(payload.scale * 10000),
    Math.round(payload.stretchX * 10000),
    Math.round(payload.stretchY * 10000),
    Math.round(payload.rotate * 100),
    Math.round(payload.shiftX * 100)
  ].join(":");
}

function applyState(element: HTMLElement, payload: MotionPayload) {
  const signature = payloadSignature(payload);
  if (element.dataset.localtifyProxSignature === signature && element.classList.contains("localtifyProximityActive")) return;

  element.dataset.localtifyProxSignature = signature;
  element.classList.add("localtifyProximityTarget", "localtifyProximityActive", "localtifyVelocityMotion", "localtifyVelocityMotionV319");
  element.style.setProperty("--prox-scale", payload.scale.toFixed(4));
  element.style.setProperty("--prox-stretch-x", payload.stretchX.toFixed(4));
  element.style.setProperty("--prox-stretch-y", payload.stretchY.toFixed(4));
  element.style.setProperty("--prox-rotate", `${payload.rotate.toFixed(2)}deg`);
  element.style.setProperty("--prox-shift-x", `${payload.shiftX.toFixed(2)}px`);
}

function clearElement(element: HTMLElement) {
  element.classList.remove(
    "localtifyProximityActive",
    "localtifyVelocityMotion",
    "localtifyVelocityMotionV312",
    "localtifyVelocityMotionV316",
    "localtifyVelocityMotionV318",
    "localtifyVelocityMotionV319"
  );
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
    let settleTimer = 0;
    let clearTimer = 0;
    let activeTarget: HTMLElement | null = null;
    let pendingTarget: HTMLElement | null = null;
    let pendingPayload: MotionPayload | null = null;
    let lastX = 0;
    let lastY = 0;
    let lastMoveAt = 0;
    let visible = !document.hidden;

    const cancelFrame = () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    const clearTimers = () => {
      if (settleTimer) {
        window.clearTimeout(settleTimer);
        settleTimer = 0;
      }

      if (clearTimer) {
        window.clearTimeout(clearTimer);
        clearTimer = 0;
      }
    };

    const clearActive = () => {
      cancelFrame();
      clearTimers();

      if (activeTarget) clearElement(activeTarget);
      if (pendingTarget && pendingTarget !== activeTarget) clearElement(pendingTarget);

      activeTarget = null;
      pendingTarget = null;
      pendingPayload = null;
      lastMoveAt = 0;
    };

    const paint = () => {
      frame = 0;
      if (!visible || document.hidden || !pendingTarget || !pendingPayload) return;
      if (!isUsableTarget(root, pendingTarget)) return;

      if (activeTarget && activeTarget !== pendingTarget) {
        clearElement(activeTarget);
      }

      activeTarget = pendingTarget;
      applyState(activeTarget, pendingPayload);
    };

    const schedulePaint = () => {
      if (frame || !visible || document.hidden) return;
      frame = window.requestAnimationFrame(paint);
    };

    const settleActive = (delay = 120) => {
      if (settleTimer) window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        settleTimer = 0;
        if (!activeTarget || !isUsableTarget(root, activeTarget)) return;
        pendingTarget = activeTarget;
        pendingPayload = restPayload();
        schedulePaint();
      }, delay);
    };

    const scheduleClear = (delay = 150) => {
      if (clearTimer) window.clearTimeout(clearTimer);
      clearTimer = window.setTimeout(() => {
        clearTimer = 0;
        clearActive();
      }, delay);
    };

    const setTarget = (target: HTMLElement, clientX: number, clientY: number) => {
      if (clearTimer) {
        window.clearTimeout(clearTimer);
        clearTimer = 0;
      }

      pendingTarget = target;
      lastX = clientX;
      lastY = clientY;
      lastMoveAt = performance.now();
      pendingPayload = restPayload();
      schedulePaint();
    };

    const handlePointerOver = (event: PointerEvent) => {
      if (!visible || document.hidden || event.pointerType === "touch") return;
      const target = findTarget(root, event.target);
      if (!target) return;
      setTarget(target, event.clientX, event.clientY);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!visible || document.hidden || event.pointerType === "touch") return;

      const target = activeTarget && activeTarget.contains(event.target as Node) && isUsableTarget(root, activeTarget)
        ? activeTarget
        : findTarget(root, event.target);

      if (!target) {
        scheduleClear(150);
        return;
      }

      if (clearTimer) {
        window.clearTimeout(clearTimer);
        clearTimer = 0;
      }

      const now = performance.now();
      const dt = clamp(now - (lastMoveAt || now - 16), 10, 64);
      const dx = lastMoveAt ? event.clientX - lastX : 0;
      const dy = lastMoveAt ? event.clientY - lastY : 0;
      const moved = Math.abs(dx) + Math.abs(dy);

      lastMoveAt = now;
      lastX = event.clientX;
      lastY = event.clientY;

      if (moved < 0.35 && activeTarget === target) return;

      const velocityX = dx / dt;
      const velocityY = dy / dt;
      const speed = Math.sqrt(dx * dx + dy * dy) / dt;

      pendingTarget = target;
      pendingPayload = buildPayload(velocityX, velocityY, speed, targetPriority(target));
      schedulePaint();
      settleActive(115);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!visible || document.hidden || event.pointerType === "touch") return;
      const target = activeTarget && activeTarget.contains(event.target as Node) && isUsableTarget(root, activeTarget)
        ? activeTarget
        : findTarget(root, event.target);
      if (!target) return;

      pendingTarget = target;
      pendingPayload = pressPayload();
      schedulePaint();
    };

    const handlePointerUp = () => {
      if (!activeTarget) return;
      pendingTarget = activeTarget;
      pendingPayload = restPayload();
      schedulePaint();
      settleActive(90);
    };

    const handlePointerOut = (event: PointerEvent) => {
      if (!activeTarget) return;
      const next = event.relatedTarget instanceof Element ? event.relatedTarget : null;
      if (next && activeTarget.contains(next)) return;
      const nextTarget = next ? findTarget(root, next) : null;
      if (nextTarget === activeTarget) return;
      scheduleClear(150);
    };

    const handleVisibilityChange = () => {
      visible = !document.hidden;
      clearActive();
    };

    root.addEventListener("pointerover", handlePointerOver, { passive: true });
    root.addEventListener("pointermove", handlePointerMove, { passive: true });
    root.addEventListener("pointerdown", handlePointerDown, { passive: true });
    root.addEventListener("pointerup", handlePointerUp, { passive: true });
    root.addEventListener("pointerout", handlePointerOut, { passive: true });
    root.addEventListener("pointerleave", clearActive, { passive: true });
    window.addEventListener("blur", clearActive, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      root.removeEventListener("pointerover", handlePointerOver);
      root.removeEventListener("pointermove", handlePointerMove);
      root.removeEventListener("pointerdown", handlePointerDown);
      root.removeEventListener("pointerup", handlePointerUp);
      root.removeEventListener("pointerout", handlePointerOut);
      root.removeEventListener("pointerleave", clearActive);
      window.removeEventListener("blur", clearActive);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearActive();
    };
  }, [disabled, resetKey, rootRef, suspended]);
}
