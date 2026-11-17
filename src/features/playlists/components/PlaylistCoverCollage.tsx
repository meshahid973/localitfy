import { Images } from "lucide-react";
import type { Song } from "../../library/song.types";
import { Cover } from "../../covers/Cover";
import "./playlist-cover-collage.css";

type PlaylistCoverCollageProps = {
  songs: Song[];
  className?: string;
};

export default function PlaylistCoverCollage({
  songs,
  className = "playlistCoverCollage"
}: PlaylistCoverCollageProps) {
  const tiles = songs.length ? songs.slice(0, 4) : [null];

  return (
    <div className={className} data-count={tiles.length} aria-hidden="true">
      {tiles.map((song, index) => (
        <div
          className={song ? "playlistCoverTile" : "playlistCoverTile empty"}
          key={song ? `${song.id}-${index}` : `empty-${index}`}
        >
          {song ? (
            <Cover song={song} className="playlistCoverImage" preferThumbnail />
          ) : (
            <span><Images size={18} aria-hidden="true" /></span>
          )}
        </div>
      ))}
    </div>
  );
}
