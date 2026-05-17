import type { CSSProperties, ComponentType, Dispatch, SetStateAction } from "react";

type CoverMood = "all" | "favorites" | "leastUsed" | "cute" | "space" | "dark" | "cozy" | "energy";


type SongLike = {
  id: string;
  title?: string;
  artist?: string;
  album?: string;
  coverUrl?: string | null;
  coverPath?: string | null;
  [key: string]: any;
};

type RuntimePixelArtAssetLike = {
  file: string;
  label: string;
  discordKey: string;
  path?: string;
  url?: string;
  key?: string;
};

type CoverGalleryEntryLike = {
  key: string;
  asset: RuntimePixelArtAssetLike;
  tags: CoverMood[];
  usage: number;
  favorite: boolean;
  excluded: boolean;
};

type CoverStatsLike = {
  usableCount?: number;
  usedCount?: number;
  favoriteCount?: number;
  excludedCount?: number;
  least?: CoverGalleryEntryLike | null;
  most?: CoverGalleryEntryLike | null;
};

type CoverStudioProps = {
  ambientStyle?: CSSProperties;
  pixelArtBusy: boolean;

  selectedCoverSongs: SongLike[];
  currentSong: SongLike | null;

  coverGalleryMood: CoverMood;
  coverMoodOptions: Array<{
    id: CoverMood;
    name?: string;
    label?: string;
  }>;

  coverMoodCounts: Map<CoverMood, number>;
  coverStats: CoverStatsLike;

  filteredCoverGalleryAssets: CoverGalleryEntryLike[];
  coverPickerSongList: SongLike[];
  coverSelectedSongIds: string[];

  CoverComponent: ComponentType<any>;

  prettyTitle: (rawTitle: string, maxWords?: number) => string;
  prettyMeta: (text: string) => string;
  pixelArtUrl: (file: string) => string;
  coverMoodName: (mood: CoverMood) => string;

  setCoverGalleryMood: (mood: CoverMood) => void;
  randomizeSelectedCovers: (mood: CoverMood) => void | Promise<void>;
  rescanPixelArtFolder: () => void | Promise<void>;

  selectCurrentSongForCovers: () => void;
  selectVisibleSongsForCovers: () => void;
  setCoverSelectedSongIds: Dispatch<SetStateAction<string[]>>;
  toggleCoverSongSelection: (songId: string) => void;

  applyCoverAssetToSelection: (asset: RuntimePixelArtAssetLike) => void | Promise<void>;
  togglePixelCoverFavorite: (key: string) => void;
  togglePixelCoverExcluded: (key: string) => void;
};

export default function CoverStudio({
  ambientStyle,
  pixelArtBusy,
  selectedCoverSongs,
  currentSong,
  coverGalleryMood,
  coverMoodOptions,
  coverMoodCounts,
  coverStats,
  filteredCoverGalleryAssets,
  coverPickerSongList,
  coverSelectedSongIds,
  CoverComponent,
  prettyTitle,
  prettyMeta,
  pixelArtUrl,
  coverMoodName,
  setCoverGalleryMood,
  randomizeSelectedCovers,
  rescanPixelArtFolder,
  selectCurrentSongForCovers,
  selectVisibleSongsForCovers,
  setCoverSelectedSongIds,
  toggleCoverSongSelection,
  applyCoverAssetToSelection,
  togglePixelCoverFavorite,
  togglePixelCoverExcluded
}: CoverStudioProps) {
  const selectedCount = selectedCoverSongs.length || (currentSong ? 1 : 0);
  const totalShown = filteredCoverGalleryAssets.length;
  const randomizeDisabled = pixelArtBusy || (!selectedCoverSongs.length && !currentSong);

  return (
    <section className="coverStudioLayout">
      <section className="panel coverStudioHero ambientSurface" style={ambientStyle ?? undefined}>
        <div className="coverStudioHeroText">
          <p className="eyebrow">pixel cover studio</p>
          <h3>pixel covers</h3>
          <p>Pick covers, star the good ones, hide the bad ones, and keep your library looking clean.</p>

          <div className="coverStudioHeroActions">
            <button
              className="heroMain"
              type="button"
              disabled={randomizeDisabled}
              onClick={() => void randomizeSelectedCovers(coverGalleryMood)}
            >
              {pixelArtBusy ? "working..." : `randomize ${selectedCount} selected`}
            </button>

            <button type="button" onClick={() => void randomizeSelectedCovers("leastUsed")} disabled={pixelArtBusy}>
              least used covers
            </button>

            <button type="button" onClick={() => void rescanPixelArtFolder()} disabled={pixelArtBusy}>
              rescan folder
            </button>
          </div>
        </div>

        <div className="coverStudioStats" aria-label="cover stats">
          <div>
            <strong>{coverStats.usableCount ?? totalShown}</strong>
            <span>usable covers</span>
          </div>
          <div>
            <strong>{coverStats.usedCount ?? 0}</strong>
            <span>used covers</span>
          </div>
          <div>
            <strong>{coverStats.favoriteCount ?? 0}</strong>
            <span>favorites</span>
          </div>
          <div>
            <strong>{coverStats.excludedCount ?? 0}</strong>
            <span>hidden</span>
          </div>
        </div>
      </section>

      <section className="coverMoodTabs" aria-label="cover filters">
        {coverMoodOptions.map((option) => {
          const label = option.name || option.label || coverMoodName(option.id);
          const count = coverMoodCounts.get(option.id) ?? 0;

          return (
            <button
              key={option.id}
              type="button"
              className={coverGalleryMood === option.id ? "active" : ""}
              onClick={() => setCoverGalleryMood(option.id)}
            >
              <span>{label}</span>
              <strong>{count}</strong>
            </button>
          );
        })}
      </section>

      <section className="coverStudioBody">
        <aside className="panel coverSelectedSongsPanel">
          <div className="panelHead">
            <div>
              <p className="eyebrow">selected songs</p>
              <h3>{selectedCoverSongs.length} selected</h3>
            </div>
          </div>

          <div className="coverSongTools">
            <button type="button" onClick={selectCurrentSongForCovers}>
              current
            </button>
            <button type="button" onClick={selectVisibleSongsForCovers}>
              visible
            </button>
            <button type="button" onClick={() => setCoverSelectedSongIds([])}>
              clear
            </button>
          </div>

          <div className="coverSongList">
            {coverPickerSongList.length ? (
              coverPickerSongList.map((song) => {
                const selected = coverSelectedSongIds.includes(song.id);

                return (
                  <button
                    key={song.id}
                    type="button"
                    className={`coverSongPick ${selected ? "active" : ""}`}
                    onClick={() => toggleCoverSongSelection(song.id)}
                    title={song.title || "unknown song"}
                  >
                    <CoverComponent song={song} className="coverSongThumb" />
                    <span>
                      <strong>{prettyTitle(String(song.title || "untitled"), 7)}</strong>
                      <small>{prettyMeta(String(song.artist || "unknown artist"))}</small>
                    </span>
                    <em>{selected ? "✓" : "+"}</em>
                  </button>
                );
              })
            ) : (
              <div className="emptyState">
                <strong>no songs yet</strong>
                <p>Import music first, then choose covers here.</p>
              </div>
            )}
          </div>
        </aside>

        <section className="panel coverGalleryPanel">
          <div className="coverGalleryHeader">
            <div>
              <p className="eyebrow">gallery</p>
              <h3>{coverMoodName(coverGalleryMood)}</h3>
            </div>

            <span>{totalShown} shown</span>
          </div>

          <div className="coverGallerySubStats">
            <span>
              least used <strong>{coverStats.least ? coverStats.least.asset.label : "none"}</strong>
            </span>
            <span>
              most used <strong>{coverStats.most ? coverStats.most.asset.label : "none"}</strong>
            </span>
          </div>

          <div className="coverGalleryGrid">
            {filteredCoverGalleryAssets.length ? (
              filteredCoverGalleryAssets.map((entry) => {
                const imageUrl = entry.asset.url || pixelArtUrl(entry.asset.file);
                const tags = entry.tags.map(coverMoodName).join(", ");

                return (
                  <article
                    key={entry.key}
                    className={`coverGalleryCard ${entry.favorite ? "favorite" : ""} ${
                      entry.excluded ? "excluded" : ""
                    }`}
                  >
                    <button
                      type="button"
                      className="coverGalleryImageButton"
                      onClick={() => void applyCoverAssetToSelection(entry.asset)}
                      disabled={pixelArtBusy}
                      title="apply to selected songs"
                    >
                      <img
                        className="coverGalleryImage"
                        src={imageUrl}
                        alt=""
                        width={320}
                        height={320}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                      />
                    </button>

                    <div className="coverGalleryInfo">
                      <strong title={entry.asset.label}>{entry.asset.label}</strong>
                      <small>
                        {entry.usage} use{entry.usage === 1 ? "" : "s"} • {tags}
                      </small>
                    </div>

                    <div className="coverGalleryActions">
                      <button
                        type="button"
                        onClick={() => togglePixelCoverFavorite(entry.key)}
                        className={`coverStarButton ${entry.favorite ? "active" : ""}`}
                        title={entry.favorite ? "remove favorite" : "favorite cover"}
                      >
                        {entry.favorite ? "★" : "☆"}
                      </button>

                      <button
                        type="button"
                        onClick={() => togglePixelCoverExcluded(entry.key)}
                        className={`coverHideButton ${entry.excluded ? "danger active" : ""}`}
                        title={entry.excluded ? "show cover again" : "hide cover"}
                      >
                        {entry.excluded ? "show" : "hide"}
                      </button>

                      <button
                        type="button"
                        className="coverApplyButton"
                        disabled={pixelArtBusy}
                        onClick={() => void applyCoverAssetToSelection(entry.asset)}
                        title="apply this cover"
                      >
                        apply cover
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="emptyState">
                <strong>no covers here</strong>
                <p>Try another filter or rescan the pixelart folder.</p>
              </div>
            )}
          </div>
        </section>
      </section>
    </section>
  );
}
