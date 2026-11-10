import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { clampContextMenuPosition, type ContextMenuPoint } from "./contextMenuPosition";

type ContextMenuLayerProps = {
  anchor: ContextMenuPoint | null;
  identity: string;
  label: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
};

/** Shared positioning, dismissal and keyboard handling for the three app right-click menus. */
export function ContextMenuLayer({
  anchor, identity, label, onClose, children, className = ""
}: ContextMenuLayerProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const x = anchor?.x;
  const y = anchor?.y;
  const placeMenu = useCallback(() => {
    const menu = menuRef.current;
    if (!menu || x === undefined || y === undefined) return;
    const bounds = menu.getBoundingClientRect();
    const { left, top } = clampContextMenuPosition(
      { x, y },
      { width: bounds.width, height: bounds.height },
      { width: window.innerWidth, height: window.innerHeight }
    );
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }, [x, y]);

  useLayoutEffect(() => {
    if (x === undefined || y === undefined) return;
    const menu = menuRef.current;
    if (!menu) return;
    const previousFocus = document.activeElement;
    if (previousFocus instanceof HTMLElement && !menu.contains(previousFocus)) {
      previousFocusRef.current = previousFocus;
    }
    placeMenu();
    menu.querySelector<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)')?.focus({ preventScroll: true });
  }, [identity, placeMenu, x, y]);

  useEffect(() => {
    if (x === undefined || y === undefined) return;
    const onScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && menuRef.current?.contains(target)) return;
      onCloseRef.current();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      const previousFocus = previousFocusRef.current;
      onCloseRef.current();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [placeMenu, x, y]);

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") { onCloseRef.current(); return; }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const menu = menuRef.current;
    if (!menu) return;
    const enabled = Array.from(menu.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)'));
    if (!enabled.length) return;
    event.preventDefault();
    const current = enabled.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? enabled.length - 1
      : (current + (event.key === "ArrowDown" ? 1 : -1) + enabled.length) % enabled.length;
    enabled[next].focus({ preventScroll: true });
  };

  if (!anchor) return null;
  return createPortal(
    <div className="songContextMenuLayer" onClick={onClose}
      onContextMenu={(event) => { event.preventDefault(); onClose(); }}>
      <div
        ref={menuRef}
        className={`songContextMenu${className ? ` ${className}` : ""}`}
        style={{ left: anchor.x, top: anchor.y }}
        role="menu"
        aria-label={label}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleMenuKeyDown}
      >
        {children}
      </div>
    </div>,
    document.querySelector(".app") || document.body
  );
}
