import "./pages.css";
import { useMemo, useState } from "react";
import { Radio } from "lucide-react";
import { Cover } from "../covers/Cover";
import { LocaltifyStateCard } from "../../shared/ui/LocaltifyViewUi";
import { formatTime } from "../../shared/utils/format";
import { splitArtistCredits } from "../artists/artistCredits";
import { splitGenreCredits } from "../genres/genreCredits";
import { useGenreTaggedSongs } from "../genres/useGenreTaggedSongs";
import { buildAlbumIdBySongId } from "../player/playbackSource";
import { artistTarget, genreTarget, playableIds, useAppActions } from "../shell/appActions";
import type { LocalAlbumEntry } from "../albums/album.types";
import type { Song } from "../library/song.types";
import CollectionHero from "./CollectionHero";
import TrackList from "./TrackList";
import AlbumShelf from "./AlbumShelf";

export type SongGroupPageProps = {
  id: string;
  songs: Song[];
  albums: readonly LocalAlbumEntry[];
  currentId: string | null;
  isPlaying: boolean;
  toggleLike: (songId: string) => unknown;
  openPlaylistPicker: (song: Song) => unknown;
  openSimilar: (songIds: string[], key: string, title: string) => unknown;
};

const TOP_SONGS = 10;

/** The songs credited to one name (artist or genre), keeping the name as it is written in the tags. */
function collect(songs: Song[], id: string, credits: (song: Song) => string[]) {
  let name = "";
  const members = songs.filter((song) => credits(song).some((credit) => {
    if (credit.toLocaleLowerCase() !== id) return false;
    name ||= credit;
    return true;
  }));
  return { name, members };
}

export function ArtistPage(props: SongGroupPageProps) {
  const group = useMemo(() => collect(props.songs, props.id, (song) => splitArtistCredits(song.artist)), [props.songs, props.id]);
  return <SongGroupBody {...props} kind="artist" name={group.name} members={group.members} loading={false} />;
}

export function GenrePage(props: SongGroupPageProps) {
  const tagged = useGenreTaggedSongs(props.songs);
  const group = useMemo(() => collect(tagged.songs, props.id, (song) => splitGenreCredits(song.genre)), [tagged.songs, props.id]);
  return <SongGroupBody {...props} kind="genre" name={group.name} members={group.members} loading={tagged.loading} />;
}

function SongGroupBody({ kind, name, members, loading, albums, currentId, isPlaying, toggleLike, openPlaylistPicker, openSimilar }: SongGroupPageProps & { kind: "artist" | "genre"; name: string; members: Song[]; loading: boolean }) {
  const actions = useAppActions();
  const [showAll, setShowAll] = useState(false);
  const albumIds = useMemo(() => buildAlbumIdBySongId(albums as LocalAlbumEntry[]), [albums]);
  const memberAlbums = useMemo(() => {
    const ids = new Set(members.map((song) => song.id));
    return albums.filter((album) => album.songs.some((song) => ids.has(song.id)))
      .sort((a, b) => String(b.year || "").localeCompare(String(a.year || "")) || a.title.localeCompare(b.title));
  }, [albums, members]);
  // Most played first once there is history; otherwise library order.
  const popular = useMemo(() => (members.some((song) => song.playCount > 0)
    ? [...members].sort((a, b) => (b.playCount || 0) - (a.playCount || 0)) : members), [members]);

  if (!name) {
    return (
      <section data-page-section={kind} className="collectionPage">
        <LocaltifyStateCard centered tone="info" eyebrow={kind} title={loading ? "Reading genre tags" : `This ${kind} is gone`}
          message={loading ? "Checking the genre tags in your local library." : "No songs in your library are credited to it any more."}
          actions={loading ? undefined : <button className="softButton" type="button" onClick={() => actions.nav.go(kind === "artist" ? "artists" : "genres")}>browse {kind}s</button>} />
      </section>
    );
  }

  const target = kind === "artist" ? artistTarget(name, members) : genreTarget(name, members);
  const playable = playableIds(members);
  const duration = members.reduce((total, song) => total + Math.max(0, Number(song.duration) || 0), 0);
  const shown = showAll ? popular : popular.slice(0, TOP_SONGS);

  return (
    <section data-page-section={kind} className="collectionPage songGroupPage" aria-label={`${name} ${kind}`}>
      <CollectionHero
        eyebrow={kind}
        title={name}
        round={kind === "artist"}
        cover={<Cover song={target.coverSong} className="collectionHeroCover" priority="high" />}
        coverSong={target.coverSong}
        stats={[`${members.length} track${members.length === 1 ? "" : "s"}`, `${memberAlbums.length} album${memberAlbums.length === 1 ? "" : "s"}`, formatTime(duration)].join(" · ")}
        playable={playable.length}
        onPlay={() => actions.playCollection(target)}
        onShuffle={() => actions.playCollection(target, { shuffle: true })}
        onQueue={() => actions.queueCollection(target)}
        onMore={(event) => actions.openCollectionMenu(event, target)}
      >
        <button className="collectionIconButton" type="button" disabled={!playable.length} aria-label={`songs like ${name}`} title="Similar songs"
          onClick={() => openSimilar(playable, `${kind}:${target.id}`, name)}>
          <Radio size={16} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </CollectionHero>

      <section className="collectionSection" aria-label="songs">
        <h2>{members.some((song) => song.playCount > 0) ? "Popular" : "Songs"}</h2>
        <TrackList songs={shown} currentId={currentId} isPlaying={isPlaying} hideArtist={kind === "artist" ? name : undefined}
          albumIdOf={(songId) => albumIds.get(songId)}
          playFrom={(songId) => actions.playCollection({ ...target, songs: popular }, { startId: songId })}
          toggleLike={toggleLike} openPlaylistPicker={openPlaylistPicker} />
        {popular.length > TOP_SONGS ? (
          <button className="collectionTextButton collectionShowAll" type="button" onClick={() => setShowAll((value) => !value)}>
            {showAll ? "show less" : `show all ${popular.length} songs`}
          </button>
        ) : null}
      </section>

      {memberAlbums.length ? <AlbumShelf title={kind === "artist" ? "Albums" : `${name} albums`} albums={memberAlbums} /> : null}
    </section>
  );
}
