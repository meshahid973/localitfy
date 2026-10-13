import { Images } from "lucide-react";
import type { Song } from "../../library/song.types";
import { Cover } from "../../covers/Cover";

type PlaylistCoverCollageProps = {
  songs: Song[];
  className?: string;
};

export default function PlaylistCoverCollage({
  songs,
  className = "playlistCoverCollage"
}: PlaylistCoverCollageProps) {
  const tiles = Array.from({ length: 4 }, (_, index) => songs[index] ?? null);

  return (
    <div className={className} aria-hidden="true">
      {tiles.map((song, index) => (
        <div
          className={song ? "playlistCoverTile" : "playlistCoverTile empty"}
          key={song ? `${song.id}-${index}` : `empty-${index}`}
        >
          {song ? (
            <Cover song={song} className="playlistCoverImage" />
          ) : (
            <span><Images size={18} aria-hidden="true" /></span>
          )}
        </div>
      ))}
    </div>
  );
}
