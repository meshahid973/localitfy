import type { HTMLAttributes, ReactNode } from "react";
import { Play } from "lucide-react";
import "./media-card.css";

export type MediaCardProps = Omit<HTMLAttributes<HTMLDivElement>, "onClick" | "children"> & {
  /** Opens the artist, genre, playlist or mix page. */
  onOpen: () => unknown;
  /** Plays the whole collection without opening it. */
  onPlay?: () => unknown;
  openLabel: string;
  playLabel?: string;
  /** The artwork; the play button sits on its bottom-right corner. */
  cover: ReactNode;
  coverClassName?: string;
  active?: boolean;
  children?: ReactNode;
};

/**
 * One card for every collection: click opens its page, the round button plays it, right-click (onContextMenu)
 * opens its menu. Each page keeps its own card look through className.
 */
export function MediaCard({ onOpen, onPlay, openLabel, playLabel, cover, coverClassName = "", active = false, className = "", children, ...rest }: MediaCardProps) {
  return (
    <div {...rest} className={`mediaCard ${active ? "active" : ""} ${className}`} onClick={() => void onOpen()}>
      <span className={`mediaCardCover ${coverClassName}`}>
        {cover}
        <button className="mediaCardOpen" type="button" aria-label={openLabel}
          onClick={(event) => { event.stopPropagation(); void onOpen(); }} />
        {onPlay ? (
          <button className="mediaCardPlay" type="button" aria-label={playLabel || "play"} title={playLabel || "play"}
            onClick={(event) => { event.stopPropagation(); void onPlay(); }}>
            <Play size={15} fill="currentColor" strokeWidth={2} aria-hidden="true" />
          </button>
        ) : null}
      </span>
      {children}
    </div>
  );
}
