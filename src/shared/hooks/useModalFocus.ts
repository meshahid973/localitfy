import { useLayoutEffect, useRef } from "react";

/** Keep keyboard focus inside the topmost modal, including stacked delete confirmations. */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useModalFocus(active: boolean) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!active || !dialog) return;

    const previouslyFocused = document.activeElement;
    const topmostModal = () => Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]')).at(-1);
    const isTopmost = () => topmostModal() === dialog;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter((element) => element.getClientRects().length > 0 && !element.closest("[hidden], [inert]"));
    const focusFirst = () => (focusable()[0] ?? dialog).focus({ preventScroll: true });

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
      if (event.shiftKey && (current === first || !dialog.contains(current))) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && (current === last || !dialog.contains(current) || current === dialog)) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    const onFocusIn = (event: FocusEvent) => {
      if (!isTopmost()) return;
      if (event.target instanceof Node && !dialog.contains(event.target)) focusFirst();
    };

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocusIn, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusIn, true);
      const topmost = topmostModal();
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected &&
        (!topmost || topmost.contains(previouslyFocused))) {
        previouslyFocused.focus({ preventScroll: true });
      } else if (!topmost) {
        document.querySelector<HTMLElement>(".app button:not([disabled])")?.focus({ preventScroll: true });
      }
    };
  }, [active]);

  return dialogRef;
}
