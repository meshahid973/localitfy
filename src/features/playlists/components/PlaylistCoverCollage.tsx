import { Images } from "lucide-react";
import { useState } from "react";
import { cleanPlaylistArtwork } from "../playlist.utils";
import type { Song } from "../../library/song.types";
import { Cover } from "../../covers/Cover";
import "./playlist-cover-collage.css";

type PlaylistCoverCollageProps = {
  songs: Song[];
  className?: string;
  coverArtwork?: string;
};

export default function PlaylistCoverCollage({
  songs,
  coverArtwork,
  className = "playlistCoverCollage"
}: PlaylistCoverCollageProps) {
  const [failed, setFailed] = useState<string>();
  const custom = cleanPlaylistArtwork(coverArtwork);
  const tiles = songs.length ? songs.slice(0, 4) : [null];
  if (custom && custom !== failed) return <div className={className} data-count="1" aria-hidden="true"><div className="playlistCoverTile"><img src={custom} alt="" loading="lazy" decoding="async" onError={() => setFailed(custom)} /></div></div>;

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
