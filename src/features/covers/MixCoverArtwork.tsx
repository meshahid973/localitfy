import { memo, useMemo } from "react";
import type { Song } from "../library/song.types";
import { pickHomeMixArtwork } from "../home/homeShelfPicks";
import PlaylistCoverCollage from "../playlists/components/PlaylistCoverCollage";

const hasArtwork = (song: Song) => Boolean(song.coverThumbUrl || song.coverThumbnailUrl || song.thumbnailUrl || song.coverUrl || song.coverPath || song.coverFullUrl);

/** All mix surfaces show actual member covers. A single available cover fills
 * the square; two to four distinct covers use the existing collage layout. */
export const MixCoverArtwork = memo(function MixCoverArtwork({ songs, className = "" }: {
  songs: readonly Song[]; className?: string;
}) {
  const tiles = useMemo(() => {
    const selected = pickHomeMixArtwork(songs);
    const real = selected.filter(hasArtwork);
    return real.length ? real : selected.slice(0, 1);
  }, [songs]);
  return <PlaylistCoverCollage songs={tiles} className={["playlistCoverCollage", className].filter(Boolean).join(" ")} />;
});
