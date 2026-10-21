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
import { splitArtistCredits } from "./artistCredits";
import "./artists.css";

type ArtistEntry = {
  id: string;
  name: string;
  songs: Song[];
  albums: ArtistAlbumEntry[];
  coverSong: Song;
  totalDuration: number;
};

type ArtistAlbumEntry = {
  id: string;
  title: string;
  songs: Song[];
  coverSong: Song;
  totalDuration: number;
};

export type ArtistsViewProps = {
  currentId: string;
  openPlaylistPicker: (song: Song) => unknown;
  playArtistSongs?: (songIds: string[], label: string) => unknown;
  queueArtistSongs?: (songIds: string[], label: string) => unknown;
  selectSong: (songId: string, shouldPlay?: boolean) => unknown;
  shuffleArtistSongs?: (songIds: string[], label: string) => unknown;
  songs: Song[];
  toggleLike: (songId: string) => unknown;
  /** Opens an artist's drawer from outside the page, e.g. the player bar. */
  focusArtistRequest?: { artistId: string; nonce: number } | null;
  onFocusArtistHandled?: () => void;
};

function buildArtistAlbums(songs: Song[]): ArtistAlbumEntry[] {
  const groups = new Map<string, { title: string; songs: Song[]; totalDuration: number }>();

  for (const song of songs) {
    const title = song.album?.trim();
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
      title: group.title,
      songs: group.songs,
      coverSong: group.songs.find((song) => Boolean(song.coverUrl || song.coverPath || song.coverThumbnailUrl)) || group.songs[0],
      totalDuration: group.totalDuration
    }))
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
}

function buildArtists(songs: Song[]): ArtistEntry[] {
  const groups = new Map<string, { name: string; songs: Song[]; totalDuration: number }>();

  for (const song of songs) {
    for (const name of splitArtistCredits(song.artist)) {
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
      name: group.name,
      songs: group.songs,
      albums: buildArtistAlbums(group.songs),
      coverSong: group.songs.find((song) => Boolean(song.coverUrl || song.coverPath || song.coverThumbnailUrl)) || group.songs[0],
      totalDuration: group.totalDuration
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export default function ArtistsView({
  currentId,
  openPlaylistPicker,
  playArtistSongs,
  queueArtistSongs,
  selectSong,
  shuffleArtistSongs,
  songs,
  toggleLike,
  focusArtistRequest,
  onFocusArtistHandled
}: ArtistsViewProps) {
  const [query, setQuery] = useState("");
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [artistDetailView, setArtistDetailView] = useState<"songs" | "albums">("songs");
  const [selectedArtistAlbumId, setSelectedArtistAlbumId] = useState<string | null>(null);
  const artistDrawerRef = useRef<HTMLElement | null>(null);
  const artistTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [artistLimit, setArtistLimit] = useState(150);
  const [trackLimit, setTrackLimit] = useState(200);
  const artists = useMemo(() => buildArtists(songs), [songs]);
  const visibleArtists = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return artists;
    const exactMatches = artists.filter((artist) => artist.name.toLocaleLowerCase() === needle);
    if (exactMatches.length) return exactMatches;
    return artists.filter((artist) => artist.name.toLocaleLowerCase().includes(needle));
  }, [artists, query]);
  const selectedArtist = selectedArtistId ? artists.find((artist) => artist.id === selectedArtistId) || null : null;

  useEffect(() => setArtistLimit(150), [query]);

  useEffect(() => {
    if (!selectedArtistId) return;
    const dialog = artistDrawerRef.current;
    dialog?.querySelector<HTMLButtonElement>(".artistDrawerClose")?.focus();
    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeArtist();
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
  }, [selectedArtistId]);

  useEffect(() => {
    const resetDrawerScroll = () => {
      artistDrawerRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };
    resetDrawerScroll();
    const frame = window.requestAnimationFrame(resetDrawerScroll);
    const timer = window.setTimeout(resetDrawerScroll, 120);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [selectedArtistId, artistDetailView, selectedArtistAlbumId]);

  const artistSongIds = selectedArtist?.songs.map((song) => song.id) || [];
  const selectedArtistAlbum = selectedArtistAlbumId
    ? selectedArtist?.albums.find((album) => album.id === selectedArtistAlbumId) || null
    : null;
  const visibleArtistSongs = selectedArtistAlbum?.songs || selectedArtist?.songs || [];

  function closeArtist(restoreFocus = true) {
    setSelectedArtistId(null);
    if (restoreFocus) {
      const trigger = artistTriggerRef.current;
      window.requestAnimationFrame(() => {
        if (trigger?.isConnected) trigger.focus();
      });
    }
  }

  useEffect(() => {
    if (!focusArtistRequest) return;
    if (artists.some((artist) => artist.id === focusArtistRequest.artistId)) openArtist(focusArtistRequest.artistId, null);
    onFocusArtistHandled?.();
  }, [focusArtistRequest?.nonce]);

  function openArtist(artistId: string, trigger: HTMLButtonElement | null) {
    artistTriggerRef.current = trigger;
    setSelectedArtistId(artistId);
    setArtistDetailView("songs");
    setSelectedArtistAlbumId(null);
    setTrackLimit(200);
  }

  return (
    <section data-page-section="artists" className="artistsPage" aria-label="artists">
      <PageHeader
        eyebrow="local artists"
        title="Artists"
        description="Every artist in your song tags. Semicolon and “feat.” credits are listed individually."
      >
        <input
          className="pageHeaderSearch"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="search artists"
          aria-label="search artists"
        />
        <span className="pageHeaderCount"><strong>{visibleArtists.length}</strong> artist{visibleArtists.length === 1 ? "" : "s"}</span>
      </PageHeader>

      {visibleArtists.length ? (
        <>
        <div className="artistsGrid">
          {visibleArtists.slice(0, artistLimit).map((artist) => (
            <button
              key={artist.id}
              type="button"
              className="artistCard"
              onClick={(event) => openArtist(artist.id, event.currentTarget)}
              aria-label={`open ${artist.name}`}
            >
              <Cover song={artist.coverSong} className="artistCardCover" />
              <span>
                <strong title={artist.name}>{prettyMeta(artist.name)}</strong>
                <small>{artist.songs.length} track{artist.songs.length === 1 ? "" : "s"} · {artist.albums.length} album{artist.albums.length === 1 ? "" : "s"}</small>
              </span>
            </button>
          ))}
        </div>
        {visibleArtists.length > artistLimit ? (
          <button type="button" className="softButton artistLoadMore" onClick={() => setArtistLimit((limit) => limit + 150)}>show more artists</button>
        ) : null}
        </>
      ) : (
        <LocaltifyStateCard
          centered
          tone="info"
          eyebrow="artists"
          title={songs.length ? "No artists found" : "No artists yet"}
          message={songs.length ? "Try a different artist or album name." : "Import songs and Localitfy will build your artist shelf from their metadata."}
          actions={query ? <button type="button" className="softButton" onClick={() => setQuery("")}>clear search</button> : undefined}
        />
      )}

      {selectedArtist ? createPortal(
        <div className="artistDrawerBackdrop" onMouseDown={(event) => {
          if (event.currentTarget === event.target) closeArtist();
        }}>
          <section ref={artistDrawerRef} className="artistDrawer" role="dialog" aria-modal="true" tabIndex={-1} aria-label={`${selectedArtist.name} artist details`}>
            <button className="artistDrawerClose" type="button" onClick={() => closeArtist()} aria-label="close artist details">×</button>
            <div className="artistDrawerHero">
              <Cover song={selectedArtist.coverSong} className="artistDrawerCover" />
              <div>
                <p className="eyebrow">artist</p>
                <h3>{selectedArtist.name}</h3>
                <p>{selectedArtist.songs.length} track{selectedArtist.songs.length === 1 ? "" : "s"} · {selectedArtist.albums.length} album{selectedArtist.albums.length === 1 ? "" : "s"} · {formatTime(selectedArtist.totalDuration)}</p>
                <div className="artistDrawerActions">
                  <button className="mainAction" type="button" onClick={() => playArtistSongs?.(artistSongIds, selectedArtist.name)}><ActionLabel icon={Play}>play</ActionLabel></button>
                  <button className="heroGhost" type="button" onClick={() => shuffleArtistSongs?.(artistSongIds, selectedArtist.name)} disabled={artistSongIds.length < 2}><ActionLabel icon={Shuffle}>shuffle</ActionLabel></button>
                  <button className="heroGhost" type="button" onClick={() => queueArtistSongs?.(artistSongIds, selectedArtist.name)}><ActionLabel icon={ListPlus}>queue</ActionLabel></button>
                </div>
              </div>
            </div>

            <div className="artistDrawerTabs" role="tablist" aria-label="artist library views">
              <button
                type="button"
                role="tab"
                aria-selected={artistDetailView === "songs"}
                className={artistDetailView === "songs" ? "active" : ""}
                onClick={() => {
                  setArtistDetailView("songs");
                  setSelectedArtistAlbumId(null);
                }}
              >songs <span>{selectedArtist.songs.length}</span></button>
              <button
                type="button"
                role="tab"
                aria-selected={artistDetailView === "albums"}
                className={artistDetailView === "albums" ? "active" : ""}
                onClick={() => setArtistDetailView("albums")}
              >albums <span>{selectedArtist.albums.length}</span></button>
            </div>

            {artistDetailView === "albums" ? (
              selectedArtist.albums.length ? (
                <div className="artistAlbumGrid" role="tabpanel" aria-label={`${selectedArtist.name} albums`}>
                  {selectedArtist.albums.map((album) => (
                    <button
                      key={album.id}
                      type="button"
                      className="artistAlbumCard"
                      onClick={(event) => {
                        event.currentTarget.blur();
                        artistDrawerRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
                        setSelectedArtistAlbumId(album.id);
                        setArtistDetailView("songs");
                        setTrackLimit(200);
                      }}
                      aria-label={`view ${album.title} songs`}
                    >
                      <Cover song={album.coverSong} className="artistAlbumCover" />
                      <span>
                        <strong title={album.title}>{prettyTitle(album.title, 8)}</strong>
                        <small>{album.songs.length} track{album.songs.length === 1 ? "" : "s"} · {formatTime(album.totalDuration)}</small>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="artistDrawerEmpty" role="tabpanel">No album metadata for this artist yet.</div>
              )
            ) : (
              <div role="tabpanel">
                {selectedArtistAlbum ? (
                  <div className="artistTrackFilter">
                    <span>showing <strong>{selectedArtistAlbum.title}</strong></span>
                    <button type="button" onClick={() => setSelectedArtistAlbumId(null)}>show all songs</button>
                  </div>
                ) : null}
                <div className="artistTrackList">
                  {visibleArtistSongs.slice(0, trackLimit).map((song, index) => (
                    <article key={song.id} className={`artistTrackRow ${song.id === currentId ? "active" : ""}`}>
                      <button type="button" className="artistTrackMain" onClick={() => void selectSong(song.id, true)}>
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <Cover song={song} className="artistTrackCover" />
                        <span>
                          <strong>{prettyTitle(song.title, 10)}</strong>
                          <small>{prettyMeta(song.album || "local files")} · {prettyMeta(song.artist)}</small>
                        </span>
                      </button>
                      <span className="artistTrackDuration">{formatTime(song.duration)}</span>
                      <button className={`iconAction likeActionV443 noActionHoverV444 ${song.liked ? "liked likeActionActiveV443" : ""}`} type="button" onClick={() => toggleLike(song.id)} aria-label={song.liked ? "unlike song" : "like song"} aria-pressed={song.liked}>
                        <LikeHeartAnimationV443 liked={song.liked} />
                      </button>
                      <button className="iconAction" type="button" onClick={() => {
                        closeArtist(false);
                        openPlaylistPicker(song);
                        window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".playlistPickerModal .closeModalButton")?.focus());
                      }} aria-label="add to playlist">+</button>
                    </article>
                  ))}
                </div>
                {visibleArtistSongs.length > trackLimit ? (
                  <button type="button" className="softButton artistLoadMore" onClick={() => setTrackLimit((limit) => limit + 200)}>show more tracks</button>
                ) : null}
              </div>
            )}
          </section>
        </div>,
        document.querySelector(".app") || document.body
      ) : null}
    </section>
  );
}
