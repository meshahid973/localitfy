import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ListPlus, Play, Shuffle } from "lucide-react";
import { ActionLabel } from "../../shared/ui/ActionLabel";
import { Cover } from "../covers/Cover";
import { LikeHeartAnimationV443 } from "../../shared/ui/LikeHeartAnimation";
import type { Song } from "../library/song.types";
import { LocaltifyStateCard } from "../../shared/ui/LocaltifyViewUi";
import { PageHeader } from "../../shared/ui/PageHeader";
import { formatTime } from "../../shared/utils/format";
import { prettyMeta, prettyTitle } from "../search/search.utils";
import { splitArtistCredits } from "../artists/artistCredits";
import { splitGenreCredits } from "./genreCredits";
import "../artists/artists.css";
import "./genres.css";

type GenreAlbum = {
  id: string;
  title: string;
  songs: Song[];
  coverSong: Song;
  totalDuration: number;
};

type GenreEntry = {
  id: string;
  name: string;
  songs: Song[];
  albums: GenreAlbum[];
  artistCount: number;
  coverSong: Song;
  totalDuration: number;
};

export type GenresViewProps = {
  currentId: string;
  openPlaylistPicker: (song: Song) => unknown;
  playGenreSongs?: (songIds: string[], label: string) => unknown;
  queueGenreSongs?: (songIds: string[], label: string) => unknown;
  selectSong: (songId: string, shouldPlay?: boolean) => unknown;
  shuffleGenreSongs?: (songIds: string[], label: string) => unknown;
  songs: Song[];
  toggleLike: (songId: string) => unknown;
  /** Opens a genre's drawer from outside the page, e.g. the player bar. */
  focusGenreRequest?: { genreId: string; nonce: number } | null;
  onFocusGenreHandled?: () => void;
};

function cleanName(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function buildGenreAlbums(songs: Song[]): GenreAlbum[] {
  const groups = new Map<string, { title: string; songs: Song[]; totalDuration: number }>();
  for (const song of songs) {
    const title = cleanName(song.album);
    if (!title) continue;
    const id = title.toLocaleLowerCase();
    const group = groups.get(id) || { title, songs: [], totalDuration: 0 };
    group.songs.push(song);
    group.totalDuration += Math.max(0, Number(song.duration) || 0);
    groups.set(id, group);
  }

  return [...groups.entries()]
    .map(([id, group]) => ({
      id,
      ...group,
      coverSong: group.songs.find((song) => Boolean(song.coverUrl || song.coverPath || song.coverThumbnailUrl)) || group.songs[0]
    }))
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
}

function buildGenres(songs: Song[]): GenreEntry[] {
  const groups = new Map<string, { name: string; songs: Song[]; totalDuration: number }>();
  for (const song of songs) {
    for (const name of splitGenreCredits(song.genre)) {
      const id = name.toLocaleLowerCase();
      const group = groups.get(id) || { name, songs: [], totalDuration: 0 };
      group.songs.push(song);
      group.totalDuration += Math.max(0, Number(song.duration) || 0);
      groups.set(id, group);
    }
  }

  return [...groups.entries()]
    .map(([id, group]) => ({
      id,
      ...group,
      albums: buildGenreAlbums(group.songs),
      artistCount: new Set(
        group.songs.flatMap((song) => splitArtistCredits(song.artist)).map((name) => name.toLocaleLowerCase())
      ).size,
      coverSong: group.songs.find((song) => Boolean(song.coverUrl || song.coverPath || song.coverThumbnailUrl)) || group.songs[0]
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export default function GenresView({
  currentId,
  openPlaylistPicker,
  playGenreSongs,
  queueGenreSongs,
  selectSong,
  shuffleGenreSongs,
  songs,
  toggleLike,
  focusGenreRequest,
  onFocusGenreHandled
}: GenresViewProps) {
  const [query, setQuery] = useState("");
  const [selectedGenreId, setSelectedGenreId] = useState<string | null>(null);
  const [detailView, setDetailView] = useState<"songs" | "albums">("songs");
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [genreLimit, setGenreLimit] = useState(150);
  const [taggedGenres, setTaggedGenres] = useState<Map<string, string> | null>(null);
  const [loadingTags, setLoadingTags] = useState(true);
  const [trackLimit, setTrackLimit] = useState(200);
  const drawerRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const genres = useMemo(
    () => buildGenres(taggedGenres ? songs.map((song) => ({ ...song, genre: taggedGenres.get(song.id) ?? song.genre })) : songs),
    [songs, taggedGenres]
  );
  const visibleGenres = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return genres;
    const exactMatches = genres.filter((genre) => genre.name.toLocaleLowerCase() === needle);
    if (exactMatches.length) return exactMatches;
    return genres.filter((genre) => genre.name.toLocaleLowerCase().includes(needle));
  }, [genres, query]);
  const selectedGenre = selectedGenreId ? genres.find((genre) => genre.id === selectedGenreId) || null : null;
  const selectedAlbum = selectedAlbumId ? selectedGenre?.albums.find((album) => album.id === selectedAlbumId) || null : null;
  const visibleSongs = selectedAlbum?.songs || selectedGenre?.songs || [];
  const songIds = selectedGenre?.songs.map((song) => song.id) || [];

  useEffect(() => setGenreLimit(150), [query]);

  useEffect(() => {
    let active = true;
    void window.localitfy.bootstrap({ includeGenres: true })
      .then((payload) => {
        if (!active || !Array.isArray(payload?.songs)) return;
        setTaggedGenres(new Map<string, string>(payload.songs.map((song) => [song.id, String(song.genre || "")])));
      })
      .catch((error) => console.error("[localitfy genres load error]", error))
      .finally(() => { if (active) setLoadingTags(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedGenreId) return;
    const dialog = drawerRef.current;
    dialog?.querySelector<HTMLButtonElement>(".artistDrawerClose")?.focus();
    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeGenre();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleDialogKeys, true);
    return () => window.removeEventListener("keydown", handleDialogKeys, true);
  }, [selectedGenreId]);

  useEffect(() => {
    const resetDrawerScroll = () => drawerRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    resetDrawerScroll();
    const frame = window.requestAnimationFrame(resetDrawerScroll);
    const timer = window.setTimeout(resetDrawerScroll, 120);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [selectedGenreId, detailView, selectedAlbumId]);

  function closeGenre(restoreFocus = true) {
    setSelectedGenreId(null);
    if (restoreFocus) {
      const trigger = triggerRef.current;
      window.requestAnimationFrame(() => {
        if (trigger?.isConnected) trigger.focus();
      });
    }
  }

  useEffect(() => {
    if (!focusGenreRequest) return;
    // Genre tags may still be loading; the drawer appears once the genre resolves.
    openGenre(focusGenreRequest.genreId, null);
    onFocusGenreHandled?.();
  }, [focusGenreRequest?.nonce]);

  function openGenre(id: string, trigger: HTMLButtonElement | null) {
    triggerRef.current = trigger;
    setSelectedGenreId(id);
    setDetailView("songs");
    setSelectedAlbumId(null);
    setTrackLimit(200);
  }

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
            {visibleGenres.slice(0, genreLimit).map((genre) => (
              <button key={genre.id} type="button" className="artistCard genreCard" onClick={(event) => openGenre(genre.id, event.currentTarget)} aria-label={`open ${genre.name}`}>
                <Cover song={genre.coverSong} className="artistCardCover genreCardCover" />
                <span>
                  <strong title={genre.name}>{prettyMeta(genre.name)}</strong>
                  <small>{genre.songs.length} track{genre.songs.length === 1 ? "" : "s"} · {genre.artistCount} artist{genre.artistCount === 1 ? "" : "s"}</small>
                </span>
              </button>
            ))}
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

      {selectedGenre ? createPortal(
        <div className="artistDrawerBackdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) closeGenre(); }}>
          <section ref={drawerRef} className="artistDrawer genreDrawer" role="dialog" aria-modal="true" tabIndex={-1} aria-label={`${selectedGenre.name} genre details`}>
            <button className="artistDrawerClose" type="button" onClick={() => closeGenre()} aria-label="close genre details">×</button>
            <div className="artistDrawerHero">
              <Cover song={selectedGenre.coverSong} className="artistDrawerCover genreDrawerCover" />
              <div>
                <p className="eyebrow">genre</p>
                <h3>{selectedGenre.name}</h3>
                <p>{selectedGenre.songs.length} track{selectedGenre.songs.length === 1 ? "" : "s"} · {selectedGenre.artistCount} artist{selectedGenre.artistCount === 1 ? "" : "s"} · {formatTime(selectedGenre.totalDuration)}</p>
                <div className="artistDrawerActions">
                  <button className="mainAction" type="button" onClick={() => playGenreSongs?.(songIds, selectedGenre.name)}><ActionLabel icon={Play}>play</ActionLabel></button>
                  <button className="heroGhost" type="button" onClick={() => shuffleGenreSongs?.(songIds, selectedGenre.name)} disabled={songIds.length < 2}><ActionLabel icon={Shuffle}>shuffle</ActionLabel></button>
                  <button className="heroGhost" type="button" onClick={() => queueGenreSongs?.(songIds, selectedGenre.name)}><ActionLabel icon={ListPlus}>queue</ActionLabel></button>
                </div>
              </div>
            </div>

            <div className="artistDrawerTabs" role="tablist" aria-label="genre library views">
              <button type="button" role="tab" aria-selected={detailView === "songs"} className={detailView === "songs" ? "active" : ""} onClick={() => { setDetailView("songs"); setSelectedAlbumId(null); }}>songs <span>{selectedGenre.songs.length}</span></button>
              <button type="button" role="tab" aria-selected={detailView === "albums"} className={detailView === "albums" ? "active" : ""} onClick={() => setDetailView("albums")}>albums <span>{selectedGenre.albums.length}</span></button>
            </div>

            {detailView === "albums" ? (
              selectedGenre.albums.length ? <div className="artistAlbumGrid" role="tabpanel" aria-label={`${selectedGenre.name} albums`}>
                {selectedGenre.albums.map((album) => (
                  <button key={album.id} type="button" className="artistAlbumCard" onClick={(event) => {
                    event.currentTarget.blur();
                    drawerRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
                    setSelectedAlbumId(album.id);
                    setDetailView("songs");
                    setTrackLimit(200);
                  }} aria-label={`view ${album.title} songs`}>
                    <Cover song={album.coverSong} className="artistAlbumCover" />
                    <span><strong title={album.title}>{prettyTitle(album.title, 8)}</strong><small>{album.songs.length} track{album.songs.length === 1 ? "" : "s"} · {formatTime(album.totalDuration)}</small></span>
                  </button>
                ))}
              </div> : <div className="artistDrawerEmpty" role="tabpanel">No album metadata for this genre yet.</div>
            ) : <div role="tabpanel">
              {selectedAlbum ? <div className="artistTrackFilter"><span>showing <strong>{selectedAlbum.title}</strong></span><button type="button" onClick={() => setSelectedAlbumId(null)}>show all songs</button></div> : null}
              <div className="artistTrackList">
                {visibleSongs.slice(0, trackLimit).map((song, index) => (
                  <article key={song.id} className={`artistTrackRow ${song.id === currentId ? "active" : ""}`}>
                    <button type="button" className="artistTrackMain" onClick={() => void selectSong(song.id, true)}>
                      <span>{String(index + 1).padStart(2, "0")}</span><Cover song={song} className="artistTrackCover" />
                      <span><strong>{prettyTitle(song.title, 10)}</strong><small>{prettyMeta(song.album || "local files")} · {prettyMeta(song.artist)}</small></span>
                    </button>
                    <span className="artistTrackDuration">{formatTime(song.duration)}</span>
                    <button className={`iconAction likeActionV443 noActionHoverV444 ${song.liked ? "liked likeActionActiveV443" : ""}`} type="button" onClick={() => toggleLike(song.id)} aria-label={song.liked ? "unlike song" : "like song"} aria-pressed={song.liked}><LikeHeartAnimationV443 liked={song.liked} /></button>
                    <button className="iconAction" type="button" onClick={() => {
                      closeGenre(false);
                      openPlaylistPicker(song);
                      window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".playlistPickerModal .closeModalButton")?.focus());
                    }} aria-label="add to playlist">+</button>
                  </article>
                ))}
              </div>
              {visibleSongs.length > trackLimit ? (
                <button type="button" className="softButton artistLoadMore" onClick={() => setTrackLimit((limit) => limit + 200)}>show more tracks</button>
              ) : null}
            </div>}
          </section>
        </div>,
        document.querySelector(".app") || document.body
      ) : null}
    </section>
  );
}
