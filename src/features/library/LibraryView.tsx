import "./library.css";
import { lazy, Suspense, useState, type DragEventHandler, type ReactNode } from "react";
import { Copy, FileWarning, FolderInput, ListMusic, Radio, Shuffle, Trash2 } from "lucide-react";
import type { SimilarSeedRequest } from "../analysis/similarSeed";
import type { DuplicatesMergeResult } from "./duplicates/DuplicatesDialog";
import { ActionLabel } from "../../shared/ui/ActionLabel";
import { ArcDropdownMenu } from "../../shared/ui/ArcDropdownMenu";
import { LocaltifyStateCard, MascotStateArt } from "../../shared/ui/LocaltifyViewUi";
import type { LibrarySortMode } from "./librarySort";
import type { Song } from "./song.types";
import type { Playlist } from "../playlists/playlist.types";
import type { Settings } from "../settings/settings.types";
import type { View } from "../shell/view.types";

const DuplicatesDialog = lazy(() => import("./duplicates/DuplicatesDialog"));

export type LibraryViewProps = {
  openSimilarSongs: (request: SimilarSeedRequest) => unknown;
  applyDuplicateMerge: (result: DuplicatesMergeResult) => unknown;
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
  librarySortMode: LibrarySortMode;
  missingFileCount: number;
  now: unknown;
  playlists: Playlist[];
  query: string;
  removeMissingSongs: () => Promise<unknown> | unknown;
  renderHomeSongCards: (songs: Song[], className?: string) => ReactNode;
  renderSongRows: (songs: Song[], className?: string) => ReactNode;
  setLibraryFilterMode?: (mode: "all" | "missing") => unknown;
  setLibrarySortMode: (mode: LibrarySortMode) => unknown;
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
    librarySortMode,
    missingFileCount,
    query,
    removeMissingSongs,
    renderHomeSongCards,
    renderSongRows,
    setLibraryFilterMode,
    setLibrarySortMode,
    settings,
    showingMissingFiles,
    shuffleLibrarySongsAction,
    songs,
    view,
    visibleSongs
  } = props;
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);

  const isLiked = view === "liked";
  const shownLabel = showingMissingFiles ? "missing files" : isLiked ? "tracks" : "all tracks";

  return (
    <section data-page-section="library" className={`libraryPage ${isLiked ? "libraryPageLiked" : ""}`}>
      <header className="libraryTopBar">
        <div className="libraryHeading">
          <h1>{isLiked ? "Liked songs" : "Library"}</h1>
        </div>

        <div className="libraryTopTools">
          <input
            className="librarySearch"
            value={query}
            onChange={(event) => handleSearchInput(event.currentTarget.value)}
            placeholder={isLiked ? "search liked songs" : "search your library"}
            aria-label={isLiked ? "search liked songs" : "search library"}
          />
          <ArcDropdownMenu
            className="librarySort"
            ariaLabel="Sort songs"
            value={librarySortMode}
            items={[{ value: "library", label: "library order" }, { value: "artist", label: "artist A–Z" }]}
            onValueChange={setLibrarySortMode}
          />
          {!isLiked ? (
            <>
              <button className="libraryAction" type="button" onClick={shuffleLibrarySongsAction} disabled={songs.length < 2}>
                <ActionLabel icon={Shuffle}>shuffle</ActionLabel>
              </button>
              <button className="libraryAction" type="button" onClick={() => setDuplicatesOpen(true)} disabled={songs.length < 2} title="Find songs that are in your library more than once">
                <ActionLabel icon={Copy}>duplicates</ActionLabel>
              </button>
            </>
          ) : (
            <button className="libraryAction" type="button" onClick={() => props.openSimilarSongs({ kind: "liked" })}
              disabled={!songs.some((song) => song.liked)} title="Find songs in your library that sound like your liked songs">
              <ActionLabel icon={Radio}>more like these</ActionLabel>
            </button>
          )}
        </div>
      </header>

      {!isLiked ? (
        <div className={`libraryStats ${missingFileCount ? "" : "libraryStatsThree"}`} aria-label="library summary">
          <div className="libraryStat"><strong>{songs.length}</strong><span>tracks</span></div>
          <div className="libraryStat"><strong>{libraryAlbumCount}</strong><span>albums</span></div>
          <div className="libraryStat"><strong>{libraryArtistCount}</strong><span>artists</span></div>
          {missingFileCount > 0 ? <div className="libraryStat warning"><strong>{missingFileCount}</strong><span>missing</span></div> : null}
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
            <button type="button" className={showingMissingFiles ? "active" : ""} onClick={() => setLibraryFilterMode?.("missing")}><ActionLabel icon={FileWarning}>show missing</ActionLabel></button>
            <button type="button" onClick={() => setLibraryFilterMode?.("all")}><ActionLabel icon={ListMusic}>show all</ActionLabel></button>
            <button type="button" onClick={importSongs}><ActionLabel icon={FolderInput}>reimport</ActionLabel></button>
            <button
              type="button"
              className="danger"
              onClick={() => void removeMissingSongs?.()}
              disabled={deleteBusy}
              title="Remove missing song records from Localtify. This does not delete real audio files."
            >
              <ActionLabel icon={Trash2}>remove missing</ActionLabel>
            </button>
          </div>
        </div>
      ) : null}

      <section className="libraryTracks" aria-labelledby="library-tracks-title">
        <div className="libraryTracksHead">
          <div>
            <h2 id="library-tracks-title">{shownLabel}</h2>
          </div>
          {(isLiked || showingMissingFiles || query.trim()) ? <span className="libraryCount">{visibleSongs.length} {visibleSongs.length === 1 ? "track" : "tracks"}</span> : null}
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
              centered={!isLiked}
              cute={!isLiked}
              badge={showingMissingFiles ? "✓" : isLiked ? "♡" : query.trim() ? "⌕" : "♪"}
              tone={showingMissingFiles ? "success" : isLiked || query.trim() ? "info" : "warning"}
              eyebrow={showingMissingFiles ? "file check" : isLiked ? "liked songs" : query.trim() ? "search" : "library"}
              title={showingMissingFiles ? "All files are cozy" : isLiked ? "No liked songs yet" : query.trim() ? "No songs found" : "No songs yet"}
               message={showingMissingFiles ? "All your files are available." : isLiked ? "Like a song to save it here." : query.trim() ? "Try a different title or artist." : "Import music to get started."}
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
      {duplicatesOpen ? <Suspense fallback={null}>
        <DuplicatesDialog songs={songs} onClose={() => setDuplicatesOpen(false)} onMerged={props.applyDuplicateMerge} />
      </Suspense> : null}
    </section>
  );
}
