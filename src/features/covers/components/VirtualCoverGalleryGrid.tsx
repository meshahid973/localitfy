import { useMemo } from "react";
import type { CSSProperties } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { CoverGalleryEntry, CoverMood } from "../cover.types";
import { chunkItems } from "../cover.utils";
import { useMeasuredWidth } from "../useMeasuredWidth";
import CoverCuteEmptyState from "./CoverCuteEmptyState";
import CoverGalleryImage from "./CoverGalleryImage";

export default function VirtualCoverGalleryGrid({ entries, pixelArtBusy, pixelArtUrl, coverMoodName, onPreviewCover, onApplyCover, togglePixelCoverExcluded }: {
  entries: CoverGalleryEntry[]; pixelArtBusy: boolean; pixelArtUrl: (file: string) => string; coverMoodName: (mood: CoverMood) => string;
  onPreviewCover: (entry: CoverGalleryEntry) => void; onApplyCover: (entry: CoverGalleryEntry) => void | Promise<void>; togglePixelCoverExcluded: (key: string) => void;
}) {
  const [parentRef, width] = useMeasuredWidth<HTMLDivElement>();
  const columns = Math.max(2, Math.floor((Math.max(width, 320) + 10) / 132));
  const rows = useMemo(() => chunkItems(entries, columns), [entries, columns]);
  const rowVirtualizer = useVirtualizer({ count: rows.length, getScrollElement: () => parentRef.current, estimateSize: () => 184, overscan: 1 });
  if (!entries.length) return <CoverCuteEmptyState />;
  return <div ref={parentRef} className="coverGalleryGridCleanOnly"><div className="coverGalleryVirtualCanvasCleanOnly" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>{rowVirtualizer.getVirtualItems().map((virtualRow) => <div key={virtualRow.key} data-index={virtualRow.index} className="coverGalleryVirtualRowCleanOnly" style={{ "--cover-gallery-row-y": `${virtualRow.start}px`, transform: "translate3d(0, var(--cover-gallery-row-y), 0)", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } as CSSProperties}>{(rows[virtualRow.index] || []).map((entry) => { const imageUrl = entry.asset.url || pixelArtUrl(entry.asset.file); const tags = entry.tags.map(coverMoodName).filter(Boolean).slice(0, 2).join(" · "); return <article key={entry.key} className={`coverGalleryCardCleanOnly ${entry.excluded ? "excluded" : ""}`} onFocus={() => onPreviewCover(entry)}><button type="button" className="coverGalleryImageButtonCleanOnly" onClick={() => void onApplyCover(entry)} disabled={pixelArtBusy} title="apply cover"><CoverGalleryImage src={imageUrl} label={entry.asset.label} /></button><div className="coverGalleryInfoCleanOnly"><strong title={entry.asset.label}>{entry.asset.label}</strong><small>{entry.usage} use{entry.usage === 1 ? "" : "s"}{tags ? ` • ${tags}` : ""}</small></div><div className="coverGalleryActionsCleanOnly"><button type="button" onClick={() => togglePixelCoverExcluded(entry.key)} className={`coverHideButton ${entry.excluded ? "danger active" : ""}`} aria-label={entry.excluded ? "show cover again" : "hide cover"} title={entry.excluded ? "show cover again" : "hide cover"}><span aria-hidden="true">{entry.excluded ? "↺" : "×"}</span></button><button type="button" className="coverApplyButton" disabled={pixelArtBusy} onClick={() => void onApplyCover(entry)} title="apply this cover">apply</button></div></article>; })}</div>)}</div></div>;
}
