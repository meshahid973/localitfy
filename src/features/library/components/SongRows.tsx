import { memo, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, DragEvent, MouseEvent as ReactMouseEvent, PointerEvent } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Song, LibraryDropSide } from "../song.types";
import { Cover, getCardCoverCssUrl } from "../../covers/Cover";
import { MascotStateArt, PlayingBarsIcon } from "../../../shared/ui/LocaltifyViewUi";
import { collapseSpaces, formatTime, lower } from "../../../shared/utils/format";
import { prettyMeta, prettyTitle } from "../../search/search.utils";

export function displaySongWordCountV444(value: string) {
  return collapseSpaces(value).split(/\s+/).filter(Boolean).length;
}

export function looksLikeArtistInTitleSlotV444(title: string) {
  const value = lower(collapseSpaces(title));
  if (!value || value === "unknown artist") return false;

  return /^(dj|mc|lil|yung|young|mr|mrs|ms|dr)\b/.test(value)
    || (/^[a-z0-9_.]+(?:\s+[a-z0-9_.]+)?$/i.test(value) && displaySongWordCountV444(value) <= 2);
}

export function looksLikeSongInArtistSlotV444(artist: string) {
  const value = lower(collapseSpaces(artist));
  if (!value || value === "unknown artist" || value === "unknown") return false;

  return displaySongWordCountV444(value) >= 3
    || /\b(the|you|your|me|my|love|said|hero|night|ost|collection|theme|song|slowed|remix|edit)\b/.test(value);
}

export function shouldSwapDisplayTitleArtistV444(song: Pick<Song, "title" | "artist">) {
  const rawTitle = collapseSpaces(song.title || "");
  const rawArtist = collapseSpaces(song.artist || "");
  if (!rawTitle || !rawArtist) return false;

  const cleanArtist = lower(rawArtist);
  if (cleanArtist === "unknown" || cleanArtist === "unknown artist") return false;

  return looksLikeArtistInTitleSlotV444(rawTitle) && looksLikeSongInArtistSlotV444(rawArtist);
}

export function displaySongTitleV444(song: Pick<Song, "title" | "artist">, maxWords = 7) {
  return shouldSwapDisplayTitleArtistV444(song)
    ? prettyTitle(song.artist, maxWords)
    : prettyTitle(song.title, maxWords);
}

export function displaySongArtistV444(song: Pick<Song, "title" | "artist">) {
  return shouldSwapDisplayTitleArtistV444(song)
    ? prettyMeta(song.title)
    : prettyMeta(song.artist);
}

export function displaySongPickerSublineV444(song: Pick<Song, "title" | "artist">) {
  const artist = displaySongArtistV444(song);
  if (!artist || artist === "unknown artist") return "Pick a playlist or make a new one.";
  return `${artist} · Pick a playlist or make a new one.`;
}

export type SongInteractionHandlers = {
  onSelectSong: (songId: string, shouldPlay?: boolean) => void;
  onTogglePlay: () => void;
  onToggleLike: (songId: string) => void;
  onOpenEditor?: (song: Song) => void;
  onOpenPlaylistPicker: (song: Song) => void;
  onOpenSongContextMenu?: (event: ReactMouseEvent<HTMLElement>, song: Song) => void;
  onStartSongDrag: (event: DragEvent<HTMLElement>, songId: string) => void;
  onPointerStartSongDrag?: (event: PointerEvent<HTMLElement>, songId: string) => void;
  registerLibrarySongElement?: (songId: string, element: HTMLElement | null) => void;
  onDragOverSong: (event: DragEvent<HTMLElement>, songId: string) => void;
  onDragLeaveSong: (event: DragEvent<HTMLElement>, songId: string) => void;
  onDropSong: (event: DragEvent<HTMLElement>, songId: string) => void;
  onDragEnd: () => void;
};

export type SongRowItemProps = SongInteractionHandlers & {
  song: Song;
  index: number;
  active: boolean;
  isPlaying: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  libraryDropSide: LibraryDropSide;
  draggedSongTitle: string;
};


const LIKE_BURST_PARTICLES_V443 = [
  { rotate: 0, color: "#fe5064", size: "5px", translateY: "-28px", delay: "0s" },
  { rotate: 36, color: "#8eb539", size: "4px", translateY: "-27px", delay: "0.06s" },
  { rotate: 72, color: "#3e9be7", size: "3px", translateY: "-26px", delay: "0.12s" },
  { rotate: 108, color: "#f5ce50", size: "5px", translateY: "-28px", delay: "0s" },
  { rotate: 144, color: "#fe5064", size: "4px", translateY: "-27px", delay: "0.06s" },
  { rotate: 180, color: "#8eb539", size: "3px", translateY: "-26px", delay: "0.12s" },
  { rotate: 216, color: "#3e9be7", size: "5px", translateY: "-28px", delay: "0s" },
  { rotate: 252, color: "#f5ce50", size: "4px", translateY: "-27px", delay: "0.06s" },
  { rotate: 288, color: "#fe5064", size: "3px", translateY: "-26px", delay: "0.12s" },
  { rotate: 324, color: "#8eb539", size: "5px", translateY: "-28px", delay: "0s" }
];

export function LikeHeartAnimationV443({ liked }: { liked: boolean }) {
  return (
    <span className="likeHeartAnimationV443" aria-hidden="true" data-liked={liked ? "true" : "false"}>
      <span className="likeHeartShellV443">
        <span className="likeBurstRingV443" />
        {LIKE_BURST_PARTICLES_V443.map((particle) => (
          <span
            key={particle.rotate}
            className="likeBurstParticleV443"
            style={{
              "--rotate": `${particle.rotate}deg`,
              "--particle-color": particle.color,
              "--particle-size": particle.size,
              "--particle-translate-y": particle.translateY,
              "--particle-delay": particle.delay
            } as CSSProperties}
          />
        ))}
        <span className="likeHeartFillV443" />
      </span>
    </span>
  );
}

export const SongRowItem = memo(function SongRowItem({
  song,
  index,
  active,
  isPlaying,
  isDragging,
  isDropTarget,
  libraryDropSide,
  draggedSongTitle,
  onSelectSong,
  onToggleLike,
  onOpenPlaylistPicker,
  onOpenSongContextMenu,
  onStartSongDrag,
  onDragOverSong,
  onDragLeaveSong,
  onDropSong,
  onDragEnd
}: SongRowItemProps) {
  const isMissingFile = song.fileExists === false;

  return (
    <article
      className={`songRow ${active ? "active" : ""} ${active && isPlaying ? "playing" : ""} ${isDragging ? "songDragging" : ""} ${isDropTarget ? "songDropTarget" : ""} ${isMissingFile ? "songMissingFileV039" : ""}`}
      data-library-song-id={song.id}
      data-file-exists={isMissingFile ? "false" : "true"}
      data-drop-side={isDropTarget ? libraryDropSide : undefined}
      draggable
      onDragStart={(event) => onStartSongDrag(event, song.id)}
      onDragOver={(event) => onDragOverSong(event, song.id)}
      onDragLeave={(event) => onDragLeaveSong(event, song.id)}
      onDrop={(event) => onDropSong(event, song.id)}
      onDragEnd={onDragEnd}
      onContextMenu={(event) => onOpenSongContextMenu?.(event, song)}
      aria-grabbed={isDragging}
      title={isMissingFile ? "This song is still in Localtify, but the local audio file is missing." : draggedSongTitle ? `dragging ${draggedSongTitle}` : "drag onto another song to reorder, or drop on the bottom player to play next"}
      style={{ "--stagger": `${Math.min(index, 20) * 18}ms` } as CSSProperties}
    >
      <button className="songButton" onClick={() => onSelectSong(song.id, true)}>
        <span className="songIndex">{active && isPlaying ? <PlayingBarsIcon /> : index + 1}</span>

        <Cover song={song} className="songArt" />

        <span className="songMeta">
          <strong title={displaySongTitleV444(song, 12)}>{displaySongTitleV444(song, 7)}</strong>
          <small>{isMissingFile ? "missing local file · reimport or relink" : displaySongArtistV444(song)}</small>
        </span>
      </button>

      <span className="songInfo songDurationInfo">{isMissingFile ? "missing" : formatTime(song.duration)}</span>

      <button
        className={`iconAction likeActionV443 noActionHoverV444 ${song.liked ? "liked likeActionActiveV443" : ""}`}
        onClick={() => onToggleLike(song.id)}
        aria-label={song.liked ? "unlike song" : "like song"}
        aria-pressed={song.liked}
        title={song.liked ? "unlike" : "like"}
      >
        <LikeHeartAnimationV443 liked={song.liked} />
      </button>

      <button
        className="iconAction playlistAddAction noActionHoverV444"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onOpenPlaylistPicker(song);
        }}
        aria-label="add to playlist"
        title="add to playlist"
      >
        +
      </button>

    </article>
  );
});

export type HomeAlbumCardItemProps = SongInteractionHandlers & {
  song: Song;
  index: number;
  active: boolean;
  isPlaying: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  libraryDropSide: LibraryDropSide;
  draggedSongTitle: string;
};

export const HomeAlbumCardItem = memo(function HomeAlbumCardItem({
  song,
  index,
  active,
  isPlaying,
  isDragging,
  isDropTarget,
  libraryDropSide,
  draggedSongTitle,
  onSelectSong,
  onTogglePlay,
  onToggleLike,
  onOpenPlaylistPicker,
  onOpenSongContextMenu,
  onStartSongDrag,
  onPointerStartSongDrag,
  registerLibrarySongElement,
  onDragOverSong,
  onDragLeaveSong,
  onDropSong,
  onDragEnd
}: HomeAlbumCardItemProps) {
  const rankLabel = index < 9 ? `0${index + 1}` : String(index + 1);
  const cardCoverCssUrl = getCardCoverCssUrl(song);

  function clickedInteractiveElement(target: EventTarget | null) {
    return target instanceof HTMLElement
      ? Boolean(target.closest("button, input, textarea, select, a, [role='button'], .homeAlbumActions"))
      : false;
  }

  return (
    <article
      ref={(element) => registerLibrarySongElement?.(song.id, element)}
      className={`homeAlbumCard ${active ? "active" : ""} ${active && isPlaying ? "playing" : ""} ${isDragging ? "songDragging" : ""} ${isDropTarget ? "songDropTarget" : ""}`}
      data-library-song-id={song.id}
      data-drop-side={isDropTarget ? libraryDropSide : undefined}
      draggable={false}
      onClick={(event) => {
        if (clickedInteractiveElement(event.target)) return;
        onSelectSong(song.id, true);
      }}
      onPointerDown={(event) => {
        if (clickedInteractiveElement(event.target)) return;
        onPointerStartSongDrag?.(event, song.id);
      }}
      onContextMenu={(event) => onOpenSongContextMenu?.(event, song)}
      onDragStart={(event) => {
        event.preventDefault();
        onStartSongDrag(event, song.id);
      }}
      onDragOver={(event) => onDragOverSong(event, song.id)}
      onDragLeave={(event) => onDragLeaveSong(event, song.id)}
      onDrop={(event) => onDropSong(event, song.id)}
      onDragEnd={onDragEnd}
      aria-grabbed={isDragging}
      title={draggedSongTitle ? `dragging ${draggedSongTitle}` : "click to play, drag the card body to reorder"}
      style={{
        "--stagger": `${Math.min(index, 28) * 16}ms`,
        "--library-card-cover": cardCoverCssUrl
      } as CSSProperties}
    >
      <button
        className="homeAlbumPlayZone homeAlbumCoverButton"
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          active ? onTogglePlay() : onSelectSong(song.id, true);
        }}
        title={`${active && isPlaying ? "pause" : "play"} ${song.title}`}
        aria-label={`${active && isPlaying ? "pause" : "play"} ${song.title}`}
      >
        <Cover song={song} className="homeAlbumArt" />
        <span className="homeAlbumRank">{rankLabel}</span>
      </button>

      <div className="homeAlbumMeta">
        <strong title={song.title}>{prettyTitle(song.title, 7)}</strong>
        <small>{prettyMeta(song.artist)}</small>
      </div>

      <div className="homeAlbumStats">
        <span>{formatTime(song.duration)}</span>
      </div>

      <div className="homeAlbumActions">
        <button
          className={`iconAction likeActionV443 noActionHoverV444 ${song.liked ? "liked likeActionActiveV443" : ""}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onToggleLike(song.id);
          }}
          aria-label={song.liked ? "unlike song" : "like song"}
          aria-pressed={song.liked}
          title={song.liked ? "unlike" : "like"}
        >
          <LikeHeartAnimationV443 liked={song.liked} />
        </button>

        <button
          className="iconAction playlistAddAction noActionHoverV444"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onOpenPlaylistPicker(song);
          }}
          aria-label="add to playlist"
          title="add to playlist"
        >
          +
        </button>
      </div>
    </article>
  );
});


export type VirtualSongRowsProps = SongInteractionHandlers & {
  list: Song[];
  className: string;
  currentId: string;
  isPlaying: boolean;
  draggedSongId: string;
  libraryDragOverSongId: string;
  libraryDropSide: LibraryDropSide;
  draggedSongTitle: string;
  onAreaDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onAreaDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onAreaDrop: (event: DragEvent<HTMLDivElement>) => void;
};

export const VirtualSongRows = memo(function VirtualSongRows({
  list,
  className,
  currentId,
  isPlaying,
  draggedSongId,
  libraryDragOverSongId,
  libraryDropSide,
  draggedSongTitle,
  onAreaDragOver,
  onAreaDragLeave,
  onAreaDrop,
  onSelectSong,
  onTogglePlay,
  onToggleLike,
  onOpenPlaylistPicker,
  onOpenSongContextMenu,
  onStartSongDrag,
  onDragOverSong,
  onDragLeaveSong,
  onDropSong,
  onDragEnd
}: VirtualSongRowsProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: list.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 74,
    overscan: 5,
    getItemKey: (index) => list[index]?.id || index
  });

  if (!list.length) {
    return (
      <div
        className={className}
        onDragOver={onAreaDragOver}
        onDragLeave={onAreaDragLeave}
        onDrop={onAreaDrop}
      >
        <div className="emptyState mascotEmptyStateV496">
          <MascotStateArt state="empty" className="emptyStateMascotV496" />
          <span className="mascotEmptyCopyV496">
            <strong>import songs to fill this area</strong>
            <p>import some music and this area will wake up.</p>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={`${className} virtualSongViewport virtualSongRowsViewport`}
      onDragOver={onAreaDragOver}
      onDragLeave={onAreaDragLeave}
      onDrop={onAreaDrop}
      data-virtual-count={list.length}
    >
      <div
        className="virtualSongCanvas"
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const song = list[virtualRow.index];
          if (!song) return null;

          const active = song.id === currentId;
          const isDragging = draggedSongId === song.id;
          const isDropTarget = Boolean(draggedSongId && draggedSongId !== song.id && libraryDragOverSongId === song.id);

          return (
            <div
              key={virtualRow.key}
              ref={rowVirtualizer.measureElement}
              data-index={virtualRow.index}
              className="virtualSongItem"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              <SongRowItem
                song={song}
                index={virtualRow.index}
                active={active}
                isPlaying={isPlaying}
                isDragging={isDragging}
                isDropTarget={isDropTarget}
                libraryDropSide={libraryDropSide}
                draggedSongTitle={draggedSongTitle}
                onSelectSong={onSelectSong}
                onTogglePlay={onTogglePlay}
                onToggleLike={onToggleLike}
                onOpenPlaylistPicker={onOpenPlaylistPicker}
                onOpenSongContextMenu={onOpenSongContextMenu}
                onStartSongDrag={onStartSongDrag}
                onDragOverSong={onDragOverSong}
                onDragLeaveSong={onDragLeaveSong}
                onDropSong={onDropSong}
                onDragEnd={onDragEnd}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});

export type VirtualHomeSongCardsProps = SongInteractionHandlers & {
  list: Song[];
  className: string;
  currentId: string;
  isPlaying: boolean;
  draggedSongId: string;
  libraryDragOverSongId: string;
  libraryDropSide: LibraryDropSide;
  draggedSongTitle: string;
  onAreaDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onAreaDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onAreaDrop: (event: DragEvent<HTMLDivElement>) => void;
};

export const VirtualHomeSongCards = memo(function VirtualHomeSongCards({
  list,
  className,
  currentId,
  isPlaying,
  draggedSongId,
  libraryDragOverSongId,
  libraryDropSide,
  draggedSongTitle,
  onAreaDragOver,
  onAreaDragLeave,
  onAreaDrop,
  onSelectSong,
  onTogglePlay,
  onToggleLike,
  onOpenPlaylistPicker,
  onOpenSongContextMenu,
  onStartSongDrag,
  onPointerStartSongDrag,
  registerLibrarySongElement,
  onDragOverSong,
  onDragLeaveSong,
  onDropSong,
  onDragEnd
}: VirtualHomeSongCardsProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  useLayoutEffect(() => {
    const element = parentRef.current;
    if (!element) return;

    const updateWidth = () => setViewportWidth(element.clientWidth || 0);
    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const isSimpleGrid = className.includes("simpleAlbumGrid");
  const minColumnWidth = isSimpleGrid ? 156 : 168;
  const gridGap = 14;
  const columns = Math.max(1, Math.floor(((viewportWidth || minColumnWidth) + gridGap) / (minColumnWidth + gridGap)));
  const rowCount = Math.max(1, Math.ceil(list.length / columns));

  const rowVirtualizer = useVirtualizer({
    count: list.length ? rowCount : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 256,
    overscan: 2,
    getItemKey: (rowIndex) => {
      const firstSong = list[rowIndex * columns];
      return firstSong?.id ? `${firstSong.id}-${columns}` : `${rowIndex}-${columns}`;
    }
  });

  if (!list.length) {
    return (
      <div
        className={className}
        onDragOver={onAreaDragOver}
        onDragLeave={onAreaDragLeave}
        onDrop={onAreaDrop}
      >
        <div className="emptyState homeAlbumEmpty">
          <strong>import songs to fill this area</strong>
          <p>import some music and this expanded area turns into a proper home library.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={`${className} virtualSongViewport virtualHomeGridViewport`}
      onDragOver={onAreaDragOver}
      onDragLeave={onAreaDragLeave}
      onDrop={onAreaDrop}
      data-virtual-count={list.length}
      data-virtual-columns={columns}
    >
      <div
        className="virtualSongCanvas virtualHomeGridCanvas"
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const rowStartIndex = virtualRow.index * columns;
          const rowSongs = list.slice(rowStartIndex, rowStartIndex + columns);

          return (
            <div
              key={virtualRow.key}
              ref={rowVirtualizer.measureElement}
              data-index={virtualRow.index}
              className="virtualHomeGridRow"
              style={{
                transform: `translateY(${virtualRow.start}px)`,
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`
              }}
            >
              {rowSongs.map((song, offset) => {
                const index = rowStartIndex + offset;
                const active = song.id === currentId;
                const isDragging = draggedSongId === song.id;
                const isDropTarget = Boolean(draggedSongId && draggedSongId !== song.id && libraryDragOverSongId === song.id);

                return (
                  <HomeAlbumCardItem
                    key={song.id}
                    song={song}
                    index={index}
                    active={active}
                    isPlaying={isPlaying}
                    isDragging={isDragging}
                    isDropTarget={isDropTarget}
                    libraryDropSide={libraryDropSide}
                    draggedSongTitle={draggedSongTitle}
                    onSelectSong={onSelectSong}
                    onTogglePlay={onTogglePlay}
                    onToggleLike={onToggleLike}
                    onOpenPlaylistPicker={onOpenPlaylistPicker}
                    onOpenSongContextMenu={onOpenSongContextMenu}
                    onStartSongDrag={onStartSongDrag}
                    onPointerStartSongDrag={onPointerStartSongDrag}
                    registerLibrarySongElement={registerLibrarySongElement}
                    onDragOverSong={onDragOverSong}
                    onDragLeaveSong={onDragLeaveSong}
                    onDropSong={onDropSong}
                    onDragEnd={onDragEnd}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
});
