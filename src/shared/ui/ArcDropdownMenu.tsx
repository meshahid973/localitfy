import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronDown } from "lucide-react";
import "./ArcDropdownMenu.css";

/**
 * Localtify's dependency-free Radix alternative, adapted from Arc UI's MIT-licensed
 * dropdown visual pattern (animated label, anchored portal and gliding highlight).
 * Original design: https://uiarc.dev/components/dropdown-menu
 * Copyright (c) 2026 Elia Kuratli — MIT license.
 */
export type ArcDropdownItem<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

export type ArcDropdownMenuProps<T extends string> = {
  ariaLabel: string;
  value: T;
  items: readonly ArcDropdownItem<T>[];
  onValueChange: (value: T) => void;
  className?: string;
  disabled?: boolean;
};

const EDGE_GAP = 12;
const ITEM_HEIGHT = 36;
const MENU_PADDING = 5;
const THEME_VARS = ["--lt-text", "--lt-muted", "--lt-accent", "--lt-surface", "--lt-surface-raised", "--lt-border"] as const;

export function ArcDropdownMenu<T extends string>({
  ariaLabel, value, items, onValueChange, className = "", disabled = false
}: ArcDropdownMenuProps<T>) {
  const menuId = useId();
  const reducedMotion = useReducedMotion();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState({ left: EDGE_GAP, top: EDGE_GAP, width: 176 });
  const [themeStyle, setThemeStyle] = useState<CSSProperties>({});
  const selectedIndex = Math.max(0, items.findIndex(item => item.value === value));
  const selected = items[selectedIndex];
  const firstEnabled = items.findIndex(item => !item.disabled);

  const placeMenu = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, 176), Math.max(0, window.innerWidth - EDGE_GAP * 2));
    const height = Math.min(items.length * ITEM_HEIGHT + MENU_PADDING * 2, Math.max(100, window.innerHeight - EDGE_GAP * 2));
    const left = Math.max(EDGE_GAP, Math.min(rect.right - width, window.innerWidth - width - EDGE_GAP));
    const below = rect.bottom + 6;
    const top = below + height > window.innerHeight - EDGE_GAP && rect.top - height - 6 >= EDGE_GAP
      ? rect.top - height - 6
      : Math.max(EDGE_GAP, Math.min(below, window.innerHeight - height - EDGE_GAP));
    setPosition({ left, top, width });
  }, [items.length]);

  useLayoutEffect(() => {
    if (!open) return;
    placeMenu();
    const root = triggerRef.current?.closest<HTMLElement>(".app");
    if (root) {
      const computed = getComputedStyle(root);
      const copied = {} as Record<string, string>;
      for (const key of THEME_VARS) copied[key] = computed.getPropertyValue(key).trim();
      setThemeStyle(copied as CSSProperties);
    }
    const id = window.requestAnimationFrame(() => optionRefs.current[activeIndex]?.focus());
    return () => window.cancelAnimationFrame(id);
    // Focus only when opening: pointer highlight changes should not steal keyboard focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, placeMenu]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const onViewportChange = () => placeMenu();
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [open, placeMenu]);

  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };
  const start = (fromEnd = false) => {
    if (disabled || firstEnabled < 0) return;
    const next = fromEnd ? items.findLastIndex(item => !item.disabled) : selected?.disabled ? firstEnabled : selectedIndex;
    setActiveIndex(next);
    setOpen(true);
  };
  const move = (direction: number) => {
    if (!items.length) return;
    let next = activeIndex;
    for (let i = 0; i < items.length; i += 1) {
      next = (next + direction + items.length) % items.length;
      if (!items[next].disabled) {
        setActiveIndex(next);
        optionRefs.current[next]?.focus();
        return;
      }
    }
  };
  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") { event.preventDefault(); close(true); }
    else if (event.key === "Tab") close();
    else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      move(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const index = event.key === "Home" ? firstEnabled : items.findLastIndex(item => !item.disabled);
      if (index >= 0) { setActiveIndex(index); optionRefs.current[index]?.focus(); }
    }
  };
  const choose = (item: ArcDropdownItem<T>) => {
    if (disabled || item.disabled) return;
    onValueChange(item.value);
    close(true);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={"arcDropdownTrigger " + className}
        aria-label={ariaLabel}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        data-state={open ? "open" : "closed"}
        onClick={() => open ? close(true) : start()}
        onKeyDown={event => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            start(event.key === "ArrowUp");
          } else if (event.key === "Escape" && open) {
            event.preventDefault();
            close(true);
          }
        }}
      >
        <span className="arcDropdownLabel">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={selected?.value || ""} initial={reducedMotion ? false : { opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }} exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -5 }}
              transition={{ duration: reducedMotion ? 0 : 0.12 }}>{selected?.label || "Sort"}</motion.span>
          </AnimatePresence>
        </span>
        <ChevronDown size={15} strokeWidth={1.9} className="arcDropdownChevron" aria-hidden="true" />
      </button>
      {createPortal(
        <AnimatePresence>
          {open ? (
            <motion.div
              id={menuId}
              ref={menuRef}
              role="menu"
              aria-label={ariaLabel}
              className="arcDropdownMenu"
              style={{ ...themeStyle, left: position.left, top: position.top, width: position.width }}
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -5, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -3, scale: 0.985 }}
              transition={{ duration: reducedMotion ? 0.05 : 0.14, ease: "easeOut" }}
              onKeyDown={onMenuKeyDown}
            >
              <motion.span
                className="arcDropdownHighlight"
                aria-hidden="true"
                animate={{ y: activeIndex * ITEM_HEIGHT, opacity: 1 }}
                transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 580, damping: 40, mass: 0.65 }}
              />
              {items.map((item, index) => (
                <button
                  key={item.value}
                  ref={node => { optionRefs.current[index] = node; }}
                  type="button"
                  role="menuitemradio"
                  aria-checked={item.value === value}
                  tabIndex={index === activeIndex ? 0 : -1}
                  disabled={item.disabled}
                  className="arcDropdownOption"
                  onPointerEnter={() => { if (!item.disabled) setActiveIndex(index); }}
                  onFocus={() => setActiveIndex(index)}
                  onClick={() => choose(item)}
                >
                  <span className="arcDropdownOptionLabel">{item.label}</span>
                  {item.value === value ? <Check size={14} strokeWidth={2} aria-hidden="true" /> : null}
                </button>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
