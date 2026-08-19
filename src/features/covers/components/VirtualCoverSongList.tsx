import { useMemo, useRef } from "react";
import type { CSSProperties, ComponentType } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { CoverSong } from "../cover.types";
import CoverCuteEmptyState from "./CoverCuteEmptyState";

export default function VirtualCoverSongList({ songs, selectedIds, CoverComponent, prettyTitle, prettyMeta, toggleCoverSongSelection }: {
  songs: CoverSong[];
  selectedIds: string[];
  CoverComponent: ComponentType<{ song: CoverSong | null; className: string }>;
  prettyTitle: (title: string, words?: number) => string;
  prettyMeta: (text: string) => string;
  toggleCoverSongSelection: (songId: string) => void;
}) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const rowVirtualizer = useVirtualizer({ count: songs.length, getScrollElement: () => parentRef.current, estimateSize: () => 56, overscan: 1, getItemKey: (index) => songs[index]?.id || index });
  if (!songs.length) return <CoverCuteEmptyState />;
  return <div ref={parentRef} className="coverSongList coverSongListVirtual coverSongListClean"><div className="coverSongVirtualCanvas" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>{rowVirtualizer.getVirtualItems().map((virtualRow) => { const song = songs[virtualRow.index]; if (!song) return null; const selected = selectedSet.has(song.id); return <button key={virtualRow.key} data-index={virtualRow.index} type="button" className={`coverSongPick coverSongPickVirtual ${selected ? "active" : ""}`} onClick={() => toggleCoverSongSelection(song.id)} title={song.title || "unknown song"} style={{ "--cover-song-y": `${virtualRow.start}px`, transform: "translate3d(0, var(--cover-song-y), 0)" } as CSSProperties}><CoverComponent song={song} className="coverSongThumb" /><span><strong>{prettyTitle(String(song.title || "untitled"), 6)}</strong><small>{prettyMeta(String(song.artist || "unknown artist"))}</small></span><em>{selected ? "✓" : "+"}</em></button>; })}</div></div>;
}
