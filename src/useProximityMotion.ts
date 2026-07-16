/* localtify 0.4.2 V430 â€” dynamic physical proximity motion.
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

type MotionDebugState = {
  active: boolean;
  zone: string;
  target: string;
  skipped: string;
  frameCostMs: number;
};

declare global {
  interface Window {
    __localtifyMotionDebugOverlay?: HTMLElement;
    __localtifyMotionDebugLast?: MotionDebugState;
  }
}

function motionDebugEnabled() {
  try {
    return window.localStorage.getItem("localtify:motionDebug") === "1";
  } catch {
    return false;
  }
}

function ensureMotionDebugOverlay() {
  if (!motionDebugEnabled()) return null;
  let element = window.__localtifyMotionDebugOverlay;
  if (element && document.body.contains(element)) return element;

  element = document.createElement("aside");
  element.className = "localtifyMotionDebugOverlayV503";
  element.setAttribute("aria-hidden", "true");
  element.style.cssText = [
    "position:fixed",
    "right:12px",
    "bottom:12px",
    "z-index:2147483647",
    "min-width:220px",
    "max-width:320px",
    "padding:10px 12px",
    "border-radius:14px",
    "border:1px solid rgba(255,255,255,.14)",
    "background:rgba(4,5,8,.88)",
    "color:rgba(255,255,255,.88)",
    "font:700 11px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace",
    "box-shadow:0 18px 44px rgba(0,0,0,.42)",
    "backdrop-filter:blur(14px) saturate(120%)",
    "pointer-events:none",
    "white-space:pre-wrap"
  ].join(";");
  document.body.appendChild(element);
  window.__localtifyMotionDebugOverlay = element;
  return element;
}

function motionZoneForElement(element: HTMLElement | null) {
  if (!element) return "none";
  if (element.closest(".playerBar")) return "player";
  if (element.closest(".sidebar")) return "sidebar";
  if (element.closest(".hero")) return "hero";
  if (element.closest(".downloadsLayout,.downloadPanel")) return "downloads-skipped";
  if (element.closest(".settingsPage,.settingsShell,.settingsModal")) return "settings-skipped";
  if (element.closest(".libraryRow,.songRow,.homeListenCard,.homeFreshCard,.homeAlbumCard")) return "list-skipped";
  return "other";
}

function motionTargetLabel(element: HTMLElement | null) {
  if (!element) return "none";
  const text = String(element.getAttribute("aria-label") || element.getAttribute("title") || element.textContent || "").trim().replace(/\s+/g, " ");
  const className = String(element.className || "").replace(/\s+/g, ".");
  return (text || element.tagName.toLowerCase() + (className ? "." + className.slice(0, 72) : "")).slice(0, 96);
}

function motionSkipReason(root: HTMLElement, eventTarget: EventTarget | null) {
  if (!(eventTarget instanceof Element)) return "non-element";
  const target = eventTarget.closest<HTMLElement>(BUTTON_SELECTOR);
  if (!target) return "no allowed button";
  if (!root.contains(target)) return "outside root";
  if (!isInsideAllowedMotionZone(target)) return motionZoneForElement(target);
  if (target.matches(SKIP_SELECTOR) || target.closest(SKIP_SELECTOR)) return "skip selector";
  if (target.hasAttribute("disabled") || target.getAttribute("aria-disabled") === "true") return "disabled";
  return "unknown";
}

function publishMotionDebug(state: MotionDebugState) {
  if (!motionDebugEnabled()) return;
  window.__localtifyMotionDebugLast = state;
  window.dispatchEvent(new CustomEvent("localtify:motion-debug", { detail: state }));
  const overlay = ensureMotionDebugOverlay();
  if (!overlay) return;
  overlay.textContent = [
    "motion debug",
    `active: ${state.active ? "yes" : "no"}`,
    `zone: ${state.zone}`,
    `target: ${state.target}`,
    `skipped: ${state.skipped || "no"}`,
    `frame: ${state.frameCostMs.toFixed(2)}ms`
  ].join("\n");
}

function removeMotionDebugOverlay() {
  const element = window.__localtifyMotionDebugOverlay;
  if (element && element.parentElement) element.parentElement.removeChild(element);
  delete window.__localtifyMotionDebugOverlay;
}


function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isInsideAllowedMotionZone(element: HTMLElement) {
  return Boolean(element.closest(".sidebar, .playerBar, .hero"));
}

function isUsableTarget(root: HTMLElement, element: HTMLElement | null) {
  if (!element || !root.contains(element)) return false;
  if (!isInsideAllowedMotionZone(element)) return false;
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
  shiftY: number;
  glow: number;
  durationMs: number;
};

function targetPriority(element: HTMLElement) {
  if (element.closest(".playerBar")) return 1.15;
  if (element.closest(".sidebar")) return 1.08;
  if (element.closest(".hero")) return 1.02;
  return 0.94;
}

function readPointerGeometry(element: HTMLElement, clientX: number, clientY: number, cachedRect?: DOMRect) {
  const rect = cachedRect || element.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const centerX = rect.left + width / 2;
  const centerY = rect.top + height / 2;

  const localX = clamp((clientX - centerX) / (width / 2), -1, 1);
  const localY = clamp((clientY - centerY) / (height / 2), -1, 1);
  const distance = clamp(Math.sqrt(localX * localX + localY * localY), 0, 1.4);

  return { localX, localY, distance, width, height };
}

function buildPayload(
  velocityX: number,
  velocityY: number,
  speed: number,
  priority = 1,
  geometry = { localX: 0, localY: 0, distance: 0, width: 44, height: 44 }
): MotionPayload {
  // Dynamic feel: velocity controls stretch, pointer position controls lean/shift,
  // target size changes the max movement, and speed changes settle timing.
  const vx = clamp(velocityX * priority, -1.25, 1.25);
  const vy = clamp(velocityY * priority, -1, 1);
  const safeSpeed = clamp(speed * priority, 0, 1.45);
  const edgePull = clamp(geometry.distance, 0, 1.25);
  const sizeBoost = clamp((geometry.width + geometry.height) / 140, 0.72, 1.32);

  const stretch = Math.min((Math.abs(vx) * 0.07 + safeSpeed * 0.025) * sizeBoost, 0.115);
  const squash = Math.min((Math.abs(vx) + Math.abs(vy) + edgePull) * 0.012, 0.026);
  const lean = clamp((vx * 4.8 + geometry.localX * 3.2) * sizeBoost, -7.5, 7.5);
  const shiftX = clamp((vx * 3.5 + geometry.localX * 2.8) * sizeBoost, -5.8, 5.8);
  const shiftY = clamp((vy * 2.2 + geometry.localY * 1.8) * sizeBoost, -3.6, 3.6);

  return {
    scale: 1 + Math.min((safeSpeed * 0.014 + edgePull * 0.007) * sizeBoost, 0.034),
    stretchX: 1 + stretch,
    stretchY: 1 - squash,
    rotate: lean,
    shiftX,
    shiftY,
    glow: clamp(0.08 + safeSpeed * 0.22 + edgePull * 0.12, 0.08, 0.42),
    durationMs: Math.round(clamp(260 - safeSpeed * 82, 130, 260))
  };
}

function restPayload(): MotionPayload {
  return { scale: 1.004, stretchX: 1, stretchY: 1, rotate: 0, shiftX: 0, shiftY: 0, glow: 0.08, durationMs: 230 };
}

function pressPayload(): MotionPayload {
  return { scale: 0.982, stretchX: 1.03, stretchY: 0.982, rotate: 0, shiftX: 0, shiftY: 0.6, glow: 0.22, durationMs: 120 };
}

function payloadSignature(payload: MotionPayload) {
  return [
    Math.round(payload.scale * 10000),
    Math.round(payload.stretchX * 10000),
    Math.round(payload.stretchY * 10000),
    Math.round(payload.rotate * 100),
    Math.round(payload.shiftX * 100),
    Math.round(payload.shiftY * 100),
    Math.round(payload.glow * 1000),
    Math.round(payload.durationMs)
  ].join(":");
}

function applyState(element: HTMLElement, payload: MotionPayload) {
  const signature = payloadSignature(payload);
  if (element.dataset.localtifyProxSignature === signature && element.classList.contains("localtifyProximityActive")) return;

  element.dataset.localtifyProxSignature = signature;
  element.classList.add("localtifyProximityTarget", "localtifyProximityActive", "localtifyVelocityMotion", "localtifyVelocityMotionV320", "localtifyVelocityMotionV430");
  element.style.setProperty("--prox-scale", payload.scale.toFixed(4));
  element.style.setProperty("--prox-stretch-x", payload.stretchX.toFixed(4));
  element.style.setProperty("--prox-stretch-y", payload.stretchY.toFixed(4));
  element.style.setProperty("--prox-rotate", `${payload.rotate.toFixed(2)}deg`);
  element.style.setProperty("--prox-shift-x", `${payload.shiftX.toFixed(2)}px`);
  element.style.setProperty("--prox-shift-y", `${payload.shiftY.toFixed(2)}px`);
  element.style.setProperty("--prox-glow", payload.glow.toFixed(3));
  element.style.setProperty("--prox-duration", `${payload.durationMs}ms`);
}

function clearElement(element: HTMLElement) {
  element.classList.remove(
    "localtifyProximityActive",
    "localtifyVelocityMotion",
    "localtifyVelocityMotionV312",
    "localtifyVelocityMotionV316",
    "localtifyVelocityMotionV318",
    "localtifyVelocityMotionV320",
    "localtifyVelocityMotionV430"
  );
  element.style.removeProperty("--prox-scale");
  element.style.removeProperty("--prox-stretch-x");
  element.style.removeProperty("--prox-stretch-y");
  element.style.removeProperty("--prox-rotate");
  element.style.removeProperty("--prox-shift-x");
  element.style.removeProperty("--prox-shift-y");
  element.style.removeProperty("--prox-glow");
  element.style.removeProperty("--prox-duration");
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
    let geometryTarget: HTMLElement | null = null;
    let geometryRect: DOMRect | null = null;
    let geometryReadAt = 0;

    const readCachedGeometry = (target: HTMLElement, clientX: number, clientY: number) => {
      const now = performance.now();
      if (geometryTarget !== target || !geometryRect || now - geometryReadAt > 180) {
        geometryTarget = target;
        geometryRect = target.getBoundingClientRect();
        geometryReadAt = now;
      }

      return readPointerGeometry(target, clientX, clientY, geometryRect);
    };

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
      geometryTarget = null;
      geometryRect = null;
      geometryReadAt = 0;
      lastMoveAt = 0;
      publishMotionDebug({ active: false, zone: "none", target: "none", skipped: "cleared", frameCostMs: 0 });
    };

    const paint = () => {
      frame = 0;
      const paintStartedAt = performance.now();
      if (!visible || document.hidden || !pendingTarget || !pendingPayload) return;
      if (!isUsableTarget(root, pendingTarget)) return;

      if (activeTarget && activeTarget !== pendingTarget) {
        clearElement(activeTarget);
      }

      activeTarget = pendingTarget;
      applyState(activeTarget, pendingPayload);
      publishMotionDebug({
        active: true,
        zone: motionZoneForElement(activeTarget),
        target: motionTargetLabel(activeTarget),
        skipped: "no",
        frameCostMs: performance.now() - paintStartedAt
      });
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
      const eventElement = event.target instanceof Element ? event.target : null;
      if (!eventElement?.closest(".sidebar, .playerBar, .hero")) return;
      const target = findTarget(root, event.target);
      if (!target) {
        publishMotionDebug({ active: false, zone: motionZoneForElement(event.target instanceof HTMLElement ? event.target : null), target: "none", skipped: motionSkipReason(root, event.target), frameCostMs: 0 });
        return;
      }
      setTarget(target, event.clientX, event.clientY);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!visible || document.hidden || event.pointerType === "touch") return;
      const eventElement = event.target instanceof Element ? event.target : null;
      if (!activeTarget && !eventElement?.closest(".sidebar, .playerBar, .hero")) return;

      const target = activeTarget && activeTarget.contains(event.target as Node) && isUsableTarget(root, activeTarget)
        ? activeTarget
        : findTarget(root, event.target);

      if (!target) {
        publishMotionDebug({ active: false, zone: motionZoneForElement(event.target instanceof HTMLElement ? event.target : null), target: "none", skipped: motionSkipReason(root, event.target), frameCostMs: 0 });
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
      pendingPayload = buildPayload(
        velocityX,
        velocityY,
        speed,
        targetPriority(target),
        readCachedGeometry(target, event.clientX, event.clientY)
      );
      schedulePaint();
      settleActive(115);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!visible || document.hidden || event.pointerType === "touch") return;
      const target = activeTarget && activeTarget.contains(event.target as Node) && isUsableTarget(root, activeTarget)
        ? activeTarget
        : findTarget(root, event.target);
      if (!target) {
        publishMotionDebug({ active: false, zone: motionZoneForElement(event.target instanceof HTMLElement ? event.target : null), target: "none", skipped: motionSkipReason(root, event.target), frameCostMs: 0 });
        return;
      }

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
      removeMotionDebugOverlay();
    };
  }, [disabled, resetKey, rootRef, suspended]);
}


