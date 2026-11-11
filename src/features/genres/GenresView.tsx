import { useEffect, useMemo, useState } from "react";
import { Cover } from "../covers/Cover";
import type { Song } from "../library/song.types";
import { LocaltifyStateCard } from "../../shared/ui/LocaltifyViewUi";
import { MediaCard } from "../../shared/ui/MediaCard";
import { PageHeader } from "../../shared/ui/PageHeader";
import { prettyMeta } from "../search/search.utils";
import { ArcDropdownMenu } from "../../shared/ui/ArcDropdownMenu";
import { readLocalJson, writeLocalJson } from "../../shared/storage/localStorage";
import { genreTarget, useAppActions } from "../shell/appActions";
import { buildGenres, countGenresByMinTracks, filterAndSortGenres, GENRE_MIN_TRACKS, GENRE_SORT_ITEMS } from "./genreSort";
import type { GenreMinTracks, GenreSortMode } from "./genreSort";
import { useGenreTaggedSongs } from "./useGenreTaggedSongs";
import "../../shared/ui/collection-layout.css";
import "./genres.css";

export type GenresViewProps = {
  songs: Song[];
};

const SORT_STORAGE_KEY = "localtify:genreSort";
const MIN_TRACKS_STORAGE_KEY = "localtify:genreMinTracks";

function readChoice<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const value = readLocalJson<string>(key, fallback);
  return (allowed as readonly string[]).includes(value) ? value as T : fallback;
}

/** Every genre in the music tags. Clicking one opens its genre page. */
export default function GenresView({ songs }: GenresViewProps) {
  const actions = useAppActions();
  const [query, setQuery] = useState("");
  const [genreLimit, setGenreLimit] = useState(150);
  const tagged = useGenreTaggedSongs(songs);
  const loadingTags = tagged.loading;
  const [sortMode, setSortMode] = useState<GenreSortMode>(() => readChoice(SORT_STORAGE_KEY, GENRE_SORT_ITEMS.map((item) => item.value), "tracks"));
  const [minTracks, setMinTracks] = useState<GenreMinTracks>(() => readChoice(MIN_TRACKS_STORAGE_KEY, GENRE_MIN_TRACKS, "1"));
  const genres = useMemo(() => buildGenres(tagged.songs), [tagged.songs]);
  const minTrackItems = useMemo(() => {
    const counts = countGenresByMinTracks(genres);
    return GENRE_MIN_TRACKS.map((min) => ({ value: min, label: min === "1" ? `all genres (${counts[min]})` : `${min}+ tracks (${counts[min]})` }));
  }, [genres]);
  const visibleGenres = useMemo(() => filterAndSortGenres(genres, query, sortMode, minTracks), [genres, query, sortMode, minTracks]);
  const hiddenBySize = minTracks !== "1" && genres.length > 0;

  useEffect(() => setGenreLimit(150), [query, sortMode, minTracks]);
  useEffect(() => writeLocalJson(SORT_STORAGE_KEY, sortMode), [sortMode]);
  useEffect(() => writeLocalJson(MIN_TRACKS_STORAGE_KEY, minTracks), [minTracks]);

  return (
    <section data-page-section="genres" className="collectionBrowsePage genresPage" aria-label="genres">
      <PageHeader
        eyebrow="local genres"
        title="Genres"
        description="Read directly from your music tags. Multi-genre tracks appear in every matching genre."
      >
        <input className="pageHeaderSearch" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="search genres" aria-label="search genres" />
        <ArcDropdownMenu<GenreSortMode> className="genresSort" ariaLabel="Sort genres" value={sortMode} items={GENRE_SORT_ITEMS} onValueChange={setSortMode} />
        <ArcDropdownMenu<GenreMinTracks> className="genresMinTracks" ariaLabel="Minimum tracks per genre" value={minTracks} items={minTrackItems} onValueChange={setMinTracks} />
        <span className="pageHeaderCount">
          <strong>{visibleGenres.length}</strong>{hiddenBySize ? ` of ${genres.length}` : ""} genre{visibleGenres.length === 1 && !hiddenBySize ? "" : "s"}
        </span>
      </PageHeader>

      {visibleGenres.length ? (
        <>
          <div className="collectionBrowseGrid genresGrid">
            {visibleGenres.slice(0, genreLimit).map((genre) => {
              const target = genreTarget(genre.name, genre.songs);
              return (
                <MediaCard key={genre.id} className="collectionBrowseCard genreCard" openLabel={`open ${genre.name}`} playLabel={`play ${genre.name}`}
                  onOpen={() => actions.openCollection(target)} onPlay={() => actions.playCollection(target)}
                  onContextMenu={(event) => actions.openCollectionMenu(event, target)}
                  cover={<Cover song={genre.coverSong} className="collectionBrowseCardCover genreCardCover" />}>
                  <span>
                    <strong title={genre.name}>{prettyMeta(genre.name)}</strong>
                    <small>{genre.songs.length} track{genre.songs.length === 1 ? "" : "s"} · {genre.artistCount} artist{genre.artistCount === 1 ? "" : "s"}{sortMode === "plays" ? ` · ${genre.playCount} play${genre.playCount === 1 ? "" : "s"}` : ""}</small>
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
          message={loadingTags && !query ? "Checking the genre tags in your local library." : hiddenBySize ? `No genre with ${minTracks}+ tracks matches. Lower the minimum to see smaller genres.` : songs.length ? "Try a different genre, or add genre tags to your music files." : "Import songs and Localtify will build this shelf from their genre tags."}
          actions={query || hiddenBySize ? (
            <>
              {query ? <button type="button" className="softButton" onClick={() => setQuery("")}>clear search</button> : null}
              {hiddenBySize ? <button type="button" className="softButton" onClick={() => setMinTracks("1")}>show all genres</button> : null}
            </>
          ) : undefined}
        />
      )}

    </section>
  );
}
