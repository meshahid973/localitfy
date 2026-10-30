import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { ListEnd, MoreHorizontal, Play, Shuffle } from "lucide-react";
import { getSongAmbientSource, useCoverAverageStyle } from "../covers/cover.ambient";
import type { Song } from "../library/song.types";

export type CollectionHeroProps = {
  eyebrow: string;
  title: string;
  cover: ReactNode;
  /** Tints the page from the cover, like the player does. */
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
export default function CollectionHero({ eyebrow, title, cover, coverSong, round = false, byline, stats, playable, onPlay, onShuffle, onQueue, onMore, children }: CollectionHeroProps) {
  const tint = useCoverAverageStyle(getSongAmbientSource(coverSong), Boolean(coverSong));
  return (
    <header className={`collectionHero ${round ? "isRound" : ""}`} style={tint as CSSProperties}>
      <div className="collectionHeroArt">{cover}</div>
      <div className="collectionHeroCopy">
        <span className="collectionHeroEyebrow">{eyebrow}</span>
        <h1 title={title}>{title}</h1>
        {byline ? <div className="collectionHeroByline">{byline}</div> : null}
        <p className="collectionHeroStats">{stats}</p>
      </div>
      <div className="collectionHeroActions">
        <button className="collectionPlayButton" type="button" onClick={() => void onPlay()} disabled={!playable} aria-label={`play ${title}`} title="Play">
          <Play size={20} fill="currentColor" strokeWidth={2} aria-hidden="true" />
        </button>
        <button className="collectionIconButton" type="button" onClick={() => void onShuffle()} disabled={playable < 2} aria-label={`shuffle ${title}`} title="Shuffle">
          <Shuffle size={17} strokeWidth={2.2} aria-hidden="true" />
        </button>
        <button className="collectionIconButton" type="button" onClick={() => void onQueue()} disabled={!playable} aria-label={`add ${title} to queue`} title="Add to queue">
          <ListEnd size={17} strokeWidth={2.2} aria-hidden="true" />
        </button>
        {children}
        <button className="collectionIconButton" type="button" onClick={(event) => void onMore(event)} aria-label={`more options for ${title}`} title="More options">
          <MoreHorizontal size={18} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
