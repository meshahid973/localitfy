import { createContext, useContext } from "react";
import type { Song } from "../library/song.types";
import { Cover } from "./Cover";
import "./artwork-backdrop.css";

export const ArtworkAmbientContext = createContext(true);

export function ArtworkBackdrop({ song }: { song: Song | null }) {
  const enabled = useContext(ArtworkAmbientContext);
  if (!song || !enabled) return null;
  return (
    <div className="artworkBackdrop" aria-hidden="true">
      <Cover song={song} className="artworkBackdropCover" priority="high" preferThumbnail />
    </div>
  );
}
