import { Suspense } from "react";
import type { CoverSong, CoverStudioProps } from "./cover.types";
import { Cover } from "./Cover";
import CoverStudio from "./CoverStudio";
import { LocaltifyStateCard } from "../../shared/ui/LocaltifyViewUi";
import { prettyMeta, prettyTitle } from "../search/search.utils";
import { coverMoodName } from "./cover.runtime";
import { pixelArtUrl } from "./pixelArt";
import { coverMoodOptions } from "../settings/settings.constants";

export type CoversViewProps = Pick<CoverStudioProps,
  | "ambientStyle" | "applyCoverAssetToSelection" | "coverGalleryMood" | "coverMoodCounts"
  | "coverPickerSongList" | "coverSelectedSongIds" | "coverStats" | "currentSong"
  | "filteredCoverGalleryAssets" | "pixelArtBusy" | "randomizeSelectedCovers" | "rescanPixelArtFolder"
  | "selectCurrentSongForCovers" | "selectVisibleSongsForCovers" | "selectedCoverSongs"
  | "setCoverGalleryMood" | "setCoverSelectedSongIds" | "toggleCoverSongSelection"
  | "togglePixelCoverExcluded" | "togglePixelCoverFavorite"
> & {
  importSongs: () => unknown;
  now: unknown;
  songs: CoverSong[];
};

export default function CoversView(props: CoversViewProps) {
  const {
    ambientStyle,
    applyCoverAssetToSelection,
    coverGalleryMood,
    coverMoodCounts,
    coverPickerSongList,
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
    togglePixelCoverFavorite
  } = props;

  return (

              <>
              {!songs.length ? (
                <LocaltifyStateCard
                  centered
                  cute
                  badge="✦"
                  tone="info"
                  eyebrow="covers"
                  title="Covers need songs first"
                  message="Import music, then the cover studio can dress every track up properly."
                  detail="Your empty-state art will show here too, so the page still feels cute before the library exists."
                  mascotState="empty"
                  actions={<button className="mainAction" type="button" onClick={importSongs}>import songs</button>}
                />
              ) : !filteredCoverGalleryAssets.length && !pixelArtBusy ? (
                <LocaltifyStateCard
                  centered
                  cute
                  badge="☁"
                  tone="warning"
                  eyebrow="covers"
                  title="No pixel covers found"
                  message="The cover shelf is empty right now, but your songs are safe."
                  detail="Rescan covers or add image files to your pixelart folder. Songs will keep using their existing covers."
                  mascotState="warning"
                  actions={<button className="mainAction" type="button" onClick={() => void rescanPixelArtFolder()}>rescan covers</button>}
                />
              ) : null}

              <Suspense
                fallback={
                  <section className="panel coverStudioLoading" role="status" aria-live="polite">
                    <div className="panelHead">
                      <div>
                        <p className="eyebrow">covers</p>
                        <h3>loading cover studio</h3>
                        <p className="softText">cover tools load only when you open them now.</p>
                      </div>
                    </div>
                  </section>
                }
              >
                <CoverStudio
                  ambientStyle={ambientStyle ?? undefined}
                pixelArtBusy={pixelArtBusy}
                selectedCoverSongs={selectedCoverSongs}
                currentSong={currentSong}
                coverGalleryMood={coverGalleryMood}
                coverMoodOptions={coverMoodOptions}
                coverMoodCounts={coverMoodCounts}
                coverStats={coverStats}
                filteredCoverGalleryAssets={filteredCoverGalleryAssets}
                coverPickerSongList={coverPickerSongList}
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
                togglePixelCoverFavorite={togglePixelCoverFavorite}
                togglePixelCoverExcluded={togglePixelCoverExcluded}
                />
              </Suspense>
              </>
            
  );
}
