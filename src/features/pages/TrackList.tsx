import { Fragment } from "react";
import { Play, Plus } from "lucide-react";
import { Cover } from "../covers/Cover";
import { LikeHeartAnimationV443 } from "../../shared/ui/LikeHeartAnimation";
import { PlayingBarsIcon } from "../../shared/ui/LocaltifyViewUi";
import { formatTime } from "../../shared/utils/format";
import { prettyMeta, prettyTitle } from "../search/search.utils";
import { splitArtistCredits } from "../artists/artistCredits";
import { useAppActions } from "../shell/appActions";
import type { Song } from "../library/song.types";

export type TrackListProps = {
  songs: readonly Song[];
  currentId: string | null;
  isPlaying: boolean;
  /** Plays the page's collection starting at this song. */
  playFrom: (songId: string) => unknown;
  toggleLike: (songId: string) => unknown;
  openPlaylistPicker: (song: Song) => unknown;
  /** Album pages leave out the (identical) artwork and album column. */
  showCover?: boolean;
  /** Album id of a song, for its album link. Without it the album column is hidden. */
  albumIdOf?: (songId: string) => string | undefined;
  /** Artist page: its own name is not repeated as a link on every row. */
  hideArtist?: string;
};

/**
 * Songs on a collection page. Clicking a row plays from it, right-click opens the song menu, artist and
 * album names open their pages.
 */
export default function TrackList({ songs, currentId, isPlaying, playFrom, toggleLike, openPlaylistPicker, showCover = true, albumIdOf, hideArtist }: TrackListProps) {
  const { nav, openSongMenu } = useAppActions();
  const hidden = hideArtist?.toLocaleLowerCase();
  return (
    <div className={`trackList ${showCover ? "withCover" : ""} ${albumIdOf ? "withAlbum" : ""}`} role="list">
      {songs.map((song, index) => {
        const active = song.id === currentId;
        const missing = song.fileExists === false;
        const credits = splitArtistCredits(song.artist);
        const shown = hidden && credits.length > 1 ? credits.filter((name) => name.toLocaleLowerCase() !== hidden) : credits;
        const albumId = albumIdOf?.(song.id);
        return (
          <div key={song.id} role="listitem" className={`trackRow ${active ? "active" : ""} ${active && isPlaying ? "playing" : ""} ${missing ? "missing" : ""}`}
            title={missing ? "Local audio file missing" : undefined}
            onClick={() => { if (!missing) void playFrom(song.id); }}
            onContextMenu={(event) => void openSongMenu(event, song)}>
            <button className="trackRowIndex" type="button" disabled={missing} aria-label={`play ${song.title}`}
              onClick={(event) => { event.stopPropagation(); void playFrom(song.id); }}>
              <span className="trackRowNumber">{active && isPlaying ? <PlayingBarsIcon /> : index + 1}</span>
              <Play className="trackRowPlayIcon" size={13} fill="currentColor" aria-hidden="true" />
            </button>
            {showCover ? <Cover song={song} className="trackRowCover" /> : null}
            <span className="trackRowTitle">
              <strong title={song.title}>{prettyTitle(song.title, 10)}</strong>
              <small>
                {shown.length ? shown.map((name, at) => (
                  <Fragment key={name}>
                    {at ? ", " : null}
                    <button className="trackLink" type="button" onClick={(event) => { event.stopPropagation(); nav.openArtistPage(name); }}>{prettyMeta(name)}</button>
                  </Fragment>
                )) : prettyMeta(song.artist || "unknown artist")}
              </small>
            </span>
            {albumIdOf ? (
              <span className="trackRowAlbum">
                {albumId && song.album?.trim() ? (
                  <button className="trackLink" type="button" title={song.album} onClick={(event) => { event.stopPropagation(); nav.openAlbumPage(albumId); }}>{prettyMeta(song.album)}</button>
                ) : <span>{prettyMeta(song.album || "")}</span>}
              </span>
            ) : null}
            <button className={`iconAction likeActionV443 noActionHoverV444 ${song.liked ? "liked likeActionActiveV443" : ""}`} type="button"
              onClick={(event) => { event.stopPropagation(); void toggleLike(song.id); }} aria-label={song.liked ? "unlike song" : "like song"} aria-pressed={song.liked}>
              <LikeHeartAnimationV443 liked={song.liked} />
            </button>
            <span className="trackRowDuration">{formatTime(song.duration)}</span>
            <button className="iconAction trackRowAdd" type="button" aria-label="add to playlist" title="Add to playlist"
              onClick={(event) => { event.stopPropagation(); void openPlaylistPicker(song); }}>
              <Plus size={15} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
