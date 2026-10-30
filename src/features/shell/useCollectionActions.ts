import { useCallback, useState, type MouseEvent as ReactMouseEvent } from "react";
import { playbackSourceRef } from "../player/playbackSource";
import type { Song } from "../library/song.types";
import type { CollectionContextMenuState } from "../library/components/CollectionContextMenu";
import { playableIds, type AppActions } from "./appActions";
import type { ShellCollectionsContract } from "./appShell.contract";
import type { NavigationHistory } from "./useNavigationHistory";

const MENU_WIDTH = 236, MENU_HEIGHT = 380, MENU_MARGIN = 12;

/** The app actions every page shares, plus the state of the collection right-click menu. */
export function useCollectionActions(nav: NavigationHistory, collections: ShellCollectionsContract,
  openSongMenu: (event: ReactMouseEvent<HTMLElement>, song: Song) => unknown) {
  const [collectionMenu, setCollectionMenu] = useState<CollectionContextMenuState | null>(null);
  const closeCollectionMenu = useCallback(() => setCollectionMenu(null), []);
  const actions: AppActions = {
    nav,
    openCollection: (target) => nav.open({ kind: target.kind, id: target.id }),
    playCollection(target, options = {}) {
      if (target.playlist && !options.startId) return void collections.playPlaylist(target.playlist, Boolean(options.shuffle));
      // Albums, artists and genres play as a source, so repeat-all loops them and the player can reveal them.
      const source = target.kind === "album" ? playbackSourceRef("album", target.title, target.id)
        : target.kind === "artist" || target.kind === "genre" ? playbackSourceRef(target.kind, target.title) : null;
      collections.playSongs(playableIds(target.songs), target.title, source, Boolean(options.shuffle), options.startId);
    },
    queueCollection: (target) => void collections.queueSongs(playableIds(target.songs), target.title),
    openCollectionMenu(event, target) {
      event.preventDefault();
      event.stopPropagation();
      setCollectionMenu({
        target,
        x: Math.min(event.clientX, Math.max(MENU_MARGIN, window.innerWidth - MENU_WIDTH - MENU_MARGIN)),
        y: Math.min(event.clientY, Math.max(MENU_MARGIN, window.innerHeight - MENU_HEIGHT - MENU_MARGIN))
      });
    },
    openSongMenu
  };
  return { actions, collectionMenu, closeCollectionMenu };
}
