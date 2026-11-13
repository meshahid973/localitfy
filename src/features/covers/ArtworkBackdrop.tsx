import type { Song } from "../library/song.types";
import { Cover } from "./Cover";
import "./artwork-backdrop.css";

export function ArtworkBackdrop({ song }: { song: Song | null }) {
  if (!song) return null;
  return (
    <div className="artworkBackdrop" aria-hidden="true">
      <Cover song={song} className="artworkBackdropCover" priority="high" />
    </div>
  );
}
