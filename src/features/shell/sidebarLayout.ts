import { navItems, sidebarNavGroups } from "./navigation.constants";
import type { View } from "./view.types";

export type SidebarGroupId = (typeof sidebarNavGroups)[number]["id"];
export type CustomizableSidebarGroupId = Exclude<SidebarGroupId, "app">;
export type SidebarNavOrder = Partial<Record<CustomizableSidebarGroupId, string[]>>;

export type ResolvedSidebarGroup = {
  id: SidebarGroupId;
  label: string;
  customizable: boolean;
  /** Every item in saved order, hidden ones included. */
  orderedItems: View[];
  visibleItems: View[];
};

const knownViews = new Set<string>(navItems.map((item) => item.id));

function isCustomizableGroup(groupId: SidebarGroupId): groupId is CustomizableSidebarGroupId {
  return groupId !== "app";
}

export function normalizeSidebarHidden(hidden: unknown): View[] {
  if (!Array.isArray(hidden)) return [];
  const customizable = new Set<string>(
    sidebarNavGroups.filter((group) => isCustomizableGroup(group.id)).flatMap((group) => group.itemIds)
  );
  return [...new Set(hidden.map(String))].filter((id): id is View => knownViews.has(id) && customizable.has(id));
}

/** Saved order first, then any default items the save does not know about yet (new tabs in later versions). */
function orderGroupItems(defaults: View[], saved: unknown): View[] {
  const savedIds = Array.isArray(saved) ? [...new Set(saved.map(String))] : [];
  const ordered = savedIds.filter((id): id is View => defaults.includes(id as View));
  return [...ordered, ...defaults.filter((id) => !ordered.includes(id))];
}

export function resolveSidebarGroups(order: SidebarNavOrder | undefined, hidden: unknown): ResolvedSidebarGroup[] {
  const hiddenSet = new Set<View>(normalizeSidebarHidden(hidden));
  return sidebarNavGroups.map((group) => {
    const customizable = isCustomizableGroup(group.id);
    const orderedItems = customizable ? orderGroupItems(group.itemIds, order?.[group.id as CustomizableSidebarGroupId]) : [...group.itemIds];
    return {
      id: group.id,
      label: group.label,
      customizable,
      orderedItems,
      visibleItems: customizable ? orderedItems.filter((id) => !hiddenSet.has(id)) : orderedItems
    };
  });
}

export function sidebarGroupForView(view: View): CustomizableSidebarGroupId | null {
  const group = sidebarNavGroups.find((item) => item.itemIds.includes(view));
  return group && isCustomizableGroup(group.id) ? group.id : null;
}

/**
 * Moves a tab among the visible tabs of its group. Hidden tabs keep their slot
 * relative to their neighbours so showing them again feels predictable.
 */
export function moveSidebarItem(order: SidebarNavOrder | undefined, hidden: unknown, view: View, delta: -1 | 1): SidebarNavOrder {
  const groupId = sidebarGroupForView(view);
  if (!groupId) return { ...order };
  const group = resolveSidebarGroups(order, hidden).find((item) => item.id === groupId);
  if (!group) return { ...order };

  const visibleIndex = group.visibleItems.indexOf(view);
  const swapWith = group.visibleItems[visibleIndex + delta];
  if (visibleIndex === -1 || !swapWith) return { ...order };

  const next = [...group.orderedItems];
  const from = next.indexOf(view);
  const to = next.indexOf(swapWith);
  next[from] = swapWith;
  next[to] = view;
  return { ...order, [groupId]: next };
}

export function canMoveSidebarItem(order: SidebarNavOrder | undefined, hidden: unknown, view: View, delta: -1 | 1) {
  const groupId = sidebarGroupForView(view);
  const group = groupId ? resolveSidebarGroups(order, hidden).find((item) => item.id === groupId) : null;
  if (!group) return false;
  const index = group.visibleItems.indexOf(view);
  return index !== -1 && Boolean(group.visibleItems[index + delta]);
}

export function toggleSidebarItemHidden(hidden: unknown, view: View): View[] {
  const current = normalizeSidebarHidden(hidden);
  if (!sidebarGroupForView(view)) return current;
  return current.includes(view) ? current.filter((id) => id !== view) : [...current, view];
}

/** Scrolls Settings to the sidebar panel once the lazily mounted settings page has rendered it. */
export function revealSidebarSettingsPanel(reducedMotion: boolean) {
  let attempts = 0;
  const reveal = () => {
    const panel = document.getElementById("settings-sidebar-tabs");
    if (panel) panel.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    else if (attempts++ < 20) window.setTimeout(reveal, 50);
  };
  window.setTimeout(reveal, 50);
}
