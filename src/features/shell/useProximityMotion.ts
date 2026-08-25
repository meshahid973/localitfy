import { useEffect, type RefObject } from "react";

type UseProximityMotionOptions = {
  rootRef: RefObject<HTMLElement | null>;
  disabled?: boolean;
  suspended?: boolean;
  resetKey?: string;
};

const LEGACY_PROXIMITY_SELECTOR = [
  ".localtifyProximityTarget",
  ".localtifyProximityActive",
  ".localtifyVelocityMotion",
  "[data-localtify-prox-signature]"
].join(",");

const LEGACY_CLASSES = [
  "localtifyProximityTarget",
  "localtifyProximityActive",
  "localtifyVelocityMotion",
  "localtifyVelocityMotionV312",
  "localtifyVelocityMotionV316",
  "localtifyVelocityMotionV318",
  "localtifyVelocityMotionV320",
  "localtifyVelocityMotionV430"
] as const;

const LEGACY_PROPERTIES = [
  "--prox-scale",
  "--prox-stretch-x",
  "--prox-stretch-y",
  "--prox-rotate",
  "--prox-shift-x",
  "--prox-shift-y",
  "--prox-glow",
  "--prox-duration",
  "--prox-blur",
  "--prox-glow-size",
  "--prox-bg",
  "--prox-line"
] as const;

function clearLegacyProximityState(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>(LEGACY_PROXIMITY_SELECTOR).forEach((element) => {
    element.classList.remove(...LEGACY_CLASSES);
    LEGACY_PROPERTIES.forEach((property) => element.style.removeProperty(property));
    delete element.dataset.localtifyProxSignature;
  });
}

/**
 * Localtify previously ran pointer geometry + requestAnimationFrame work on every
 * pointer move across the renderer. That interaction was visually minor but kept
 * layout/compositor work on the hottest input path. Motion is now CSS-owned.
 *
 * Keep this hook as the shell ownership boundary so callers do not need to know
 * about the retired implementation. It only removes stale state once after a
 * hot reload/theme reset and installs no pointer listeners or animation loop.
 */
export function useProximityMotion({ rootRef, resetKey = "" }: UseProximityMotionOptions) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    clearLegacyProximityState(root);
  }, [rootRef, resetKey]);
}
