import type { ReactNode } from "react";
import { Play, Radio } from "lucide-react";
import { Cover } from "../covers/Cover";
import { prettyMeta, prettyTitle } from "../search/search.utils";
import type { Song } from "../library/song.types";
import type { LocalAlbumEntry } from "../albums/album.types";
import { useHomeDailyMixes } from "./useHomeDailyMixes";
import { MediaCard } from "../../shared/ui/MediaCard";
import { albumTarget, mixTarget, useAppActions } from "../shell/appActions";

type SectionHeadProps = { id: string; title: string; action?: ReactNode };

/** Section title with an optional small action on the right ("Play all", "See all"). */
export function HomeSectionHead({ id, title, action }: SectionHeadProps) {
  return (
    <div className="homeSectionHead">
      <h3 id={id}>{title}</h3>
      {action}
    </div>
  );
}

type SongRailProps = {
  id: string;
  title: string;
  songs: readonly Song[];
  currentId: string | null;
  selectSong: (songId: string, shouldPlay?: boolean) => unknown;
  playSongs?: (songIds: string[], label: string) => unknown;
  /** Shown when the rail is empty. Without it an empty rail is left out entirely. */
  emptyText?: string;
  className?: string;
  /** Optional "Find similar" action shown beside "Play all". */
  findSimilar?: () => unknown;
};

/** A row of song covers. Clicking a cover plays that song; "Play all" plays the row in order. */
export function HomeSongRail({ id, title, songs, currentId, selectSong, playSongs, emptyText, className = "", findSimilar }: SongRailProps) {
  const { openSongMenu } = useAppActions();
  const headingId = `home-${id}-title`;
  if (!songs.length) {
    return emptyText ? (
      <section className={`homeSection homeReleasesSection ${className}`} aria-labelledby={headingId}>
        <HomeSectionHead id={headingId} title={title} />
        <div className="homeShelfNotice"><span>{emptyText}</span></div>
      </section>
    ) : null;
  }
  return (
    <section className={`homeSection homeReleasesSection ${className}`} aria-labelledby={headingId}>
      <HomeSectionHead
        id={headingId}
        title={title}
        action={(findSimilar || (playSongs && songs.length > 1)) ? (
          <span className="homeSectionActions">
            {findSimilar ? (
              <button className="homeSectionAction" type="button" onClick={() => void findSimilar()} title="Find songs that sound like these">
                <Radio size={10} aria-hidden="true" />
                Find similar
              </button>
            ) : null}
            {playSongs && songs.length > 1 ? (
              <button className="homeSectionAction" type="button" onClick={() => void playSongs(songs.map((song) => song.id), title.toLowerCase())}>
                <Play size={10} fill="currentColor" aria-hidden="true" />
                Play all
              </button>
            ) : null}
          </span>
        ) : null}
      />
      <div className="homeReleaseRail">
        {songs.map((song) => (
          // A song card plays on click, so its round button is the same action; it is there so every card looks alike.
          <MediaCard
            key={song.id}
            className="homeReleaseCard"
            active={song.id === currentId}
            openLabel={`play ${song.title}`}
            playLabel={`play ${song.title}`}
            onOpen={() => selectSong(song.id, true)}
            onPlay={() => selectSong(song.id, true)}
            onContextMenu={(event) => void openSongMenu(event, song)}
            cover={<span className="homeReleaseCoverWrap"><Cover song={song} className="homeReleaseCover" /></span>}
          >
            <span className="homeReleaseCopy">
              <strong>{prettyTitle(song.title, 5)}</strong>
              <small>{prettyMeta(song.artist)}</small>
            </span>
          </MediaCard>
        ))}
      </div>
    </section>
  );
}

type AlbumRailProps = { albums: readonly LocalAlbumEntry[] };

/** Newest albums. Clicking one opens its album page; the round button plays it. */
export function HomeAlbumRail({ albums }: AlbumRailProps) {
  const actions = useAppActions();
  if (!albums.length) return null;
  return (
    <section className="homeSection homeReleasesSection homeAlbumsSection" aria-labelledby="home-new-albums-title">
      <HomeSectionHead id="home-new-albums-title" title="New albums" />
      <div className="homeReleaseRail">
        {albums.map((album) => {
          const cover = album.coverSong ?? album.songs[0] ?? null;
          const target = albumTarget(album);
          return (
            <MediaCard key={album.id} className="homeReleaseCard" openLabel={`open ${album.title}`} playLabel={`play ${album.title}`}
              onOpen={() => actions.openCollection(target)} onPlay={() => actions.playCollection(target)}
              onContextMenu={(event) => actions.openCollectionMenu(event, target)}
              cover={<span className="homeReleaseCoverWrap">{cover ? <Cover song={cover} className="homeReleaseCover" /> : null}</span>}>
              <span className="homeReleaseCopy">
                <strong>{prettyTitle(album.title, 5)}</strong>
                <small>{prettyMeta(album.albumArtist || album.artist)} · {album.trackCount} track{album.trackCount === 1 ? "" : "s"}</small>
              </span>
            </MediaCard>
          );
        })}
      </div>
    </section>
  );
}

type DailyMixRailProps = {
  songsById: ReadonlyMap<string, Song>;
  openDailyMixes: () => unknown;
  openAnalysisSettings: () => unknown;
};

/** Today's daily mixes as cover collages. Clicking a mix opens it, the round button plays it; "See all" opens the full shelf in Playlists. */
export function HomeDailyMixRail({ songsById, openDailyMixes, openAnalysisSettings }: DailyMixRailProps) {
  const actions = useAppActions();
  const { result, failed } = useHomeDailyMixes();
  if (failed || !result) return null;
  const mixes = result.mixes
    .map((mix) => ({ ...mix, songs: mix.songIds.flatMap((id) => { const song = songsById.get(id); return song && song.fileExists !== false ? [song] : []; }) }))
    .filter((mix) => mix.songs.length);

  return (
    <section className="homeSection homeReleasesSection homeMixesSection" aria-labelledby="home-daily-mixes-title">
      <HomeSectionHead
        id="home-daily-mixes-title"
        title="Daily mixes"
        action={mixes.length ? <button className="homeSectionAction" type="button" onClick={() => void openDailyMixes()}>See all</button> : null}
      />
      {mixes.length ? (
        <div className="homeReleaseRail">
          {mixes.map((mix) => {
            const artists = [...new Set(mix.songs.map((song) => song.artist).filter(Boolean))];
            const target = mixTarget(mix, mix.songs);
            return (
              <MediaCard key={mix.id} className="homeReleaseCard" openLabel={`open ${mix.name}`} playLabel={`play ${mix.name}`}
                onOpen={() => actions.openCollection(target)} onPlay={() => actions.playCollection(target)}
                onContextMenu={(event) => actions.openCollectionMenu(event, target)}
                cover={<span className="homeReleaseCoverWrap homeMixCollage">{mix.songs.slice(0, 4).map((song) => <Cover key={song.id} song={song} className="homeReleaseCover" />)}</span>}>
                <span className="homeReleaseCopy">
                  <strong>{mix.name}</strong>
                  <small>{artists.slice(0, 2).map((artist) => prettyMeta(artist)).join(", ") || `${mix.songs.length} tracks`}</small>
                </span>
              </MediaCard>
            );
          })}
        </div>
      ) : (
        <div className="homeShelfNotice">
          <span>Analyze at least five tracks and Localtify will build fresh mixes from your library every day.</span>
          <button className="homeSectionAction" type="button" onClick={() => void openAnalysisSettings()}>Open analysis settings</button>
        </div>
      )}
    </section>
  );
}
