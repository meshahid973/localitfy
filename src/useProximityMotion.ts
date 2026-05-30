import { useEffect, useRef } from "react";
import type { RefObject } from "react";

type UseProximityMotionOptions = {
  rootRef: RefObject<HTMLElement | null>;
  disabled?: boolean;
  suspended?: boolean;
  resetKey?: string;
};

const CARD_SELECTOR = [
  ".songCard",
  ".homeAlbumCard",
  ".libraryCard",
  ".libraryCardV025",
  ".playlistShelfCard",
  ".playlistPanel",
  ".playlistTrackRow",
  ".settingsPageCard",
  ".settingsPanelCard",
  ".settingsCard",
  ".settingsThemeCard",
  ".updateSettingsCard"
].join(",");

const ACTION_SELECTOR = [
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
  ".tinyToggle"
].join(",");

const TARGET_SELECTOR = `${CARD_SELECTOR},${ACTION_SELECTOR}`;

const BLOCKED_SELECTOR = [
  ".localtifyStarsBackdrop",
  ".playerBar",
  ".titleBar",
  ".windowButtons",
  ".resizeHandle",
  ".settingsOverlay input",
  ".settingsOverlay textarea",
  ".settingsOverlay select",
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
  "--prox-x",
  "--prox-y"
] as const;

const EMPTY_POINTER = { x: -9999, y: -9999, target: null as EventTarget | null, buttons: 0 };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function smoothStep(value: number) {
  return value * value * (3 - 2 * value);
}

function isActionTarget(element: HTMLElement) {
  return element.matches(ACTION_SELECTOR);
}

function clearElement(element: HTMLElement) {
  element.classList.remove("localtifyProximityActive", "localtifyProximityTarget");
  for (const property of PROX_PROPERTIES) element.style.removeProperty(property);
}

function findTarget(root: HTMLElement, value: Element | EventTarget | null): HTMLElement | null {
  if (!(value instanceof Element)) return null;
  const target = value.closest<HTMLElement>(TARGET_SELECTOR);
  if (!target || !root.contains(target)) return null;
  if (target.closest(BLOCKED_SELECTOR)) return null;
  return target;
}

function collectSiblingTargets(root: HTMLElement, primary: HTMLElement, limit: number) {
  const candidates: HTMLElement[] = [primary];
  const parent = primary.parentElement;

  if (!parent || limit <= 1) return candidates;

  const children = Array.from(parent.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
  const index = children.indexOf(primary);
  if (index < 0) return candidates;

  const add = (candidate: HTMLElement | null) => {
    if (!candidate || candidates.length >= limit || candidates.includes(candidate)) return;
    const target = findTarget(root, candidate);
    if (target && !candidates.includes(target)) candidates.push(target);
  };

  add(children[index - 1] ?? null);
  add(children[index + 1] ?? null);

  return candidates;
}

export function useProximityMotion({
  rootRef,
  disabled = false,
  suspended = false,
  resetKey = ""
}: UseProximityMotionOptions) {
  const disabledRef = useRef(disabled);
  const suspendedRef = useRef(suspended);
  const activeRef = useRef<Set<HTMLElement>>(new Set());
  const frameRef = useRef<number | null>(null);
  const latestRef = useRef(EMPTY_POINTER);
  const lastApplyRef = useRef({ x: -9999, y: -9999, target: null as HTMLElement | null });
  const valuesRef = useRef<WeakMap<HTMLElement, string>>(new WeakMap());

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => {
    suspendedRef.current = suspended;
  }, [suspended]);

  useEffect(() => {
    for (const element of activeRef.current) clearElement(element);
    activeRef.current.clear();
    lastApplyRef.current = { x: -9999, y: -9999, target: null };
  }, [resetKey]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof window === "undefined") return;

    const clearAll = () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      for (const element of activeRef.current) clearElement(element);
      activeRef.current.clear();
      latestRef.current = EMPTY_POINTER;
      lastApplyRef.current = { x: -9999, y: -9999, target: null };
    };

    const applyMotion = () => {
      frameRef.current = null;

      const { x, y, target, buttons } = latestRef.current;
      if (disabledRef.current || suspendedRef.current || buttons !== 0) {
        clearAll();
        return;
      }

      const primary = findTarget(root, target);
      const last = lastApplyRef.current;
      if (last.target === primary && Math.abs(x - last.x) < 3.5 && Math.abs(y - last.y) < 3.5) return;
      lastApplyRef.current = { x, y, target: primary };

      if (!primary) {
        clearAll();
        return;
      }

      const candidates = collectSiblingTargets(root, primary, isActionTarget(primary) ? 1 : 3);
      const nextActive = new Set<HTMLElement>();

      for (const element of candidates) {
        const rect = element.getBoundingClientRect();
        if (rect.width < 8 || rect.height < 8) continue;

        const outsideX = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
        const outsideY = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
        const edgeDistance = Math.hypot(outsideX, outsideY);
        const action = isActionTarget(element);
        const reach = action ? 54 : clamp(Math.max(rect.width, rect.height) * 0.08 + 46, 62, 94);
        const raw = clamp(1 - edgeDistance / reach, 0, 1);
        const proximity = smoothStep(raw);

        if (proximity < 0.12) continue;

        const localX = clamp(((x - rect.left) / Math.max(1, rect.width)) * 100, 0, 100);
        const localY = clamp(((y - rect.top) / Math.max(1, rect.height)) * 100, 0, 100);
        const scale = 1 + proximity * (action ? 0.006 : 0.0065);
        const line = 0.06 + proximity * 0.06;
        const bg = proximity * (action ? 0.012 : 0.01);
        const glow = proximity * (action ? 3.5 : 4.5);
        const signature = `${proximity.toFixed(2)}:${scale.toFixed(3)}:${localX.toFixed(0)}:${localY.toFixed(0)}`;

        if (valuesRef.current.get(element) !== signature) {
          element.classList.add("localtifyProximityTarget", "localtifyProximityActive");
          element.style.setProperty("--prox", proximity.toFixed(3));
          element.style.setProperty("--prox-scale", scale.toFixed(4));
          element.style.setProperty("--prox-line", line.toFixed(3));
          element.style.setProperty("--prox-bg", bg.toFixed(3));
          element.style.setProperty("--prox-glow-size", `${glow.toFixed(2)}px`);
          element.style.setProperty("--prox-x", `${localX.toFixed(0)}%`);
          element.style.setProperty("--prox-y", `${localY.toFixed(0)}%`);
          valuesRef.current.set(element, signature);
        }

        nextActive.add(element);
      }

      for (const element of activeRef.current) {
        if (!nextActive.has(element)) {
          clearElement(element);
          valuesRef.current.delete(element);
        }
      }

      activeRef.current = nextActive;
    };

    const schedule = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;

      latestRef.current = {
        x: event.clientX,
        y: event.clientY,
        target: event.target,
        buttons: event.buttons
      };

      if (frameRef.current === null) frameRef.current = window.requestAnimationFrame(applyMotion);
    };

    const clearSoon = () => {
      if (!activeRef.current.size) return;
      if (frameRef.current === null) frameRef.current = window.requestAnimationFrame(clearAll);
    };

    root.addEventListener("pointermove", schedule, { passive: true });
    root.addEventListener("pointerleave", clearAll, { passive: true });
    root.addEventListener("pointercancel", clearAll, { passive: true });
    window.addEventListener("blur", clearAll);
    window.addEventListener("scroll", clearSoon, true);

    return () => {
      root.removeEventListener("pointermove", schedule);
      root.removeEventListener("pointerleave", clearAll);
      root.removeEventListener("pointercancel", clearAll);
      window.removeEventListener("blur", clearAll);
      window.removeEventListener("scroll", clearSoon, true);
      clearAll();
    };
  }, [rootRef]);
}
