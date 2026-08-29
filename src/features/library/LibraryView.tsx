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

  return (
    <section data-page-section="library" data-page-state="reset" className={`panel fillPanel libraryPanelV025 ${view === "liked" ? "likedPanel likedLibraryPanelV025" : ""}`}>
      <div className="panelHead libraryPanelHead libraryPanelHeadV025">
        <div className="libraryPanelTitleV025">
          <p className="eyebrow">{view === "liked" ? "liked" : "library"}</p>
          <h3>{view === "liked" ? "songs you liked" : "overview"}</h3>
          <span>
            {view === "liked"
              ? "All your favourites in one place."
              : "Browse queue and shuffle from one clean list."}
          </span>
        </div>
        <div className="libraryHeaderActions libraryPanelActionsV025 libraryActionsCleanV026">
          {view === "library" ? (
            <button type="button" className="shuffleLibraryButtonV025" onClick={shuffleLibrarySongsAction} disabled={songs.length < 2}>
              shuffle library
            </button>
          ) : null}
        </div>
      </div>

      {view === "library" && (
        <>
          <div className="libraryQuickMetaV039" aria-label="library summary">
            <span><strong>{songs.length}</strong> tracks</span>
            <span><strong>{libraryAlbumCount}</strong> albums</span>
            <span><strong>{libraryArtistCount}</strong> artists</span>
            <span className={missingFileCount ? "is-warning" : ""}><strong>{missingFileCount}</strong> missing</span>
          </div>

          {missingFileCount > 0 ? (
            <div className="libraryMissingStripV039 libraryMissingMascotStripV501" role="status" aria-live="polite">
              <MascotStateArt state="warning" className="libraryMissingMascotV501" />
              <div>
                <strong>{libraryMissingLabel}</strong>
                <span>saved in Localtify, but the audio file is not on this PC.</span>
              </div>
              <div className="libraryMissingActionsV039">
                <button
                  type="button"
                  className={showingMissingFiles ? "active" : ""}
                  onClick={() => setLibraryFilterMode?.("missing")}
                >
                  show missing
                </button>
                <button
                  type="button"
                  onClick={() => setLibraryFilterMode?.("all")}
                >
                  show all
                </button>
                <button type="button" onClick={importSongs}>
                  reimport
                </button>
                <button
                  type="button"
                  className="dangerGhostV039"
                  onClick={() => void removeMissingSongs?.()}
                  disabled={deleteBusy}
                  title="Remove missing song records from Localtify. This does not delete real audio files."
                >
                  remove missing
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}

      <div className="libraryListHeaderV025">
        <span>{showingMissingFiles ? `missing files (${visibleSongs.length})` : "tracks"}</span>
        <span>{showingMissingFiles ? "repair" : "title"}</span>
      </div>

      {visibleSongs.length ? (
        settings.libraryRowStyle === "coverCards" ? (
          <div className="libraryCoverCardShellV321">
            {renderHomeSongCards(visibleSongs, "homeAlbumGrid simpleAlbumGrid libraryCoverCardsGridV321")}
          </div>
        ) : (
          <div
            className="songList fullList libraryFullListV025"
            onDragOver={handleLibraryAreaDragOver}
            onDragLeave={handleLibraryAreaDragLeave}
            onDrop={handleLibraryAreaDrop}
          >
            {renderSongRows(visibleSongs, "songList fullList libraryFullListV025")}
          </div>
        )
      ) : (
        <div className="songList fullList libraryFullListV025 emptyStateCenterV466">
          <LocaltifyStateCard
            centered
            cute
            badge={showingMissingFiles ? "✓" : view === "liked" ? "♡" : query.trim() ? "⌕" : "♪"}
            tone={showingMissingFiles ? "success" : view === "liked" || query.trim() ? "info" : "warning"}
            eyebrow={showingMissingFiles ? "file check" : view === "liked" ? "liked songs" : query.trim() ? "search" : "library"}
            title={showingMissingFiles ? "All files are cozy" : view === "liked" ? "No liked songs yet" : query.trim() ? "No songs found" : "No songs yet"}
            message={showingMissingFiles ? "Every song Localtify knows about is available on this PC right now." : view === "liked" ? "Tap the heart on any song you enjoy and it will show up here." : query.trim() ? "Nothing matched that search. Try a softer title, artist, album, or file name." : "Drop your music here and I’ll keep it cozy."}
            detail={showingMissingFiles ? "Switch back to all tracks to continue browsing your library." : view === "liked" ? "This is only your local library. Nothing is uploaded anywhere." : query.trim() ? "Your library is still here, the search just got too specific." : "Import a few songs and Localtify will build your shelves, albums, covers, and playlists from them."}
            mascotState={showingMissingFiles ? "happy" : query.trim() ? "question" : view === "liked" ? "empty" : "empty"}
            actions={showingMissingFiles ? (
              <button className="softButton" type="button" onClick={() => setLibraryFilterMode?.("all")}>show all tracks</button>
            ) : view === "liked" ? (
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
  );
}
