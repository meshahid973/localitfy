import { useLayoutEffect, useMemo, useRef } from "react";

/** Keep keyboard focus inside the topmost modal, including stacked delete confirmations. */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useModalFocus<T extends HTMLElement = HTMLDivElement>(active: boolean) {
  const dialogRef = useRef<T>(null);
  // Capture during the opening render, before React commits child autoFocus.
  const previouslyFocused = useMemo(() => active && typeof document !== "undefined" ? document.activeElement : null, [active]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!active || !dialog) return;

    const topmostModal = () => Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]')).at(-1);
    const isTopmost = () => topmostModal() === dialog;
    // A modal's device menu is portaled outside its clipped surface.
    const scopes = () => [dialog, ...Array.from(dialog.querySelectorAll<HTMLElement>('[aria-controls]'))
      .flatMap((control) => (control.getAttribute("aria-controls") || "").split(/\s+/))
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element.getAttribute("role") === "menu" && !dialog.contains(element))];
    const contains = (target: Node | null) => scopes().some((scope) => scope.contains(target));
    const focusable = () => scopes().flatMap((scope) => Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE)))
      .filter((element) => element.getClientRects().length > 0 && !element.closest("[hidden], [inert]"));
    const focusFirst = () => {
      // React autoFocus runs before this effect; do not override an already-focused input.
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== dialog && contains(active)) return;
      (focusable()[0] ?? dialog).focus({ preventScroll: true });
    };

    if (isTopmost()) focusFirst();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !isTopmost()) return;
      const options = focusable();
      if (!options.length) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }
      const first = options[0];
      const last = options[options.length - 1];
      const current = document.activeElement;
      if (event.shiftKey && (current === first || !contains(current))) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && (current === last || !contains(current) || current === dialog)) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    const onFocusIn = (event: FocusEvent) => {
      if (!isTopmost()) return;
      if (event.target instanceof Node && !contains(event.target)) focusFirst();
    };

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocusIn, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusIn, true);
      const topmost = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]')).filter((modal) => modal !== dialog).at(-1);
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected &&
        !dialog.contains(previouslyFocused) &&
        (!topmost || topmost.contains(previouslyFocused))) {
        previouslyFocused.focus({ preventScroll: true });
      } else if (!topmost) {
        Array.from(document.querySelectorAll<HTMLElement>(".app button:not([disabled])"))
          .find((button) => !dialog.contains(button) && button.getClientRects().length > 0)?.focus({ preventScroll: true });
      }
    };
  }, [active, previouslyFocused]);

  return dialogRef;
}
