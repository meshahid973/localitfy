import { useEffect, useState } from "react";
import { LayoutGrid, SlidersHorizontal } from "lucide-react";
import { DESKTOP_ONLY_VIEWS, navItems } from "./navigation.constants";
import { resolveSidebarGroups } from "./sidebarLayout";
import type { SidebarNavOrder } from "./sidebarLayout";
import type { View } from "./view.types";
import { useModalFocus } from "../../shared/hooks/useModalFocus";

const TAB_COUNT = 4;

export type PhoneTabBarProps = {
  view: View;
  changeView: (view: View, source?: string) => unknown;
  sidebarNavOrder: SidebarNavOrder | undefined;
  sidebarHiddenNav: string[] | undefined;
  openSidebarSettings: () => unknown;
};

/** The phone's bottom navigation: the first four pages from the tab settings, then "more" for the rest. */
export default function PhoneTabBar({ view, changeView, sidebarNavOrder, sidebarHiddenNav, openSidebarSettings }: PhoneTabBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const dialogRef = useModalFocus(moreOpen);
  const pages = resolveSidebarGroups(sidebarNavOrder, sidebarHiddenNav)
    .filter((group) => group.customizable)
    .flatMap((group) => group.visibleItems)
    .filter((id) => !DESKTOP_ONLY_VIEWS.has(id));
  const tabs = pages.slice(0, TAB_COUNT);
  const more: View[] = [...pages.slice(TAB_COUNT), "settings"];
  const go = (id: View) => {
    setMoreOpen(false);
    changeView(id, "nav");
  };

  // Tabs are a collapsed section of Appearance settings; open it and bring it into view once the page has rendered.
  const chooseTabs = () => {
    setMoreOpen(false);
    openSidebarSettings();
    // scrollIntoView doesn't move the page's scroll area in Android's WebView, so scroll it by hand.
    window.setTimeout(() => {
      const section = document.querySelector<HTMLDetailsElement>(".settingsSidebarDisclosure");
      const page = section?.closest(".content");
      if (section) section.open = true;
      if (section && page) page.scrollTo({ top: section.getBoundingClientRect().top - page.getBoundingClientRect().top + page.scrollTop - 12, behavior: "smooth" });
    }, 350);
  };

  // Android back closes the sheet before it leaves the page.
  useEffect(() => {
    if (!moreOpen) return;
    const closeOnBack = (event: Event) => {
      event.preventDefault();
      setMoreOpen(false);
    };
    window.addEventListener("localtifyuiback", closeOnBack);
    return () => window.removeEventListener("localtifyuiback", closeOnBack);
  }, [moreOpen]);

  const tabButton = (id: View) => {
    const item = navItems.find((entry) => entry.id === id);
    if (!item) return null;
    const Icon = item.icon;
    return (
      <button key={id} type="button" className={`phoneTab ${view === id ? "active" : ""}`} onClick={() => go(id)} aria-current={view === id ? "page" : undefined}>
        <span className="phoneTabIcon" aria-hidden="true"><Icon size={22} strokeWidth={2.2} /></span>
        <span className="phoneTabLabel">{item.label}</span>
      </button>
    );
  };

  return (
    <>
      <nav className="phoneTabBar" aria-label="pages">
        {tabs.map(tabButton)}
        <button type="button" className={`phoneTab ${!tabs.includes(view) ? "active" : ""}`} onClick={() => setMoreOpen(true)} aria-haspopup="dialog" aria-expanded={moreOpen}>
          <span className="phoneTabIcon" aria-hidden="true"><LayoutGrid size={22} strokeWidth={2.2} /></span>
          <span className="phoneTabLabel">more</span>
        </button>
      </nav>

      {moreOpen ? (
        <div className="phoneSheetLayer" onClick={() => setMoreOpen(false)}>
          <div ref={dialogRef} tabIndex={-1} className="phoneSheet phoneMoreSheet" role="dialog" aria-modal="true" aria-label="more pages"
            onClick={(event) => event.stopPropagation()} onKeyDown={(event) => {
              if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setMoreOpen(false); }
            }}>
            <span className="phoneSheetHandle" aria-hidden="true" />
            <div className="phoneMoreGrid">
              {more.map((id) => {
                const item = navItems.find((entry) => entry.id === id);
                if (!item) return null;
                const Icon = item.icon;
                return (
                  <button key={id} type="button" className={`phoneMoreItem ${view === id ? "active" : ""}`} onClick={() => go(id)}>
                    <span className="phoneMoreIcon" aria-hidden="true"><Icon size={22} strokeWidth={2.2} /></span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
            <button type="button" className="phoneSheetAction" onClick={chooseTabs}>
              <SlidersHorizontal size={18} strokeWidth={2.2} aria-hidden="true" />
              <span>Choose tabs</span>
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
