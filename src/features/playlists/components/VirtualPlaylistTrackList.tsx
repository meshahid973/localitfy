import { memo, useCallback, useRef, useState } from "react";
import type { CSSProperties, DragEvent, MouseEvent as ReactMouseEvent } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { GripVertical, X } from "lucide-react";
import type { Song, LibraryDropSide } from "../../library/song.types";
import { Cover } from "../../covers/Cover";
import { MascotStateArt, PlayingBarsIcon } from "../../../shared/ui/LocaltifyViewUi";
import { formatTime } from "../../../shared/utils/format";
import { displaySongArtistV444, displaySongTitleV444 } from "../../library/components/SongRows";

export function readPlaylistDraggedSongId(event: DragEvent<HTMLElement>, fallbackSongId = "") {
  return (
    event.dataTransfer.getData("text/localitfy-song-id") ||
    event.dataTransfer.getData("text/plain") ||
    fallbackSongId
  );
}

export function getPlaylistDropSide(event: DragEvent<HTMLElement>): LibraryDropSide {
  const rect = event.currentTarget.getBoundingClientRect();
  const centerY = rect.top + rect.height / 2;
  return event.clientY < centerY ? "before" : "after";
}

export type VirtualPlaylistTrackListProps = {
  selectedPlaylistId: string;
  list: Song[];
  currentId: string;
  isPlaying: boolean;
  draggedSongId: string;
  onSelectSong: (songId: string) => void;
  onStartSongDrag: (event: DragEvent<HTMLElement>, songId: string) => void;
  onDropSong: (playlistId: string, draggedSongId: string, targetSongId: string, side: LibraryDropSide) => void;
  onAppendSong: (playlistId: string, draggedSongId: string) => void;
  onDragEnd: () => void;
  onOpenContextMenu: (event: ReactMouseEvent<HTMLElement>, song: Song) => void;
  onRemoveSong: (playlistId: string, songId: string) => void;
};

export const VirtualPlaylistTrackList = memo(function VirtualPlaylistTrackList({
  selectedPlaylistId,
  list,
  currentId,
  isPlaying,
  draggedSongId,
  onSelectSong,
  onStartSongDrag,
  onDropSong,
  onAppendSong,
  onDragEnd,
  onOpenContextMenu,
  onRemoveSong
}: VirtualPlaylistTrackListProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [dropTarget, setDropTarget] = useState<{ songId: string; side: LibraryDropSide } | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: list.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 5,
    getItemKey: (index) => `${selectedPlaylistId}-${list[index]?.id || index}`
  });

  const clearLocalDropTarget = useCallback(() => {
    setDropTarget((current) => (current ? null : current));
  }, []);

  const handleEmptyDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    const songId = readPlaylistDraggedSongId(event, draggedSongId);
    if (!selectedPlaylistId || !songId) return;

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
  }, [draggedSongId, selectedPlaylistId]);

  const handleEmptyDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    const songId = readPlaylistDraggedSongId(event, draggedSongId);
    if (!selectedPlaylistId || !songId) return;

    event.preventDefault();
    event.stopPropagation();
    onAppendSong(selectedPlaylistId, songId);
    clearLocalDropTarget();
    onDragEnd();
  }, [clearLocalDropTarget, draggedSongId, onAppendSong, onDragEnd, selectedPlaylistId]);

  if (!selectedPlaylistId || !list.length) {
    return (
      <div
        className={`playlistEmptyState playlistMascotEmptyV496 ${selectedPlaylistId ? "playlistDropEmpty" : ""}`}
        onDragOver={handleEmptyDragOver}
        onDrop={handleEmptyDrop}
      >
        <MascotStateArt state={selectedPlaylistId ? "question" : "empty"} className="playlistEmptyMascotV496" />
        <span className="mascotEmptyCopyV496">
          <strong>{selectedPlaylistId ? "This playlist is empty" : "Choose a playlist"}</strong>
          <p>{selectedPlaylistId ? "Drop a song here, or use the + button on any song to add music." : "Your playlist songs will show up here."}</p>
        </span>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="playlistTrackList virtualPlaylistTrackList" aria-label="playlist songs">
      <div className="virtualPlaylistTrackCanvas" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const song = list[virtualRow.index];
          if (!song) return null;

          const active = song.id === currentId;
          const isDragging = draggedSongId === song.id;
          const isDropTarget = dropTarget?.songId === song.id && draggedSongId !== song.id;

          return (
            <article
              key={virtualRow.key}
              ref={rowVirtualizer.measureElement}
              data-index={virtualRow.index}
              className={`playlistTrackRow virtualPlaylistTrackRow ${active ? "active" : ""} ${active && isPlaying ? "playing" : ""} ${isDragging ? "songDragging" : ""} ${isDropTarget ? "songDropTarget" : ""}`}
              data-drop-side={isDropTarget ? dropTarget?.side : undefined}
              style={{
                "--playlist-row-y": `${virtualRow.start}px`,
                "--playlist-stagger": Math.min(virtualRow.index, 12)
              } as CSSProperties}
              draggable
              onDragStart={(event) => onStartSongDrag(event, song.id)}
              onDragOver={(event) => {
                const incomingSongId = readPlaylistDraggedSongId(event, draggedSongId);
                if (!incomingSongId || incomingSongId === song.id) return;

                event.preventDefault();
                event.stopPropagation();
                event.dataTransfer.dropEffect = list.some((item) => item.id === incomingSongId) ? "move" : "copy";

                const side = getPlaylistDropSide(event);
                setDropTarget((current) => (
                  current?.songId === song.id && current.side === side
                    ? current
                    : { songId: song.id, side }
                ));
              }}
              onDragLeave={(event) => {
                const nextTarget = event.relatedTarget;
                if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
                setDropTarget((current) => (current?.songId === song.id ? null : current));
              }}
              onDrop={(event) => {
                const incomingSongId = readPlaylistDraggedSongId(event, draggedSongId);
                if (!incomingSongId || incomingSongId === song.id) return;

                event.preventDefault();
                event.stopPropagation();
                const side = getPlaylistDropSide(event);
                onDropSong(selectedPlaylistId, incomingSongId, song.id, side);
                clearLocalDropTarget();
                onDragEnd();
              }}
              onDragEnd={() => {
                clearLocalDropTarget();
                onDragEnd();
              }}
              onContextMenu={(event) => onOpenContextMenu(event, song)}
            >
              <span className="playlistTrackGrip"><GripVertical size={14} strokeWidth={2.25} /></span>
              <button className="playlistTrackMain" type="button" onClick={() => onSelectSong(song.id)}>
                <span className="playlistTrackIndex">{active && isPlaying ? <PlayingBarsIcon /> : virtualRow.index + 1}</span>
                <Cover song={song} className="playlistTrackCover" />
                <span className="playlistTrackText">
                  <strong>{displaySongTitleV444(song, 7)}</strong>
                  <small>{displaySongArtistV444(song)}</small>
                </span>
              </button>
              <span className="playlistTrackDuration">{formatTime(song.duration)}</span>
              <button className="iconAction iconActionSvg" type="button" onClick={() => onRemoveSong(selectedPlaylistId, song.id)} aria-label="remove from playlist">
                <X size={16} strokeWidth={2.5} />
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
});
