import { useEffect, useRef } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Images, RotateCcw } from "lucide-react";
import {
  canMoveHomeSection, defaultHiddenHomeSections, homeSections, isHomeLayoutCustomized, moveHomeSection, normalizeHomeHidden,
  resolveHomeSectionOrder, toggleHomeSectionHidden, type HomeLayoutPatch
} from "./homeLayout";

export type HomeCustomizePanelProps = {
  sectionOrder: unknown;
  hiddenSections: unknown;
  updateHomeLayout: (patch: HomeLayoutPatch) => unknown;
  openCovers: () => unknown;
  onClose: () => void;
};

/** Popover under the Customize Home button for reordering, hiding and showing Home sections. */
export default function HomeCustomizePanel({ sectionOrder, hiddenSections, updateHomeLayout, openCovers, onClose }: HomeCustomizePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const order = resolveHomeSectionOrder(sectionOrder);
  const hidden = new Set(normalizeHomeHidden(hiddenSections));

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>("button:not(:disabled)")?.focus();
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!panelRef.current?.contains(target) && !target?.closest(".homeCustomizeButton")) onClose();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      document.querySelector<HTMLElement>(".homeCustomizeButton")?.focus();
      onClose();
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return (
    <div className="homeCustomizePanel" id="home-customize-panel" ref={panelRef} role="dialog" aria-label="Customize Home">
      <div className="homeCustomizeHead">
        <strong>Home sections</strong>
        <button
          className="homeCustomizeReset"
          type="button"
          disabled={!isHomeLayoutCustomized(sectionOrder, hiddenSections)}
          onClick={() => updateHomeLayout({ homeSectionOrder: [], homeHiddenSections: [...defaultHiddenHomeSections] })}
          title="Restore the default layout"
        >
          <RotateCcw size={11} strokeWidth={2.4} aria-hidden="true" />
          reset
        </button>
      </div>

      <ol className="homeCustomizeList">
        {order.map((id) => {
          const label = homeSections.find((section) => section.id === id)?.label ?? id;
          const isHidden = hidden.has(id);
          return (
            <li key={id} className={`homeCustomizeRow ${isHidden ? "isHidden" : ""}`}>
              <span>{label}</span>
              <button type="button" disabled={!canMoveHomeSection(sectionOrder, id, -1)} onClick={(event) => {
                const next = moveHomeSection(sectionOrder, id, -1);
                if (!canMoveHomeSection(next, id, -1)) (event.currentTarget.nextElementSibling as HTMLElement | null)?.focus();
                updateHomeLayout({ homeSectionOrder: next });
              }} aria-label={`move ${label} up`} title="move up">
                <ArrowUp size={13} strokeWidth={2.4} aria-hidden="true" />
              </button>
              <button type="button" disabled={!canMoveHomeSection(sectionOrder, id, 1)} onClick={(event) => {
                const next = moveHomeSection(sectionOrder, id, 1);
                if (!canMoveHomeSection(next, id, 1)) (event.currentTarget.previousElementSibling as HTMLElement | null)?.focus();
                updateHomeLayout({ homeSectionOrder: next });
              }} aria-label={`move ${label} down`} title="move down">
                <ArrowDown size={13} strokeWidth={2.4} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={isHidden ? "" : "active"}
                onClick={() => updateHomeLayout({ homeHiddenSections: toggleHomeSectionHidden(hiddenSections, id) })}
                aria-pressed={!isHidden}
                aria-label={isHidden ? `show ${label}` : `hide ${label}`}
                title={isHidden ? "show on Home" : "hide from Home"}
              >
                {isHidden ? <EyeOff size={13} strokeWidth={2.4} aria-hidden="true" /> : <Eye size={13} strokeWidth={2.4} aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ol>

      <button className="homeCustomizeLink" type="button" onClick={() => { onClose(); void openCovers(); }}>
        <Images size={12} strokeWidth={2.2} aria-hidden="true" />
        Change song covers
      </button>
    </div>
  );
}
