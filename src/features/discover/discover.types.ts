export type DiscoverTrack = { title: string; artist: string; url: string };
export type DiscoverArtist = { name: string; url: string; because: string[]; seedCount: number; topTracks: DiscoverTrack[] };
export type DiscoverResult =
  | { status: "ready" | "no-taste"; generatedAt: number; seeds: string[]; artists: DiscoverArtist[]; tracks: DiscoverTrack[] }
  | { status: "off" | "needs-key" }
  | { status: "error"; error: string };
/** Plain text from Last.fm; paragraphs are separated by blank lines. */
export type ArtistBio =
  | { status: "ready"; name: string; url: string; summary: string; content: string }
  | { status: "none" | "off" | "needs-key" }
  | { status: "error"; error: string };
