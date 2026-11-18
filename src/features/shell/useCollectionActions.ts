import { useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useStableCallback } from "../../shared/hooks/useStableCallback";
import { playbackSourceRef } from "../player/playbackSource";
import type { Song } from "../library/song.types";
import { playableIds, type AppActions } from "./appActions";
import type { ShellCollectionsContract } from "./appShell.contract";
import type { NavigationHistory } from "./useNavigationHistory";
import { createCollectionMenuStore } from "./collectionMenuStore";

/** Stable page actions; menu state is observed by its overlay, never the shell. */
export function useCollectionActions(nav: NavigationHistory, collections: ShellCollectionsContract,
  openSongMenu: (event: ReactMouseEvent<HTMLElement>, song: Song) => unknown) {
  const [menu] = useState(createCollectionMenuStore);
  const playSongs = useStableCallback(collections.playSongs);
  const queueSongs = useStableCallback(collections.queueSongs);
  const playPlaylist = useStableCallback(collections.playPlaylist);
  const openSong = useStableCallback(openSongMenu);
  const actions = useMemo<AppActions>(() => ({
    nav,
    openCollection: (target) => nav.open({ kind: target.kind, id: target.id }),
    playCollection(target, options = {}) {
      if (target.playlist && !options.startId) return void playPlaylist(target.playlist, Boolean(options.shuffle));
      const source = target.kind === "artist" || target.kind === "genre" ? playbackSourceRef(target.kind, target.title) : null;
      playSongs(playableIds(target.songs), target.title, source, Boolean(options.shuffle), options.startId);
    },
    queueCollection: (target) => void queueSongs(playableIds(target.songs), target.title),
    openCollectionMenu(event, target) {
      event.preventDefault();
      event.stopPropagation();
      menu.open({ target, x: event.clientX, y: event.clientY });
    },
    openSongMenu: openSong
  }), [nav, playSongs, queueSongs, playPlaylist, openSong, menu]);
  return { actions, menu };
}
