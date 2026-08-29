import "./library.css";
import type { DragEventHandler, ReactNode } from "react";
import { LocaltifyStateCard, MascotStateArt } from "../../shared/ui/LocaltifyViewUi";
import type { Song } from "./song.types";
import type { Playlist } from "../playlists/playlist.types";
import type { Settings } from "../settings/settings.types";
import type { View } from "../shell/view.types";

export type LibraryViewProps = {
  changeView: (view: View, source?: string) => unknown;
  deleteBusy: boolean;
  handleLibraryAreaDragLeave: DragEventHandler<HTMLDivElement>;
  handleLibraryAreaDragOver: DragEventHandler<HTMLDivElement>;
  handleLibraryAreaDrop: DragEventHandler<HTMLDivElement>;
  handleSearchInput: (value: string) => unknown;
  importSongs: () => unknown;
  libraryAlbumCount: number;
  libraryArtistCount: number;
  libraryMissingLabel: string;
  missingFileCount: number;
  now: unknown;
  playlists: Playlist[];
  query: string;
  removeMissingSongs: () => Promise<unknown> | unknown;
  renderHomeSongCards: (songs: Song[], className?: string) => ReactNode;
  renderSongRows: (songs: Song[], className?: string) => ReactNode;
  setLibraryFilterMode?: (mode: "all" | "missing") => unknown;
  settings: Pick<Settings, "libraryRowStyle">;
  showingMissingFiles: boolean;
  shuffleLibrarySongsAction: () => unknown;
  songs: Song[];
  view: View;
  visibleSongs: Song[];
};

export default function LibraryView(props: LibraryViewProps) {
  const {
    changeView,
    deleteBusy,
    handleLibraryAreaDragLeave,
    handleLibraryAreaDragOver,
    handleLibraryAreaDrop,
    handleSearchInput,
    importSongs,
    libraryAlbumCount,
    libraryArtistCount,
    libraryMissingLabel,
    missingFileCount,
    query,
    removeMissingSongs,
    renderHomeSongCards,
    renderSongRows,
    setLibraryFilterMode,
    settings,
    showingMissingFiles,
    shuffleLibrarySongsAction,
    songs,
    view,
    visibleSongs
  } = props;

  const isLiked = view === "liked";
  const shownLabel = showingMissingFiles ? "missing files" : isLiked ? "liked songs" : "all tracks";

  return (
    <section data-page-section="library" className={`libraryPage ${isLiked ? "libraryPageLiked" : ""}`}>
      <header className="libraryTopBar">
        <div className="libraryHeading">
          <p className="libraryEyebrow">{isLiked ? "your collection" : "local library"}</p>
          <h1>{isLiked ? "Liked songs" : "Library"}</h1>
          <p>{isLiked ? "The tracks you keep coming back to." : "Everything on this device, kept local and ready to play."}</p>
        </div>

        <div className="libraryTopTools">
          <input
            className="librarySearch"
            value={query}
            onChange={(event) => handleSearchInput(event.currentTarget.value)}
            placeholder={isLiked ? "search liked songs" : "search your library"}
            aria-label={isLiked ? "search liked songs" : "search library"}
          />
          {!isLiked ? (
            <button className="libraryAction" type="button" onClick={shuffleLibrarySongsAction} disabled={songs.length < 2}>
              shuffle
            </button>
          ) : null}
        </div>
      </header>

      {!isLiked ? (
        <div className="libraryStats" aria-label="library summary">
          <div className="libraryStat"><strong>{songs.length}</strong><span>tracks</span></div>
          <div className="libraryStat"><strong>{libraryAlbumCount}</strong><span>albums</span></div>
          <div className="libraryStat"><strong>{libraryArtistCount}</strong><span>artists</span></div>
          <div className={`libraryStat ${missingFileCount ? "warning" : ""}`}><strong>{missingFileCount}</strong><span>missing</span></div>
        </div>
      ) : null}

      {!isLiked && missingFileCount > 0 ? (
        <div className="libraryMissingBanner" role="status" aria-live="polite">
          <MascotStateArt state="warning" className="libraryMissingMascot" />
          <div className="libraryMissingCopy">
            <strong>{libraryMissingLabel}</strong>
            <span>These entries are still saved in Localtify, but their audio files are not on this PC.</span>
          </div>
          <div className="libraryMissingActions">
            <button type="button" className={showingMissingFiles ? "active" : ""} onClick={() => setLibraryFilterMode?.("missing")}>show missing</button>
            <button type="button" onClick={() => setLibraryFilterMode?.("all")}>show all</button>
            <button type="button" onClick={importSongs}>reimport</button>
            <button
              type="button"
              className="danger"
              onClick={() => void removeMissingSongs?.()}
              disabled={deleteBusy}
              title="Remove missing song records from Localtify. This does not delete real audio files."
            >
              remove missing
            </button>
          </div>
        </div>
      ) : null}

      <section className="libraryTracks" aria-labelledby="library-tracks-title">
        <div className="libraryTracksHead">
          <div>
            <h2 id="library-tracks-title">{shownLabel}</h2>
            <p>{showingMissingFiles ? "repair or remove entries that no longer resolve" : isLiked ? "your local favourites" : "drag to reorder · right-click for more"}</p>
          </div>
          <span className="libraryCount">{visibleSongs.length} {visibleSongs.length === 1 ? "track" : "tracks"}</span>
        </div>

        {visibleSongs.length ? (
          settings.libraryRowStyle === "coverCards" ? (
            <div className="libraryTrackSurface libraryCoverCards">
              {renderHomeSongCards(visibleSongs, "libraryCoverCardsGridV321")}
            </div>
          ) : (
            <div
              className="libraryTrackSurface libraryFullListV025"
              onDragOver={handleLibraryAreaDragOver}
              onDragLeave={handleLibraryAreaDragLeave}
              onDrop={handleLibraryAreaDrop}
            >
              {renderSongRows(visibleSongs, "libraryFullListV025")}
            </div>
          )
        ) : (
          <div className="libraryEmpty">
            <LocaltifyStateCard
              centered
              cute
              badge={showingMissingFiles ? "✓" : isLiked ? "♡" : query.trim() ? "⌕" : "♪"}
              tone={showingMissingFiles ? "success" : isLiked || query.trim() ? "info" : "warning"}
              eyebrow={showingMissingFiles ? "file check" : isLiked ? "liked songs" : query.trim() ? "search" : "library"}
              title={showingMissingFiles ? "All files are cozy" : isLiked ? "No liked songs yet" : query.trim() ? "No songs found" : "No songs yet"}
              message={showingMissingFiles ? "Every song Localtify knows about is available on this PC right now." : isLiked ? "Tap the heart on any song you enjoy and it will show up here." : query.trim() ? "Nothing matched that search. Try a softer title, artist, album, or file name." : "Drop your music here and I’ll keep it cozy."}
              detail={showingMissingFiles ? "Switch back to all tracks to continue browsing your library." : isLiked ? "This is only your local library. Nothing is uploaded anywhere." : query.trim() ? "Your library is still here, the search just got too specific." : "Import a few songs and Localtify will build your shelves, albums, covers, and playlists from them."}
              mascotState={showingMissingFiles ? "happy" : query.trim() ? "question" : "empty"}
              actions={showingMissingFiles ? (
                <button className="softButton" type="button" onClick={() => setLibraryFilterMode?.("all")}>show all tracks</button>
              ) : isLiked ? (
                <button className="softButton" type="button" onClick={() => changeView("library", "empty-liked")}>browse library</button>
              ) : query.trim() ? (
                <button className="softButton" type="button" onClick={() => handleSearchInput("")}>clear search</button>
              ) : (
                <button className="mainAction" type="button" onClick={importSongs}>import songs</button>
              )}
            />
          </div>
        )}
      </section>
    </section>
  );
}
