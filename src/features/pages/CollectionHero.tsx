import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { ListEnd, MoreHorizontal, Play, Shuffle } from "lucide-react";
import type { Song } from "../library/song.types";
import { IconButton } from "../../shared/ui/IconButton";
import { Surface } from "../../shared/ui/Surface";

export type CollectionHeroProps = {
  typeLabel: string;
  title: string;
  cover: ReactNode;
  coverSong: Song | null;
  round?: boolean;
  /** Artist links, owner, rule summary… */
  byline?: ReactNode;
  stats: string;
  playable: number;
  onPlay: () => unknown;
  onShuffle: () => unknown;
  onQueue: () => unknown;
  onMore: (event: ReactMouseEvent<HTMLElement>) => unknown;
  /** Page-specific buttons after the shared ones (edit, more like this…). */
  children?: ReactNode;
};

/** Top of every album, artist, genre, playlist and mix page: artwork, title, then play · shuffle · queue · more. */
export default function CollectionHero({ typeLabel, title, cover, round = false, byline, stats, playable, onPlay, onShuffle, onQueue, onMore, children }: CollectionHeroProps) {
  return (
    <Surface as="header" variant="transparent" className={`collectionHero ${round ? "isRound" : ""}`}>
      <div className="collectionHeroArt">{cover}</div>
      <div className="collectionHeroCopy">
        <h1 title={title}>{title}</h1>
        {byline ? <div className="collectionHeroByline">{byline}</div> : null}
        <p className="collectionHeroStats">{typeLabel} · {stats}</p>
      </div>
      <div className="collectionHeroActions">
        <button className="collectionPlayButton" type="button" onClick={() => void onPlay()} disabled={!playable} aria-label={`play ${title}`} title="Play">
          <Play size={16} fill="currentColor" strokeWidth={2} aria-hidden="true" />
          <span>Play all</span>
        </button>
        <IconButton className="collectionIconButton" type="button" onClick={() => void onShuffle()} disabled={playable < 2} aria-label={`shuffle ${title}`} title="Shuffle">
          <Shuffle size={17} strokeWidth={2.2} aria-hidden="true" />
        </IconButton>
        <IconButton className="collectionIconButton" type="button" onClick={() => void onQueue()} disabled={!playable} aria-label={`add ${title} to queue`} title="Add to queue">
          <ListEnd size={17} strokeWidth={2.2} aria-hidden="true" />
        </IconButton>
        {children}
        <IconButton className="collectionIconButton" type="button" onClick={(event) => void onMore(event)} aria-label={`more options for ${title}`} title="More options">
          <MoreHorizontal size={18} strokeWidth={2.2} aria-hidden="true" />
        </IconButton>
      </div>
    </Surface>
  );
}
