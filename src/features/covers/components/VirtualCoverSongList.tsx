import { useMemo } from "react";
import type { ComponentType } from "react";
import { usePageVirtualizer } from "../../../shared/hooks/usePageVirtualizer";
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
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const { listRef: parentRef, virtualizer: rowVirtualizer, scrollMargin } = usePageVirtualizer<HTMLDivElement>({ count: songs.length, estimateSize: () => 56, overscan: 1, getItemKey: (index) => songs[index]?.id || index });
  if (!songs.length) return <div ref={parentRef} className="coverSongList coverSongListVirtual coverSongListClean"><CoverCuteEmptyState /></div>;
  return <div ref={parentRef} className="coverSongList coverSongListVirtual coverSongListClean"><div className="coverSongVirtualCanvas" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>{rowVirtualizer.getVirtualItems().map((virtualRow) => { const song = songs[virtualRow.index]; if (!song) return null; const selected = selectedSet.has(song.id); return <button key={virtualRow.key} data-index={virtualRow.index} type="button" className={`coverSongPick coverSongPickVirtual ${selected ? "active" : ""}`} onClick={() => toggleCoverSongSelection(song.id)} aria-pressed={selected} title={song.title || "unknown song"} style={{ top: `${virtualRow.start - scrollMargin}px` }}><CoverComponent song={song} className="coverSongThumb" /><span><strong>{prettyTitle(String(song.title || "untitled"), 6)}</strong><small>{prettyMeta(String(song.artist || "unknown artist"))}</small></span><em>{selected ? "✓" : "+"}</em></button>; })}</div></div>;
}
