import { useEffect, useRef } from "react";
import type { View } from "./view.types";
import type { NavigationHistory } from "./useNavigationHistory";

const MENU_VIEWS = new Set<View>(["home", "library", "liked", "artists", "genres", "albums", "playlists", "discover", "downloads", "covers", "analytics", "settings"]);
// Page search fields. Playlists reuses the header input for naming a new playlist, so it has no search.
const SEARCH_SELECTOR = ".content :is(.librarySearch, .pageHeaderSearch:not(.playlistCreateForm *), .coverStudioSearchInput, #settings-section-search)";

export type AppMenuActions = {
  changeView: (view: View) => void;
  nav: Pick<NavigationHistory, "gesture">;
  openSettings: () => void;
  importSongs: () => unknown;
  importAlbumFolder: () => unknown;
  openFeedback: () => void;
  checkForUpdates: () => unknown;
};

/** Focuses the first element matching selector once the next view has rendered. */
function focusWhenReady(selector: string, attempts = 12) {
  const element = document.querySelector<HTMLInputElement>(selector);
  if (element) {
    element.focus();
    element.select?.();
    return;
  }
  if (attempts > 0) window.setTimeout(() => focusWhenReady(selector, attempts - 1), 50);
}

/** Selects all text in the focused field. Outside text fields it does nothing, so the page UI never gets highlighted. */
function selectAllInTextField() {
  const active = document.activeElement;
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) active.select();
  else if (active instanceof HTMLElement && active.isContentEditable) document.execCommand("selectAll");
}

/** Handles commands from the native macOS menu bar (electron/runtime/app-menu.cjs). */
export function useAppMenuCommands(actions: AppMenuActions) {
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => window.localitfy.onAppMenuCommand?.((command) => {
    const current = actionsRef.current;
    switch (command?.type) {
      case "navigate":
        if (MENU_VIEWS.has(command.view as View)) current.changeView(command.view as View);
        break;
      case "back":
        current.nav.gesture(-1);
        break;
      case "forward":
        current.nav.gesture(1);
        break;
      case "settings":
        current.openSettings();
        break;
      case "import-music":
        void current.importSongs();
        break;
      case "import-album-folder":
        current.changeView("albums");
        void current.importAlbumFolder();
        break;
      case "new-playlist":
        current.changeView("playlists");
        focusWhenReady(".playlistCreateForm input");
        break;
      case "select-all":
        selectAllInTextField();
        break;
      case "find":
        if (!document.querySelector(SEARCH_SELECTOR)) current.changeView("library");
        focusWhenReady(SEARCH_SELECTOR);
        break;
      case "feedback":
        current.openFeedback();
        break;
      case "check-updates":
        void current.checkForUpdates();
        break;
    }
  }), []);
}
