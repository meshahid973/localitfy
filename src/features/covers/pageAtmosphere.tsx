import { createContext, useContext, useEffect, useMemo } from "react";
import type { Song } from "../library/song.types";
import { getRendererSafeImageUrl } from "./cover.ambient";

/** Prefer thumbnails, but recover from a broken thumbnail using another saved cover. */
export function trackArtworkSources(song: Song | null | undefined): string[] {
  if (!song) return [];
  return [...new Set([song.coverThumbUrl, song.coverThumbnailUrl, song.thumbnailUrl, song.coverFullUrl, song.coverUrl, song.coverPath].map(getRendererSafeImageUrl).filter(Boolean))].slice(0, 3);
}
import { resolveWorkspaceArtwork } from "./workspaceArtwork";
export { resolveWorkspaceArtwork };

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
    const source = trackArtworkSources(song)[0];
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

