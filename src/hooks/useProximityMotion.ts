import { useEffect, useRef } from "react";
import type { RefObject } from "react";

type UseProximityMotionOptions = {
  rootRef: RefObject<HTMLElement | null>;
  disabled?: boolean;
  suspended?: boolean;
  resetKey?: string;
};

const TARGET_SELECTOR = [
  ".songCard",
  ".homeAlbumCard",
  ".libraryCard",
  ".libraryCardV025",
  ".playlistShelfCard",
  ".playlistPanel",
  ".settingsPageCard",
  ".settingsPanelCard",
  ".settingsCard",
  ".settingsThemeCard",
  ".updateSettingsCard",
  ".navItem",
  ".mainAction",
  ".heroMain",
  ".heroGhost",
  ".softButton",
  ".simpleAction",
  ".simpleGhost",
  ".toolButton",
  ".iconAction",
  ".tabButton",
  ".navButton",
  ".tinyToggle",
  ".songMenuButton",
  ".circleButton"
].join(",");

const BLOCKED_SELECTOR = [
  ".localtifyStarsBackdrop",
  ".playerBar",
  ".titleBar",
  ".windowButtons",
  ".updateToastLayer",
  ".toastHost",
  ".topUpdateRibbonLayer",
  "input",
  "textarea",
  "select",
  "option",
  "[contenteditable='true']"
].join(",");

const PROX_PROPERTIES = [
  "--prox",
  "--prox-scale",
  "--prox-line",
  "--prox-bg",
  "--prox-glow-size",
  "--prox-card-y",
  "--prox-button-y",
  "--prox-x",
  "--prox-y"
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function smoothStep(value: number) {
  return value * value * (3 - 2 * value);
}

function isActionTarget(element: HTMLElement) {
  return element.matches(
    ".navItem,.mainAction,.heroMain,.heroGhost,.softButton,.simpleAction,.simpleGhost,.toolButton,.iconAction,.tabButton,.navButton,.tinyToggle,.songMenuButton,.circleButton"
  );
}

function closestTarget(root: HTMLElement, value: EventTarget | Element | null): HTMLElement | null {
  if (!(value instanceof Element)) return null;
  const target = value.closest<HTMLElement>(TARGET_SELECTOR);
  if (!target || !root.contains(target) || target.closest(BLOCKED_SELECTOR)) return null;
  if (target.offsetWidth < 8 || target.offsetHeight < 8) return null;
  return target;
}

export function useProximityMotion({ rootRef, disabled = false, suspended = false, resetKey = "" }: UseProximityMotionOptions) {
  const disabledRef = useRef(disabled);
  const suspendedRef = useRef(suspended);
  const activeElementsRef = useRef<Set<HTMLElement>>(new Set());
  const frameRef = useRef<number | null>(null);
  const pauseUntilRef = useRef(0);
  const latestPointerRef = useRef({ x: -9999, y: -9999, target: null as EventTarget | null, buttons: 0 });
  const lastAppliedRef = useRef({ x: -9999, y: -9999, target: null as HTMLElement | null });

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => {
    suspendedRef.current = suspended;
  }, [suspended]);

  useEffect(() => {
    const clearElement = (element: HTMLElement) => {
      element.classList.remove("localtifyProximityActive", "localtifyProximityTarget");
      PROX_PROPERTIES.forEach((property) => element.style.removeProperty(property));
      activeElementsRef.current.delete(element);
    };

    activeElementsRef.current.forEach((element) => clearElement(element));
  }, [resetKey]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof window === "undefined") return;

    const clearElement = (element: HTMLElement) => {
      element.classList.remove("localtifyProximityActive", "localtifyProximityTarget");
      PROX_PROPERTIES.forEach((property) => element.style.removeProperty(property));
      activeElementsRef.current.delete(element);
    };

    const clearAll = () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      activeElementsRef.current.forEach((element) => clearElement(element));
      lastAppliedRef.current = { x: -9999, y: -9999, target: null };
    };

    const addCandidate = (items: HTMLElement[], element: HTMLElement | null) => {
      if (!element || items.includes(element)) return;
      if (!root.contains(element) || element.closest(BLOCKED_SELECTOR)) return;
      if (element.offsetWidth < 8 || element.offsetHeight < 8) return;
      items.push(element);
    };

    const addSiblingCandidates = (items: HTMLElement[], target: HTMLElement) => {
      const parent = target.parentElement;
      if (!parent) return;

      const siblings = Array.from(parent.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
      const index = siblings.indexOf(target);
      if (index < 0) return;

      addCandidate(items, siblings[index - 1]?.closest?.(TARGET_SELECTOR) as HTMLElement | null);
      addCandidate(items, siblings[index + 1]?.closest?.(TARGET_SELECTOR) as HTMLElement | null);
    };

    const applyMotion = () => {
      frameRef.current = null;

      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      const { x, y, target, buttons } = latestPointerRef.current;

      if (disabledRef.current || suspendedRef.current || buttons !== 0 || now < pauseUntilRef.current) {
        clearAll();
        return;
      }

      const primary = closestTarget(root, target);
      if (!primary) {
        clearAll();
        return;
      }

      const last = lastAppliedRef.current;
      if (last.target === primary && Math.abs(x - last.x) < 1.2 && Math.abs(y - last.y) < 1.2) return;
      lastAppliedRef.current = { x, y, target: primary };

      const candidates: HTMLElement[] = [];
      addCandidate(candidates, primary);
      addSiblingCandidates(candidates, primary);

      const nextActive = new Set<HTMLElement>();

      for (const element of candidates.slice(0, 3)) {
        const rect = element.getBoundingClientRect();
        if (rect.width < 8 || rect.height < 8) continue;

        const outsideX = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
        const outsideY = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
        const edgeDistance = Math.hypot(outsideX, outsideY);
        const action = isActionTarget(element);
        const reach = action ? 78 : clamp(Math.max(rect.width, rect.height) * 0.12 + 66, 84, 124);
        const raw = clamp(1 - edgeDistance / reach, 0, 1);
        const proximity = smoothStep(raw);

        if (proximity < 0.08) continue;

        const localX = clamp(((x - rect.left) / Math.max(1, rect.width)) * 100, 0, 100);
        const localY = clamp(((y - rect.top) / Math.max(1, rect.height)) * 100, 0, 100);
        const scale = 1 + proximity * (action ? 0.015 : 0.01);
        const lift = proximity * (action ? -1.2 : -1.7);

        element.classList.add("localtifyProximityTarget", "localtifyProximityActive");
        element.style.setProperty("--prox", proximity.toFixed(3));
        element.style.setProperty("--prox-scale", scale.toFixed(4));
        element.style.setProperty("--prox-line", (0.08 + proximity * 0.1).toFixed(3));
        element.style.setProperty("--prox-bg", (proximity * 0.022).toFixed(3));
        element.style.setProperty("--prox-glow-size", `${(proximity * 12).toFixed(2)}px`);
        element.style.setProperty("--prox-card-y", `${lift.toFixed(2)}px`);
        element.style.setProperty("--prox-button-y", `${(lift * 0.72).toFixed(2)}px`);
        element.style.setProperty("--prox-x", `${localX.toFixed(2)}%`);
        element.style.setProperty("--prox-y", `${localY.toFixed(2)}%`);

        activeElementsRef.current.add(element);
        nextActive.add(element);
      }

      activeElementsRef.current.forEach((element) => {
        if (!nextActive.has(element)) clearElement(element);
      });
    };

    const schedule = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;

      latestPointerRef.current = {
        x: event.clientX,
        y: event.clientY,
        target: event.target,
        buttons: event.buttons
      };

      if (frameRef.current === null) frameRef.current = window.requestAnimationFrame(applyMotion);
    };

    const pauseForInput = () => {
      pauseUntilRef.current = (typeof performance !== "undefined" ? performance.now() : Date.now()) + 170;
      clearAll();
    };

    root.addEventListener("pointermove", schedule, { passive: true });
    root.addEventListener("pointerdown", pauseForInput, { passive: true, capture: true });
    root.addEventListener("pointerup", pauseForInput, { passive: true, capture: true });
    root.addEventListener("pointercancel", clearAll, { passive: true });
    root.addEventListener("pointerleave", clearAll, { passive: true });
    window.addEventListener("blur", clearAll);
    window.addEventListener("scroll", clearAll, true);

    return () => {
      root.removeEventListener("pointermove", schedule);
      root.removeEventListener("pointerdown", pauseForInput, { capture: true });
      root.removeEventListener("pointerup", pauseForInput, { capture: true });
      root.removeEventListener("pointercancel", clearAll);
      root.removeEventListener("pointerleave", clearAll);
      window.removeEventListener("blur", clearAll);
      window.removeEventListener("scroll", clearAll, true);
      clearAll();
    };
  }, [rootRef]);
}
