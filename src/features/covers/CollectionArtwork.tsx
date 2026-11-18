import { memo, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Song } from "../library/song.types";
import { getSongAmbientSource, readArtworkPalette } from "./cover.ambient";
import { mixArtworkPalette, PaletteCache, rgbHex, type ArtworkPalette } from "./artworkPalette";
import { pickHomeMixArtwork } from "../home/homeShelfPicks";

import "./collection-artwork.css";

const cache = new PaletteCache<ArtworkPalette>(96);
export const CollectionArtwork = memo(function CollectionArtwork({ id, name, songs, ordinal, className = "" }: {
  id: string; name: string; songs: readonly Song[]; ordinal?: number; className?: string;
}) {
  const key = useMemo(() => JSON.stringify([id, ...pickHomeMixArtwork(songs).map(getSongAmbientSource).filter(Boolean)]), [id, songs]);
  const fallback = useMemo(() => mixArtworkPalette([], id), [id]);
  const [sample, setSample] = useState<{ key: string; colors: ArtworkPalette } | null>(null);
  const [element, setElement] = useState<HTMLSpanElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => setVisible(entries.some(entry => entry.isIntersecting)), { rootMargin: "160px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  useEffect(() => {
    if (!visible) return;
    const cached = cache.get(key);
    if (cached) { setSample({key, colors: cached}); return; }
    const controller = new AbortController();
    const sources = (JSON.parse(key) as string[]).slice(1);
    const work = async () => {
      const samples: ArtworkPalette[] = [];
      for (const source of [...new Set(sources)]) {
        if (controller.signal.aborted) return;
        const value = await readArtworkPalette(source, controller.signal);
        if (value) samples.push(value);
      }
      if (controller.signal.aborted) return;
      const colors = mixArtworkPalette(samples, id);
      if (samples.length || !sources.length) cache.set(key, colors);
      setSample({ key, colors });
    };
    void work();
    return () => controller.abort();
  }, [key, id, visible]);
  const colors = sample?.key === key ? sample.colors : fallback;
  return <span ref={setElement} className={`generatedCollectionArtwork ${className}`} aria-hidden="true"
    style={{ "--mix-a": rgbHex(colors[0]), "--mix-b": rgbHex(colors[1]), "--mix-c": rgbHex(colors[2]) } as CSSProperties}>
    {ordinal !== undefined ? <span className="generatedArtworkNumber">{String(ordinal).padStart(2, "0")}</span> : null}
    <span className="generatedArtworkName">{name}</span>
  </span>;
});
