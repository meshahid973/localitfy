import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { FastAverageColor } from "fast-average-color";
import type { Song } from "../library/song.types";
import { toCssUrl } from "../../shared/utils/format";
import { hexToRgbString, normalizeHexColor } from "../settings/theme.utils";
import { pixelArtForSong } from "./cover.runtime";
import { runtimePixelArtImageUrl } from "./pixelArt";
export function getAmbientStyle(coverUrl?:string|null):CSSProperties|undefined{return coverUrl?{"--cover-url":toCssUrl(coverUrl),"--cover-art-url":toCssUrl(coverUrl)} as CSSProperties:undefined;}
export function isRendererSafeImageUrl(value?:string|null){return Boolean(value&&/^(?:data:image\/|blob:|https?:\/\/|localtify-media:\/\/|\/|pixelart\/)/i.test(String(value).trim()));}
export function getRendererSafeImageUrl(value?:string|null){const source=String(value||"").trim();return isRendererSafeImageUrl(source)?source:"";}
export function getSongAmbientSource(song?:Song|null){if(!song)return"";return getRendererSafeImageUrl(song.coverThumbUrl)||getRendererSafeImageUrl(song.coverThumbnailUrl)||getRendererSafeImageUrl(song.thumbnailUrl)||getRendererSafeImageUrl(song.coverUrl)||getRendererSafeImageUrl(song.coverPath)||getRendererSafeImageUrl(song.coverFullUrl)||runtimePixelArtImageUrl(pixelArtForSong(song));}
export type CoverAverageStyle=CSSProperties&{"--cover-rgb"?:string;"--player-ambient-rgb"?:string;"--active-cover-rgb"?:string;"--cover-average"?:string};
const MAX_COVER_COLORS = 512;
const coverAverageColorCache = new Map<string, CoverAverageStyle>();
const EMPTY_COVER_STYLE: CoverAverageStyle = {};

function cachedCoverStyle(source: string) {
  const style = coverAverageColorCache.get(source);
  if (style) {
    coverAverageColorCache.delete(source);
    coverAverageColorCache.set(source, style);
  }
  return style;
}

function rememberCoverStyle(source: string, style: CoverAverageStyle) {
  coverAverageColorCache.delete(source);
  coverAverageColorCache.set(source, style);
  if (coverAverageColorCache.size > MAX_COVER_COLORS) {
    const oldest = coverAverageColorCache.keys().next();
    if (!oldest.done) coverAverageColorCache.delete(oldest.value);
  }
}
const fastAverageColor=typeof window!=="undefined"?new FastAverageColor():null;
export function buildCoverAverageStyle(hex:string):CoverAverageStyle{const safe=normalizeHexColor(hex,"#8dffce"),rgb=hexToRgbString(safe,"#8dffce");return{"--cover-rgb":rgb,"--player-ambient-rgb":rgb,"--active-cover-rgb":rgb,"--cover-average":safe} as CoverAverageStyle;}
export function useCoverAverageStyle(source: string, enabled: boolean, visible = true) {
  const coverSource = enabled ? String(source || "").trim() : "";
  const [sample, setSample] = useState<{ source: string; style: CoverAverageStyle } | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    if (!coverSource || !fastAverageColor || !visible) return;
    const cached = cachedCoverStyle(coverSource);
    if (cached) {
      setSample({ source: coverSource, style: cached });
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      fastAverageColor.getColorAsync(coverSource, { algorithm: "sqrt", mode: "precision" }).then(color => {
        if (cancelled || requestIdRef.current !== requestId) return;
        const next = buildCoverAverageStyle(color.hex);
        rememberCoverStyle(coverSource, next);
        setSample({ source: coverSource, style: next });
      }).catch(() => {
        if (!cancelled && requestIdRef.current === requestId) setSample(null);
      });
    }, 80);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [coverSource, visible]);

  // No stale tint between a track change and its artwork-color result.
  return coverSource && sample?.source === coverSource ? sample.style : EMPTY_COVER_STYLE;
}

/** Retain the outgoing tint while a new thumbnail is sampled or the view changes.
 * A failed sample eventually restores the theme. No polling or animation loop.
 */
export function useWorkspaceCoverColor(style: CSSProperties, songId: string | undefined, enabled: boolean) {
  const color = (style as CoverAverageStyle)["--cover-average"];
  const [visible, setVisible] = useState<string>();
  useEffect(() => {
    if (!enabled || !songId) { setVisible(undefined); return; }
    if (color) { setVisible(color); return; }
    const timeout = window.setTimeout(() => setVisible(undefined), 2000);
    return () => window.clearTimeout(timeout);
  }, [enabled, songId, color]);
  return enabled && songId ? visible : undefined;
}
