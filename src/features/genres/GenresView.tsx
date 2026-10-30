import { useEffect, useMemo, useState } from "react";
import { Cover } from "../covers/Cover";
import type { Song } from "../library/song.types";
import { LocaltifyStateCard } from "../../shared/ui/LocaltifyViewUi";
import { MediaCard } from "../../shared/ui/MediaCard";
import { PageHeader } from "../../shared/ui/PageHeader";
import { prettyMeta } from "../search/search.utils";
import { splitArtistCredits } from "../artists/artistCredits";
import { genreTarget, useAppActions } from "../shell/appActions";
import { splitGenreCredits } from "./genreCredits";
import { useGenreTaggedSongs } from "./useGenreTaggedSongs";
import "../artists/artists.css";
import "./genres.css";

type GenreEntry = {
  id: string;
  name: string;
  songs: Song[];
  artistCount: number;
  coverSong: Song;
};

export type GenresViewProps = {
  songs: Song[];
};

function buildGenres(songs: Song[]): GenreEntry[] {
  const groups = new Map<string, { name: string; songs: Song[] }>();
  for (const song of songs) {
    for (const name of splitGenreCredits(song.genre)) {
      const id = name.toLocaleLowerCase();
      const group = groups.get(id) || { name, songs: [] };
      group.songs.push(song);
      groups.set(id, group);
    }
  }

  return [...groups.entries()]
    .map(([id, group]) => ({
      id,
      ...group,
      artistCount: new Set(
        group.songs.flatMap((song) => splitArtistCredits(song.artist)).map((name) => name.toLocaleLowerCase())
      ).size,
      coverSong: group.songs.find((song) => Boolean(song.coverUrl || song.coverPath || song.coverThumbnailUrl)) || group.songs[0]
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

/** Every genre in the music tags. Clicking one opens its genre page. */
export default function GenresView({ songs }: GenresViewProps) {
  const actions = useAppActions();
  const [query, setQuery] = useState("");
  const [genreLimit, setGenreLimit] = useState(150);
  const tagged = useGenreTaggedSongs(songs);
  const loadingTags = tagged.loading;
  const genres = useMemo(() => buildGenres(tagged.songs), [tagged.songs]);
  const visibleGenres = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return genres;
    const exactMatches = genres.filter((genre) => genre.name.toLocaleLowerCase() === needle);
    if (exactMatches.length) return exactMatches;
    return genres.filter((genre) => genre.name.toLocaleLowerCase().includes(needle));
  }, [genres, query]);

  useEffect(() => setGenreLimit(150), [query]);

  return (
    <section data-page-section="genres" className="artistsPage genresPage" aria-label="genres">
      <PageHeader
        eyebrow="local genres"
        title="Genres"
        description="Read directly from your music tags. Multi-genre tracks appear in every matching genre."
      >
        <input className="pageHeaderSearch" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="search genres" aria-label="search genres" />
        <span className="pageHeaderCount"><strong>{visibleGenres.length}</strong> genre{visibleGenres.length === 1 ? "" : "s"}</span>
      </PageHeader>

      {visibleGenres.length ? (
        <>
          <div className="artistsGrid genresGrid">
            {visibleGenres.slice(0, genreLimit).map((genre) => {
              const target = genreTarget(genre.name, genre.songs);
              return (
                <MediaCard key={genre.id} className="artistCard genreCard" openLabel={`open ${genre.name}`} playLabel={`play ${genre.name}`}
                  onOpen={() => actions.openCollection(target)} onPlay={() => actions.playCollection(target)}
                  onContextMenu={(event) => actions.openCollectionMenu(event, target)}
                  cover={<Cover song={genre.coverSong} className="artistCardCover genreCardCover" />}>
                  <span>
                    <strong title={genre.name}>{prettyMeta(genre.name)}</strong>
                    <small>{genre.songs.length} track{genre.songs.length === 1 ? "" : "s"} · {genre.artistCount} artist{genre.artistCount === 1 ? "" : "s"}</small>
                  </span>
                </MediaCard>
              );
            })}
          </div>
          {visibleGenres.length > genreLimit ? (
            <button type="button" className="softButton artistLoadMore" onClick={() => setGenreLimit((limit) => limit + 150)}>show more genres</button>
          ) : null}
        </>
      ) : (
        <LocaltifyStateCard
          centered
          tone="info"
          eyebrow="genres"
          title={loadingTags && !query ? "Reading genre tags" : songs.length ? "No genres found" : "No genres yet"}
          message={loadingTags && !query ? "Checking the genre tags in your local library." : songs.length ? "Try a different genre, or add genre tags to your music files." : "Import songs and Localtify will build this shelf from their genre tags."}
          actions={query ? <button type="button" className="softButton" onClick={() => setQuery("")}>clear search</button> : undefined}
        />
      )}

    </section>
  );
}
