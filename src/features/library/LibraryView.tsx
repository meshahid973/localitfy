import { isAndroidApp, computerName } from "../../app/platform";
import "./library.css";
import { lazy, Suspense, useState, type DragEventHandler } from "react";
import { VirtualLibrarySongCards, VirtualSongRows, type VirtualSongRowsProps } from "./components/SongRows";
import { Copy, FileWarning, FolderInput, ListMusic, Radio, Shuffle, Trash2, Grid2X2, List, Heart, Users } from "lucide-react";
import type { SimilarSeedRequest } from "../analysis/similarSeed";
import type { DuplicatesMergeResult } from "./duplicates/DuplicatesDialog";
import { ActionLabel } from "../../shared/ui/ActionLabel";
import { PageHeader } from "../../shared/ui/PageHeader";
import { ArcDropdownMenu } from "../../shared/ui/ArcDropdownMenu";
import { LocaltifyStateCard, MascotStateArt } from "../../shared/ui/LocaltifyViewUi";
import type { LibrarySortMode } from "./librarySort";
import type { Song } from "./song.types";
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
  query: string;
  removeMissingSongs: () => Promise<unknown> | unknown;
  rows: Omit<VirtualSongRowsProps, "list" | "className">;
  setLibraryFilterMode?: (mode: "all" | "missing") => unknown;
  setLibrarySortMode: (mode: LibrarySortMode) => unknown;
  setLibraryRowStyle: (style: Settings["libraryRowStyle"]) => unknown;
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
    libraryArtistCount,
    libraryMissingLabel,
    librarySortMode,
    missingFileCount,
    query,
    removeMissingSongs,
    rows,
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
  const grid = settings.libraryRowStyle === "coverCards";
  const shownLabel = showingMissingFiles ? "missing files" : isLiked ? "tracks" : "all tracks";

  return (
    <section data-page-section="library" className={`libraryPage ${isLiked ? "libraryPageLiked" : ""}`}>
      <PageHeader title={isLiked ? "Liked songs" : "Library"}>
        <nav className="libraryNavigation" aria-label="Library collections">
          {([{ id: "library", title: "Songs" }, { id: "liked", title: "Liked" }, { id: "playlists", title: "Playlists" }, { id: "artists", title: "Artists" }] as const).map(item => <button key={item.id} type="button" aria-current={view === item.id ? "page" : undefined} onClick={() => changeView(item.id, "library-navigation")}>{item.title}</button>)}
        </nav>
        <input
          className="pageHeaderSearch librarySearch"
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
        <div className="libraryViewMode" role="group" aria-label="Library layout">
          <button type="button" aria-pressed={grid} title="Grid view" aria-label="Grid view" onClick={() => props.setLibraryRowStyle("coverCards")}><Grid2X2 size={16}/></button>
          <button type="button" aria-pressed={!grid} title="List view" aria-label="List view" onClick={() => props.setLibraryRowStyle("comfyRows")}><List size={18}/></button>
        </div>
        {!isLiked ? (
          <>
            <button className="libraryAction" type="button" onClick={shuffleLibrarySongsAction} disabled={songs.length < 2}>
              <ActionLabel icon={Shuffle}>shuffle</ActionLabel>
            </button>
            {isAndroidApp() ? null : <button className="libraryAction" type="button" onClick={() => setDuplicatesOpen(true)} disabled={songs.length < 2} title="Find songs that are in your library more than once">
              <ActionLabel icon={Copy}>duplicates</ActionLabel>
            </button>}
          </>
        ) : (
          <button className="libraryAction" type="button" onClick={() => props.openSimilarSongs({ kind: "liked" })}
            disabled={!songs.some((song) => song.liked)} title="Find songs in your library that sound like your liked songs">
            <ActionLabel icon={Radio}>more like these</ActionLabel>
          </button>
        )}
      </PageHeader>

      {!isLiked && !query.trim() && !showingMissingFiles ? (
        <nav className="libraryCollectionShortcuts" aria-label="Your collections">
          <button type="button" onClick={() => changeView("liked", "library-collection")}><span className="libraryCollectionArtwork" data-kind="liked"><Heart size={36} fill="currentColor" /></span><strong>Liked songs</strong><small>{songs.filter(song => song.liked).length} songs</small></button>
          <button type="button" onClick={() => changeView("artists", "library-collection")}><span className="libraryCollectionArtwork" data-kind="artists"><Users size={36}/></span><strong>Artists</strong><small>{libraryArtistCount} artists</small></button>
        </nav>
      ) : null}

      {!isLiked && missingFileCount > 0 ? (
        <div className="libraryMissingBanner" role="status" aria-live="polite">
          <MascotStateArt state="warning" className="libraryMissingMascot" />
          <div className="libraryMissingCopy">
            <strong>{libraryMissingLabel}</strong>
            <span>{isAndroidApp() ? "These entries are saved, but their audio files are not on this phone." : `These entries are saved, but their audio files are not on this ${computerName()}.`}</span>
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
          <span className="libraryCount">{visibleSongs.length} {visibleSongs.length === 1 ? "track" : "tracks"}</span>
        </div>

        {visibleSongs.length ? (
          grid ? (
            <div className="libraryTrackSurface libraryCoverCards">
              <VirtualLibrarySongCards {...rows} list={visibleSongs} className="libraryCoverCardsGridV321" />
            </div>
          ) : (
            <div
              className="libraryTrackSurface libraryFullListV025"
              onDragOver={handleLibraryAreaDragOver}
              onDragLeave={handleLibraryAreaDragLeave}
              onDrop={handleLibraryAreaDrop}
            >
              <VirtualSongRows {...rows} list={visibleSongs} className="libraryFullListV025" />
            </div>
          )
        ) : (
          <div className="libraryEmpty">
            <LocaltifyStateCard
              centered={!isLiked}
              cute={!isLiked}
              tone={showingMissingFiles ? "success" : isLiked || query.trim() ? "info" : "warning"}
              eyebrow={showingMissingFiles ? "file check" : isLiked ? "liked songs" : query.trim() ? "search" : "library"}
              title={showingMissingFiles ? "All files are cozy" : isLiked ? "No liked songs yet" : query.trim() ? "No songs found" : "No songs yet"}
               message={showingMissingFiles ? "All your files are available." : isLiked ? "Like a song to save it here." : query.trim() ? "Try a different title or artist." : isAndroidApp() ? `Sync with your ${computerName()} in Settings → Library to get started.` : "Import music to get started."}
              mascotState={showingMissingFiles ? "happy" : query.trim() ? "question" : "empty"}
              actions={showingMissingFiles ? (
                <button className="softButton" type="button" onClick={() => setLibraryFilterMode?.("all")}>show all tracks</button>
              ) : isLiked ? (
                <button className="softButton" type="button" onClick={() => changeView("library", "empty-liked")}>browse library</button>
              ) : query.trim() ? (
                <button className="softButton" type="button" onClick={() => handleSearchInput("")}>clear search</button>
              ) : isAndroidApp() ? null : (
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
