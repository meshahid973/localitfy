import { useMemo } from "react";

import { usePageVirtualizer } from "../../../shared/hooks/usePageVirtualizer";
import type { CoverGalleryEntry, CoverMood } from "../cover.types";
import { chunkItems } from "../cover.utils";
import { useMeasuredWidth } from "../useMeasuredWidth";
import CoverCuteEmptyState from "./CoverCuteEmptyState";
import CoverGalleryImage from "./CoverGalleryImage";

export default function VirtualCoverGalleryGrid({ entries, pixelArtBusy, pixelArtUrl, coverMoodName, onPreviewCover, onApplyCover, togglePixelCoverExcluded }: {
  entries: CoverGalleryEntry[]; pixelArtBusy: boolean; pixelArtUrl: (file: string) => string; coverMoodName: (mood: CoverMood) => string;
  onPreviewCover: (entry: CoverGalleryEntry) => void; onApplyCover: (entry: CoverGalleryEntry) => void | Promise<void>; togglePixelCoverExcluded: (key: string) => void;
}) {
  const [measuredRef, width] = useMeasuredWidth<HTMLDivElement>();
  const columns = Math.max(1, Math.floor((Math.max(width, 0) + 12) / 168));
  const rows = useMemo(() => chunkItems(entries, columns), [entries, columns]);
  const { listRef, virtualizer: rowVirtualizer, scrollMargin } = usePageVirtualizer<HTMLDivElement>({ count: rows.length, estimateSize: () => 228, overscan: 1 });
  const parentRef = (element: HTMLDivElement | null) => { measuredRef.current = element; listRef(element); };
  if (!entries.length) return <div ref={parentRef} className="coverGalleryGridCleanOnly"><CoverCuteEmptyState title="No covers found" message="Try another search or adjust your cover filters." /></div>;
  return <div ref={parentRef} className="coverGalleryGridCleanOnly"><div className="coverGalleryVirtualCanvasCleanOnly" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>{rowVirtualizer.getVirtualItems().map((virtualRow) => <div key={virtualRow.key} data-index={virtualRow.index} className="coverGalleryVirtualRowCleanOnly" style={{ top: `${virtualRow.start - scrollMargin}px`, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>{(rows[virtualRow.index] || []).map((entry) => { const imageUrl = entry.asset.url || pixelArtUrl(entry.asset.file); const tags = entry.tags.map(coverMoodName).filter(Boolean).slice(0, 2).join(" · "); return <article key={entry.key} className={`coverGalleryCardCleanOnly ${entry.excluded ? "excluded" : ""}`} onFocus={() => onPreviewCover(entry)}><button type="button" className="coverGalleryImageButtonCleanOnly" onClick={() => void onApplyCover(entry)} disabled={pixelArtBusy} title="apply cover"><CoverGalleryImage src={imageUrl} label={entry.asset.label} /></button><div className="coverGalleryInfoCleanOnly"><strong title={entry.asset.label}>{entry.asset.label}</strong><small>{entry.usage} use{entry.usage === 1 ? "" : "s"}{tags ? ` • ${tags}` : ""}</small></div><div className="coverGalleryActionsCleanOnly"><button type="button" onClick={() => togglePixelCoverExcluded(entry.key)} className={`coverHideButton ${entry.excluded ? "danger active" : ""}`} aria-label={entry.excluded ? "show cover again" : "hide cover"} title={entry.excluded ? "show cover again" : "hide cover"}><span aria-hidden="true">{entry.excluded ? "↺" : "×"}</span></button><button type="button" className="coverApplyButton" disabled={pixelArtBusy} onClick={() => void onApplyCover(entry)} title="apply this cover">apply</button></div></article>; })}</div>)}</div></div>;
}
