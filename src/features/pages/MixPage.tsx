import "./pages.css";
import { useMemo } from "react";
import { Save } from "lucide-react";
import { LocaltifyStateCard } from "../../shared/ui/LocaltifyViewUi";
import { formatTime } from "../../shared/utils/format";
import { prettyMeta } from "../search/search.utils";
import PlaylistCoverCollage from "../playlists/components/PlaylistCoverCollage";
import { useHomeDailyMixes } from "../home/useHomeDailyMixes";
import { buildAlbumIdBySongId } from "../player/playbackSource";
import { mixTarget, playableIds, useAppActions } from "../shell/appActions";
import type { LocalAlbumEntry } from "../albums/album.types";
import type { Song } from "../library/song.types";
import CollectionHero from "./CollectionHero";
import TrackList from "./TrackList";

export type MixPageProps = {
  mixId: string;
  songs: Song[];
  albums: readonly LocalAlbumEntry[];
  currentId: string | null;
  isPlaying: boolean;
  toggleLike: (songId: string) => unknown;
  openPlaylistPicker: (song: Song) => unknown;
  savePlaylist: (name: string, songIds: string[]) => unknown;
};

/** One of today's daily mixes as a page. */
export default function MixPage({ mixId, songs, albums, currentId, isPlaying, toggleLike, openPlaylistPicker, savePlaylist }: MixPageProps) {
  const actions = useAppActions();
  const { result, failed } = useHomeDailyMixes();
  const songsById = useMemo(() => new Map(songs.map((song) => [song.id, song])), [songs]);
  const albumIds = useMemo(() => buildAlbumIdBySongId(albums as LocalAlbumEntry[]), [albums]);
  const mix = result?.mixes.find((item) => item.id === mixId) || null;
  const members = useMemo(() => mix?.songIds.flatMap((id) => songsById.get(id) ?? []) ?? [], [mix, songsById]);

  if (!mix) {
    return (
      <section data-page-section="mix" className="collectionPage">
        <LocaltifyStateCard centered tone="info" eyebrow="daily mix" title={result || failed ? "This mix has been refreshed" : "Loading your mix"}
          message={result || failed ? "Daily mixes change every day. Today's mixes are in Playlists." : "Getting today's mixes."}
          actions={result || failed ? <button className="softButton" type="button" onClick={() => actions.nav.go("playlists")}>see today's mixes</button> : undefined} />
      </section>
    );
  }

  const target = mixTarget(mix, members);
  const playable = playableIds(members);
  const artists = [...new Set(members.map((song) => prettyMeta(song.artist)).filter(Boolean))];
  const duration = members.reduce((total, song) => total + Math.max(0, Number(song.duration) || 0), 0);

  return (
    <section data-page-section="mix" className="collectionPage mixPage" aria-label={mix.name}>
      <CollectionHero
        eyebrow="daily mix"
        title={mix.name}
        cover={<PlaylistCoverCollage songs={members} className="collectionHeroCover playlistCoverCollage" />}
        coverSong={target.coverSong}
        byline={<span>{artists.slice(0, 3).join(", ")}{artists.length > 3 ? " and more" : ""}</span>}
        stats={`${members.length} track${members.length === 1 ? "" : "s"} · ${formatTime(duration)}`}
        playable={playable.length}
        onPlay={() => actions.playCollection(target)}
        onShuffle={() => actions.playCollection(target, { shuffle: true })}
        onQueue={() => actions.queueCollection(target)}
        onMore={(event) => actions.openCollectionMenu(event, target)}
      >
        <button className="collectionIconButton" type="button" disabled={!playable.length} aria-label={`save ${mix.name} as a playlist`} title="Save as playlist"
          onClick={() => savePlaylist(mix.name, playable)}>
          <Save size={16} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </CollectionHero>
      <TrackList songs={members} currentId={currentId} isPlaying={isPlaying} albumIdOf={(songId) => albumIds.get(songId)}
        playFrom={(songId) => actions.playCollection(target, { startId: songId })} toggleLike={toggleLike} openPlaylistPicker={openPlaylistPicker} />
    </section>
  );
}
