import { Suspense } from "react";
import { Cover } from "./Cover";
import CoverStudio from "./CoverStudio";
import { LocaltifyStateCard } from "../../shared/ui/LocaltifyViewUi";
import { prettyMeta, prettyTitle } from "../search/search.utils";
import { coverMoodName } from "./cover.runtime";
import { pixelArtUrl } from "./pixelArt";
import { coverMoodOptions } from "../settings/settings.constants";

export type CoversViewProps = {
  ambientStyle: any;
  applyCoverAssetToSelection: any;
  coverGalleryMood: any;
  coverMoodCounts: any;
  coverPickerSongList: any;
  coverSelectedSongIds: any;
  coverStats: any;
  currentSong: any;
  filteredCoverGalleryAssets: any;
  importSongs: any;
  now: any;
  pixelArtBusy: any;
  randomizeSelectedCovers: any;
  rescanPixelArtFolder: any;
  selectCurrentSongForCovers: any;
  selectVisibleSongsForCovers: any;
  selectedCoverSongs: any;
  setCoverGalleryMood: any;
  setCoverSelectedSongIds: any;
  songs: any;
  toggleCoverSongSelection: any;
  togglePixelCoverExcluded: any;
  togglePixelCoverFavorite: any;
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
