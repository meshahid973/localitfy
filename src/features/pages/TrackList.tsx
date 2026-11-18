import { usePageVirtualizer } from "../../shared/hooks/usePageVirtualizer";
import { Fragment, useCallback } from "react";
import { Play, Plus } from "lucide-react";
import { Cover } from "../covers/Cover";
import { LikeHeartAnimationV443 } from "../../shared/ui/LikeHeartAnimation";
import { PlayingBarsIcon } from "../../shared/ui/LocaltifyViewUi";
import { formatTime } from "../../shared/utils/format";
import { prettyMeta } from "../search/search.utils";
import { TrackMetadata } from "../library/TrackMetadata";
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
  showCover?: boolean;
  /** Artist page: its own name is not repeated as a link on every row. */
  hideArtist?: string;
};

/**
 * Songs on a collection page. Clicking a row plays from it; right-click opens the song menu.
 */
export default function TrackList({ songs, currentId, isPlaying, playFrom, toggleLike, openPlaylistPicker, showCover = true, hideArtist }: TrackListProps) {
  const { nav, openSongMenu } = useAppActions();
  const hidden = hideArtist?.toLocaleLowerCase();
  const windowed = songs.length > 80;
  const getItemKey = useCallback((index: number) => songs[index].id, [songs]);
  const { listRef, virtualizer, scrollMargin } = usePageVirtualizer<HTMLDivElement>({
    count: windowed ? songs.length : 0,
    estimateSize: () => 64,
    overscan: 6,
    getItemKey
  });
  const renderRow = (song: Song, index: number) => {
    const active = song.id === currentId;
    const missing = song.fileExists === false;
    const credits = splitArtistCredits(song.artist);
    const shown = hidden && credits.length > 1 ? credits.filter((name) => name.toLocaleLowerCase() !== hidden) : credits;
    return (
      <div key={song.id} role="listitem" aria-posinset={index + 1} aria-setsize={songs.length} aria-current={active ? "true" : undefined} className={`trackRow ${active ? "active" : ""} ${active && isPlaying ? "playing" : ""} ${missing ? "missing" : ""}`}
        title={missing ? "Local audio file missing" : undefined}
        onClick={() => { if (!missing) void playFrom(song.id); }}
        onContextMenu={(event) => void openSongMenu(event, song)}>
        <button className="trackRowIndex" type="button" disabled={missing} aria-label={`play ${song.title}`}
          onClick={(event) => { event.stopPropagation(); void playFrom(song.id); }}>
          <span className="trackRowNumber">{active && isPlaying ? <PlayingBarsIcon /> : index + 1}</span>
          <Play className="trackRowPlayIcon" size={13} fill="currentColor" aria-hidden="true" />
        </button>
        {showCover ? <Cover song={song} className="trackRowCover" preferThumbnail /> : null}
        <TrackMetadata song={song} className="trackRowTitle" maxWords={10} subtitle={shown.length ? shown.map((name, at) => (
              <Fragment key={name}>
                {at ? ", " : null}
                <button className="trackLink" type="button" onClick={(event) => { event.stopPropagation(); nav.openArtistPage(name); }}>{prettyMeta(name)}</button>
              </Fragment>
            )) : prettyMeta(song.artist || "unknown artist")} />
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
  };
  return (
    <div ref={listRef} className={`trackList ${showCover ? "withCover" : ""}`} role="list" aria-label="Tracks">
      {windowed ? (
        <div className="trackListCanvas" role="presentation" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((row) => (
            <div key={row.key} ref={virtualizer.measureElement} data-index={row.index} className="trackVirtualRow" role="presentation"
              style={{ top: row.start - scrollMargin }}>
              {renderRow(songs[row.index], row.index)}
            </div>
          ))}
        </div>
      ) : songs.map(renderRow)}
    </div>
  );
}
