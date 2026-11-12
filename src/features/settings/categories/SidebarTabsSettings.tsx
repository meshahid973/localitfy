import { ArrowDown, ArrowUp, Eye, EyeOff } from "lucide-react";
import { isAndroidApp } from "../../../app/platform";
import { DESKTOP_ONLY_VIEWS, navItems } from "../../shell/navigation.constants";
import { canMoveSidebarItem, moveSidebarItem, normalizeSidebarHidden, resolveSidebarGroups, toggleSidebarItemHidden } from "../../shell/sidebarLayout";
import type { Settings } from "../settings.types";
import type { UpdateSetting } from "../settings.shared";

export type SidebarTabsSettingsProps = {
  settings: Pick<Settings, "sidebarNavOrder" | "sidebarHiddenNav">;
  updateSetting: UpdateSetting;
};

export default function SidebarTabsSettings({ settings, updateSetting }: SidebarTabsSettingsProps) {
  const order = settings.sidebarNavOrder;
  const hidden = settings.sidebarHiddenNav;
  const hiddenSet = new Set<string>(normalizeSidebarHidden(hidden));
  const groups = resolveSidebarGroups(order, hidden).filter((group) => group.customizable);
  const isCustomized = hiddenSet.size > 0 || Object.values(order || {}).some((ids) => Array.isArray(ids) && ids.length);

  return (
    <div className="settingsPanelCard settingsFocusPanelV491 sidebarTabsSettings" id="settings-sidebar-tabs">
      <div className="settingsPanelHeader">
        <div>
          <strong>{isAndroidApp() ? "Tabs" : "Sidebar tabs"}</strong>
          <span>{isAndroidApp()
            ? "The first four shown pages are the tabs at the bottom; the rest are under more."
            : "Reorder or hide tabs in each section. You can also right-click a tab in the sidebar."}</span>
        </div>
        <button
          className="settingsTinyButton"
          type="button"
          disabled={!isCustomized}
          onClick={() => {
            void updateSetting("sidebarNavOrder", {});
            void updateSetting("sidebarHiddenNav", []);
          }}
        >
          reset
        </button>
      </div>

      <div className="sidebarTabsGroups">
        {groups.map((group) => (
          <section key={group.id} className="sidebarTabsGroup" aria-label={`${group.label} tabs`}>
            <p className="eyebrow">{group.label}</p>
            <ol className="sidebarTabsList">
              {group.orderedItems.map((itemId) => {
                const item = navItems.find((entry) => entry.id === itemId);
                if (!item || (isAndroidApp() && DESKTOP_ONLY_VIEWS.has(itemId))) return null;
                const Icon = item.icon;
                const isHidden = hiddenSet.has(itemId);

                return (
                  <li key={itemId} className={`sidebarTabsRow ${isHidden ? "isHidden" : ""}`}>
                    <Icon className="sidebarTabsIcon" size={16} strokeWidth={2.4} aria-hidden="true" />
                    <span className="sidebarTabsLabel">{item.label}</span>
                    <button
                      type="button"
                      className="sidebarTabsButton"
                      disabled={isHidden || !canMoveSidebarItem(order, hidden, itemId, -1)}
                      onClick={() => void updateSetting("sidebarNavOrder", moveSidebarItem(order, hidden, itemId, -1))}
                      aria-label={`move ${item.label} up`}
                      title="move up"
                    >
                      <ArrowUp size={14} strokeWidth={2.4} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="sidebarTabsButton"
                      disabled={isHidden || !canMoveSidebarItem(order, hidden, itemId, 1)}
                      onClick={() => void updateSetting("sidebarNavOrder", moveSidebarItem(order, hidden, itemId, 1))}
                      aria-label={`move ${item.label} down`}
                      title="move down"
                    >
                      <ArrowDown size={14} strokeWidth={2.4} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={`sidebarTabsButton sidebarTabsVisibility ${isHidden ? "" : "active"}`}
                      onClick={() => void updateSetting("sidebarHiddenNav", toggleSidebarItemHidden(hidden, itemId))}
                      aria-pressed={!isHidden}
                      aria-label={isHidden ? `show ${item.label}` : `hide ${item.label}`}
                      title={isHidden ? "show in sidebar" : "hide from sidebar"}
                    >
                      {isHidden ? <EyeOff size={14} strokeWidth={2.4} aria-hidden="true" /> : <Eye size={14} strokeWidth={2.4} aria-hidden="true" />}
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
