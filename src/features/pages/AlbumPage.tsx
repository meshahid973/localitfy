import "./pages.css";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Cover } from "../covers/Cover";
import { LocaltifyStateCard } from "../../shared/ui/LocaltifyViewUi";
import { formatTime } from "../../shared/utils/format";
import { prettyMeta } from "../search/search.utils";
import { splitArtistCredits } from "../artists/artistCredits";
import { albumTarget, playableIds, useAppActions } from "../shell/appActions";
import type { LocalAlbumEntry } from "../albums/album.types";
import type { Song } from "../library/song.types";
import CollectionHero from "./CollectionHero";
import TrackList from "./TrackList";
import AlbumShelf from "./AlbumShelf";

export type AlbumPageProps = {
  albumId: string;
  albums: readonly LocalAlbumEntry[];
  currentId: string | null;
  isPlaying: boolean;
  toggleLike: (songId: string) => unknown;
  openPlaylistPicker: (song: Song) => unknown;
  /** Keeps the albums controller on this album, so delete and edit act on it. */
  setSelectedAlbumId: (albumId: string) => unknown;
  deleteSelectedAlbum: () => unknown;
  openEditAlbumBuilder: (album: LocalAlbumEntry) => unknown;
};

const leadArtist = (album: LocalAlbumEntry) => (splitArtistCredits(album.albumArtist || album.artist)[0] || "").toLocaleLowerCase();

export default function AlbumPage({ albumId, albums, currentId, isPlaying, toggleLike, openPlaylistPicker, setSelectedAlbumId, deleteSelectedAlbum, openEditAlbumBuilder }: AlbumPageProps) {
  const actions = useAppActions();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const album = albums.find((item) => item.id === albumId) || null;
  useEffect(() => { if (album) setSelectedAlbumId(album.id); }, [album?.id]);

  const moreByArtist = useMemo(() => {
    if (!album) return [];
    const lead = leadArtist(album);
    return lead ? albums.filter((item) => item.id !== album.id && leadArtist(item) === lead).slice(0, 12) : [];
  }, [album, albums]);

  if (!album) {
    return (
      <section data-page-section="album" className="collectionPage">
        <LocaltifyStateCard centered tone="info" eyebrow="album" title="This album is gone" message="It was removed or renamed since you opened it."
          actions={<button className="softButton" type="button" onClick={() => actions.nav.go("albums")}>browse albums</button>} />
      </section>
    );
  }

  const target = albumTarget(album);
  const manual = (album as { source?: string }).source === "manual";
  const folder = manual && (album as { sourceType?: string }).sourceType === "folder";
  const artists = splitArtistCredits(album.albumArtist || album.artist);
  const playable = playableIds(album.songs).length;
  const lead = artists[0] || album.artist;

  return (
    <section data-page-section="album" className="collectionPage albumPage" aria-label={`${album.title} album`}>
      <CollectionHero
        eyebrow={folder ? "folder album" : manual ? "your album" : "album"}
        title={album.title}
        cover={<Cover song={album.coverSong} className="collectionHeroCover" priority="high" />}
        coverSong={album.coverSong}
        byline={artists.length ? artists.map((name, index) => (
          <Fragment key={name}>{index ? <span aria-hidden="true">, </span> : null}<button className="trackLink" type="button" onClick={() => actions.nav.openArtistPage(name)}>{prettyMeta(name)}</button></Fragment>
        )) : <span>{prettyMeta(album.artist || "unknown artist")}</span>}
        stats={[album.year, `${album.trackCount} track${album.trackCount === 1 ? "" : "s"}`, formatTime(album.totalDuration)].filter(Boolean).join(" · ")}
        playable={playable}
        onPlay={() => actions.playCollection(target)}
        onShuffle={() => actions.playCollection(target, { shuffle: true })}
        onQueue={() => actions.queueCollection(target)}
        onMore={(event) => actions.openCollectionMenu(event, target)}
      >
        {manual ? (
          <button className="collectionIconButton" type="button" aria-label={`edit ${album.title}`} title="Edit album"
            onClick={() => { actions.nav.go("albums"); openEditAlbumBuilder(album); }}>
            <Pencil size={16} strokeWidth={2.2} aria-hidden="true" />
          </button>
        ) : null}
        <button className={`collectionTextButton danger ${confirmDelete ? "confirmArmed" : ""}`} type="button" onBlur={() => setConfirmDelete(false)}
          title={manual ? "Delete this album (the songs stay in your library)" : "Clear the album tag from these songs"}
          onClick={() => {
            if (!confirmDelete) { setConfirmDelete(true); return; }
            void deleteSelectedAlbum();
            actions.nav.back();
          }}>
          <Trash2 size={14} strokeWidth={2.3} aria-hidden="true" />
          <span>{confirmDelete ? "sure? click again" : manual ? "delete album" : "remove album tag"}</span>
        </button>
      </CollectionHero>

      <TrackList songs={album.songs} currentId={currentId} isPlaying={isPlaying} showCover={manual}
        playFrom={(songId) => actions.playCollection(target, { startId: songId })} toggleLike={toggleLike} openPlaylistPicker={openPlaylistPicker} />

      {moreByArtist.length ? <AlbumShelf title={`More by ${prettyMeta(lead)}`} albums={moreByArtist} /> : null}
    </section>
  );
}
