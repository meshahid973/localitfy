export type DiscoverArtwork = { coverUrl?: string; fallbackCoverUrl?: string; coverAlternatives?: string[]; durationMs?: number };
export type DiscoverTrack = { title: string; artist: string; url: string; album?: string } & DiscoverArtwork;
export type DiscoverArtist = { name: string; url: string; because: string[]; seedCount: number; topTracks: DiscoverTrack[] };
export type CatalogKind = "recording" | "artist";
export type CatalogItem = { id: string; title: string; artist: string; subtitle: string; url: string } & DiscoverArtwork;
export type DiscoverResult =
  | ({ status: "artwork" } & DiscoverArtwork)
  | { status: "catalog"; kind: CatalogKind; items: CatalogItem[] }
  | { status: "ready" | "no-taste"; generatedAt: number; seeds: string[]; artists: DiscoverArtist[]; tracks: DiscoverTrack[] }
  | { status: "off" | "needs-key" }
  | { status: "error"; error: string };
/** Plain text from Last.fm; paragraphs are separated by blank lines. */
export type ArtistBio =
  | { status: "ready"; name: string; url: string; summary: string; content: string }
  | { status: "none" | "off" | "needs-key" }
  | { status: "error"; error: string };
