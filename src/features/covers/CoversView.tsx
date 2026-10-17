import "./covers.css";
import { Suspense } from "react";
import type { CoverSong, CoverStudioProps } from "./cover.types";
import { Cover } from "./Cover";
import CoverStudio from "./CoverStudio";
import { prettyMeta, prettyTitle } from "../search/search.utils";
import { coverMoodName } from "./cover.runtime";
import { pixelArtUrl } from "./pixelArt";
import { coverMoodOptions } from "../settings/settings.constants";

export type CoversViewProps = Pick<CoverStudioProps,
  | "applyCoverAssetToSelection" | "coverGalleryMood" | "coverMoodCounts"
  | "coverPickerSongList" | "coverSelectedSongIds" | "coverStats" | "currentSong"
  | "filteredCoverGalleryAssets" | "pixelArtBusy" | "randomizeSelectedCovers" | "rescanPixelArtFolder"
  | "selectCurrentSongForCovers" | "selectVisibleSongsForCovers" | "selectedCoverSongs"
  | "setCoverGalleryMood" | "setCoverSelectedSongIds" | "toggleCoverSongSelection"
  | "togglePixelCoverExcluded" | "missingCoverSongs" | "randomizeMissingCovers" | "cleanupCoverCache"
> & {
  importSongs: () => unknown;
  songs: CoverSong[];
};

export default function CoversView(props: CoversViewProps) {
  const {
    applyCoverAssetToSelection,
    coverGalleryMood,
    coverMoodCounts,
    coverPickerSongList,
    missingCoverSongs,
    randomizeMissingCovers,
    cleanupCoverCache,
    coverSelectedSongIds,
    coverStats,
    currentSong,
    filteredCoverGalleryAssets,
    importSongs,
    pixelArtBusy,
    randomizeSelectedCovers,
    rescanPixelArtFolder,
    selectCurrentSongForCovers,
    selectVisibleSongsForCovers,
    selectedCoverSongs,
    setCoverGalleryMood,
    setCoverSelectedSongIds,
    songs,
    toggleCoverSongSelection,
    togglePixelCoverExcluded,
  } = props;

  return (

              <>
              {!songs.length ? (
                <div className="coverStudioEmptyNotice" role="status">
                  <span>Import songs to use Covers.</span>
                  <button className="softButton" type="button" onClick={importSongs}>Import songs</button>
                </div>
              ) : !filteredCoverGalleryAssets.length && !pixelArtBusy ? (
                <div className="coverStudioEmptyNotice" role="status">
                  <span>No covers found.</span>
                  <button className="softButton" type="button" onClick={() => void rescanPixelArtFolder()}>Rescan</button>
                </div>
              ) : null}

              <Suspense
                fallback={
                  <section className="panel coverStudioLoading" role="status" aria-live="polite">
                    <div className="panelHead">
                      <div>
                        <h3>Loading covers...</h3>
                      </div>
                    </div>
                  </section>
                }
              >
                <CoverStudio
                pixelArtBusy={pixelArtBusy}
                selectedCoverSongs={selectedCoverSongs}
                currentSong={currentSong}
                coverGalleryMood={coverGalleryMood}
                coverMoodOptions={coverMoodOptions}
                coverMoodCounts={coverMoodCounts}
                coverStats={coverStats}
                filteredCoverGalleryAssets={filteredCoverGalleryAssets}
                coverPickerSongList={coverPickerSongList}
                missingCoverSongs={missingCoverSongs}
                randomizeMissingCovers={randomizeMissingCovers}
                cleanupCoverCache={cleanupCoverCache}
                coverSelectedSongIds={coverSelectedSongIds}
                CoverComponent={Cover}
                prettyTitle={prettyTitle}
                prettyMeta={prettyMeta}
                pixelArtUrl={pixelArtUrl}
                coverMoodName={coverMoodName}
                setCoverGalleryMood={setCoverGalleryMood}
                randomizeSelectedCovers={randomizeSelectedCovers}
                rescanPixelArtFolder={rescanPixelArtFolder}
                selectCurrentSongForCovers={selectCurrentSongForCovers}
                selectVisibleSongsForCovers={selectVisibleSongsForCovers}
                setCoverSelectedSongIds={setCoverSelectedSongIds}
                toggleCoverSongSelection={toggleCoverSongSelection}
                applyCoverAssetToSelection={applyCoverAssetToSelection}
                togglePixelCoverExcluded={togglePixelCoverExcluded}
                />
              </Suspense>
              </>
            
  );
}
