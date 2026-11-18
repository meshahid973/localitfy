import { ListEnd, ListMusic, Play, Radio, Shuffle, UserRound } from "lucide-react";
import { Cover } from "../../covers/Cover";
import { ContextMenuLayer } from "../../../shared/ui/ContextMenuLayer";
import { prettyMeta, prettyTitle } from "../../search/search.utils";
import { playableIds, type CollectionTarget, type PlayCollectionOptions } from "../../shell/appActions";
import "./song-context-menu.css";

const OPEN_LABELS: Record<CollectionTarget["kind"], string> = { artist: "open artist", genre: "open genre", playlist: "open playlist", mix: "open mix" };

export type CollectionContextMenuState = { target: CollectionTarget; x: number; y: number };

export type CollectionContextMenuProps = {
  state: CollectionContextMenuState | null;
  onClose: () => void;
  open: (target: CollectionTarget) => unknown;
  play: (target: CollectionTarget, options?: PlayCollectionOptions) => unknown;
  queue: (target: CollectionTarget) => unknown;
  findSimilar: (target: CollectionTarget) => unknown;
};

/** Right-click menu for an artist, genre, playlist or mix; shares the song menu layer. */
export default function CollectionContextMenu({ state, onClose, open, play, queue, findSimilar }: CollectionContextMenuProps) {
  if (!state) return null;
  const { target } = state;
  const ids = playableIds(target.songs);
  const run = (action: () => unknown) => () => { onClose(); void action(); };

  return (
    <ContextMenuLayer anchor={state} identity={`${target.kind}:${target.id}`}
      label={`${target.kind} actions`} onClose={onClose}>
        <div className="songContextMenuHead">
          <Cover song={target.coverSong} className="songContextMenuCover" />
          <span>
            <strong>{prettyTitle(target.title, 6)}</strong>
            <small>{prettyMeta(target.subtitle)}</small>
          </span>
        </div>
        <button type="button" role="menuitem" onClick={run(() => open(target))}>
          <span className="songContextMenuIcon">{target.kind === "artist" ? <UserRound size={13} strokeWidth={3} /> : <ListMusic size={13} strokeWidth={3} />}</span> {OPEN_LABELS[target.kind]}
        </button>
        <button type="button" role="menuitem" disabled={!ids.length} onClick={run(() => play(target))}>
          <span className="songContextMenuIcon"><Play size={13} strokeWidth={3} /></span> play
        </button>
        <button type="button" role="menuitem" disabled={ids.length < 2} onClick={run(() => play(target, { shuffle: true }))}>
          <span className="songContextMenuIcon"><Shuffle size={13} strokeWidth={3} /></span> shuffle
        </button>
        <button type="button" role="menuitem" disabled={!ids.length} onClick={run(() => queue(target))}>
          <span className="songContextMenuIcon"><ListEnd size={13} strokeWidth={3} /></span> add to queue
        </button>
        <button type="button" role="menuitem" disabled={!ids.length} onClick={run(() => findSimilar(target))}>
          <span className="songContextMenuIcon"><Radio size={13} strokeWidth={3} /></span> similar songs
        </button>
    </ContextMenuLayer>
  );
}
