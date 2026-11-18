import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { Song } from "../library/song.types";
import { toCssUrl } from "../../shared/utils/format";
import { hexToRgbString, normalizeHexColor } from "../settings/theme.utils";
import { pixelArtForSong } from "./cover.runtime";
import { runtimePixelArtImageUrl } from "./pixelArt";
import { extractArtworkPalette, PaletteCache, rgbFromHex, rgbHex, safeAtmosphere, SAMPLE_SIZE, type ArtworkPalette } from "./artworkPalette";
export function getAmbientStyle(coverUrl?:string|null):CSSProperties|undefined{return coverUrl?{"--cover-url":toCssUrl(coverUrl),"--cover-art-url":toCssUrl(coverUrl)} as CSSProperties:undefined;}
export function isRendererSafeImageUrl(value?:string|null){return Boolean(value&&/^(?:data:image\/|blob:|https?:\/\/|localtify-media:\/\/|\/|pixelart\/)/i.test(String(value).trim()));}
export function getRendererSafeImageUrl(value?:string|null){const source=String(value||"").trim();return isRendererSafeImageUrl(source)?source:"";}
export function getSongAmbientSource(song?:Song|null){if(!song)return"";return getRendererSafeImageUrl(song.coverThumbUrl)||getRendererSafeImageUrl(song.coverThumbnailUrl)||getRendererSafeImageUrl(song.thumbnailUrl)||getRendererSafeImageUrl(song.coverUrl)||getRendererSafeImageUrl(song.coverPath)||getRendererSafeImageUrl(song.coverFullUrl)||runtimePixelArtImageUrl(pixelArtForSong(song));}
export type CoverAverageStyle = CSSProperties & {
  "--cover-rgb"?: string; "--player-ambient-rgb"?: string; "--active-cover-rgb"?: string;
  "--cover-average"?: string; "--cover-palette-state"?: "pending" | "ready" | "failed"; "--cover-palette-a"?: string; "--cover-palette-b"?: string; "--cover-palette-c"?: string;
};
const cache = new PaletteCache<CoverAverageStyle>();
const EMPTY_COVER_STYLE: CoverAverageStyle = {};
const PENDING_COVER_STYLE: CoverAverageStyle = { "--cover-palette-state": "pending" };
const FAILED_COVER_STYLE: CoverAverageStyle = { "--cover-palette-state": "failed" };
export function buildCoverAverageStyle(hex: string): CoverAverageStyle {
  const safe = normalizeHexColor(hex, "#8dffce"), rgb = hexToRgbString(safe, "#8dffce");
  return { "--cover-rgb": rgb, "--player-ambient-rgb": rgb, "--active-cover-rgb": rgb, "--cover-average": safe } as CoverAverageStyle;
}
function paletteStyle(palette: ArtworkPalette): CoverAverageStyle {
  return { ...buildCoverAverageStyle(rgbHex(palette[0])),
    "--cover-palette-state": "ready", "--cover-palette-a": rgbHex(palette[0]), "--cover-palette-b": rgbHex(palette[1]), "--cover-palette-c": rgbHex(palette[2]) };
}

/** Read only a small, CPU-side thumbnail. Cancellation also drops decode
 * handlers and the image reference; inaccessible remote pixels stay neutral. */
export function decodeArtwork(source: string, signal: AbortSignal, samplePixels = false): Promise<ArtworkPalette | true | null> {
  return new Promise(resolve => {
    if (!source || signal.aborted) { resolve(null); return; }
    const image = new Image();
    if (samplePixels && /^https?:/i.test(source)) image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    let settled = false;
    const finish = (value: ArtworkPalette | true | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      signal.removeEventListener("abort", cancel);
      image.onload = image.onerror = null;
      if (value === null) image.removeAttribute("src");
      resolve(value);
    };
    const cancel = () => finish(null);
    const timeout = window.setTimeout(cancel, 2000);
    signal.addEventListener("abort", cancel, { once: true });
    image.onerror = cancel;
    image.onload = async () => {
      try {
        if (typeof image.decode === "function") await image.decode();
        if (settled || signal.aborted || !image.naturalWidth) { finish(null); return; }
        if (!samplePixels) { finish(true); return; }
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = SAMPLE_SIZE;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) { finish(null); return; }
        ctx.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        finish(extractArtworkPalette(ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data));
      } catch { finish(null); }
    };
    image.src = source;
  });
}

export function useCoverAverageStyle(source: string, enabled: boolean, visible = true) {
  const coverSource = enabled ? source.trim() : "";
  const [sample, setSample] = useState<{ source: string; style: CoverAverageStyle } | null>(null);
  useEffect(() => {
    if (!coverSource || !visible) return;
    const cached = cache.get(coverSource);
    if (cached) { setSample({ source: coverSource, style: cached }); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void decodeArtwork(coverSource, controller.signal, true).then(result => {
        if (controller.signal.aborted) return;
        const style = result && result !== true ? paletteStyle(result) : FAILED_COVER_STYLE;
        if (result && result !== true) cache.set(coverSource, style);
        setSample({ source: coverSource, style });
      });
    }, 60);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [coverSource, visible]);
  if (!coverSource || !visible) return EMPTY_COVER_STYLE;
  return sample?.source === coverSource ? sample.style : PENDING_COVER_STYLE;
}

/** Keep the last decoded palette while a new sample is pending. */
export function useWorkspacePalette(style: CSSProperties, enabled: boolean, light: boolean, strength: number) {
  const sample = style as CoverAverageStyle;
  const one = sample["--cover-palette-a"], two = sample["--cover-palette-b"], three = sample["--cover-palette-c"];
  const status = sample["--cover-palette-state"];
  const current = useMemo<ArtworkPalette | null>(() => {
    const a = rgbFromHex(one ?? ""), b = rgbFromHex(two ?? ""), c = rgbFromHex(three ?? "");
    return a && b && c ? [a, b, c] : null;
  }, [one, two, three]);
  const [last, setLast] = useState<ArtworkPalette | null>(null);
  useEffect(() => {
    if (!enabled || status !== "pending") setLast(enabled ? current : null);
  }, [enabled, status, current]);
  const palette = enabled ? current ?? (status === "pending" ? last : null) : null;
  return useMemo(() => palette ? safeAtmosphere(palette, light, strength).map(rgbHex) : undefined, [palette, light, strength]);
}
