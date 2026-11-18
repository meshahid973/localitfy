import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Song } from "../library/song.types";
import { getRendererSafeImageUrl, readArtworkPalette } from "./cover.ambient";
import { combinePagePalettes, rgbHex, safeAtmosphere, type ArtworkPalette } from "./artworkPalette";

export type PageAtmosphereRegistration = { route: string; sources: string[] };
export const PageAtmosphereContext = createContext<{
  route: string;
  register: (registration: PageAtmosphereRegistration | null, previous?: PageAtmosphereRegistration) => void;
} | null>(null);

/** A bounded, distinct sample of the actual visible collection artwork. No generated fallback tint. */
export function pageArtworkSources(songs: readonly Song[], custom?: string | null): string[] {
  const sources = new Set<string>();
  const preferred = getRendererSafeImageUrl(custom);
  if (preferred) sources.add(preferred);
  for (const song of songs.slice(0, 64)) {
    if (sources.size >= 3) break;
    const source = [song.coverThumbUrl, song.coverThumbnailUrl, song.thumbnailUrl, song.coverUrl, song.coverPath, song.coverFullUrl]
      .map(getRendererSafeImageUrl).find(Boolean);
    if (source) sources.add(source);
  }
  return [...sources];
}

/** Register only for the mounted route; cleanup cannot clear a newer owner's registration. */
export function usePageAtmosphere(sources: readonly string[]) {
  const context = useContext(PageAtmosphereContext);
  const key = JSON.stringify(sources);
  useEffect(() => {
    if (!context) return;
    const registration = { route: context.route, sources: JSON.parse(key) as string[] };
    context.register(registration);
    return () => context.register(null, registration);
  }, [context, key]);
}

export function PageAtmosphere({ songs, custom }: { songs: readonly Song[]; custom?: string | null }) {
  const sources = useMemo(() => pageArtworkSources(songs, custom), [songs, custom]);
  usePageAtmosphere(sources);
  return null;
}

/** Decode only the active page's sources. Ignore stale work after navigation or hiding the window. */
export function usePagePalette(route: string, sources: readonly string[], enabled: boolean, light: boolean, strength: number) {
  const key = JSON.stringify(sources);
  const [sample, setSample] = useState<{ route: string; key: string; palette: ArtworkPalette | null } | null>(null);
  useEffect(() => {
    if (!enabled || key === "[]") return;
    const controller = new AbortController();
    const requested = JSON.parse(key) as string[];
    void Promise.all(requested.map(source => readArtworkPalette(source, controller.signal).catch(() => null))).then(results => {
      if (controller.signal.aborted) return;
      const palettes = results.filter((value): value is ArtworkPalette => value !== null);
      setSample({ route, key, palette: combinePagePalettes(palettes) });
    });
    return () => controller.abort();
  }, [route, key, enabled]);
  const palette = enabled && key !== "[]" && sample?.route === route && sample.key === key ? sample.palette : null;
  return useMemo(() => palette ? safeAtmosphere(palette, light, strength).map(rgbHex) : undefined, [palette, light, strength]);
}
