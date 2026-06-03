import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { CSSProperties, ComponentType, Dispatch, SetStateAction } from "react";


function CoverGalleryImage({ src, label }: { src: string; label: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const fallback = String(label || "cover").trim().slice(0, 1).toUpperCase() || "♪";

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  return (
    <span className={`coverGalleryImageShell ${loaded ? "isLoaded" : "isLoading"} ${failed ? "isFailed" : ""}`}>
      <span className="coverGalleryImagePlaceholder" aria-hidden="true">
        {fallback}
      </span>

      {src && !failed ? (
        <img
          className={`coverGalleryImage ${loaded ? "isLoaded" : ""}`}
          src={src}
          alt=""
          width={320}
          height={320}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          referrerPolicy="no-referrer"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            setFailed(true);
          }}
        />
      ) : null}
    </span>
  );
}

function useMeasuredWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () => setWidth(element.clientWidth || 0);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

function chunkItems<T>(items: T[], size: number) {
  const safeSize = Math.max(1, size);
  const output: T[][] = [];

  for (let index = 0; index < items.length; index += safeSize) {
    output.push(items.slice(index, index + safeSize));
  }

  return output;
}

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


function VirtualCoverSongList({
  songs,
  selectedIds,
  CoverComponent,
  prettyTitle,
  prettyMeta,
  toggleCoverSongSelection
}: {
  songs: SongLike[];
  selectedIds: string[];
  CoverComponent: ComponentType<{ song: SongLike | null; className: string }>;
  prettyTitle: (title: string, words?: number) => string;
  prettyMeta: (text: string) => string;
  toggleCoverSongSelection: (songId: string) => void;
}) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const rowVirtualizer = useVirtualizer({
    count: songs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 6,
    getItemKey: (index) => songs[index]?.id || index
  });

  if (!songs.length) {
    return (
      <div className="emptyState">
        <strong>no songs yet</strong>
        <p>Import music first, then choose covers here.</p>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="coverSongList coverSongListVirtual">
      <div className="coverSongVirtualCanvas" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const song = songs[virtualRow.index];
          if (!song) return null;

          const selected = selectedSet.has(song.id);

          return (
            <button
              key={virtualRow.key}
              ref={rowVirtualizer.measureElement}
              data-index={virtualRow.index}
              type="button"
              className={`coverSongPick coverSongPickVirtual ${selected ? "active" : ""}`}
              onClick={() => toggleCoverSongSelection(song.id)}
              title={song.title || "unknown song"}
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              <CoverComponent song={song} className="coverSongThumb" />
              <span>
                <strong>{prettyTitle(String(song.title || "untitled"), 7)}</strong>
                <small>{prettyMeta(String(song.artist || "unknown artist"))}</small>
              </span>
              <em>{selected ? "✓" : "+"}</em>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function VirtualCoverGalleryGrid({
  entries,
  pixelArtBusy,
  pixelArtUrl,
  coverMoodName,
  applyCoverAssetToSelection,
  togglePixelCoverFavorite,
  togglePixelCoverExcluded
}: {
  entries: CoverGalleryEntryLike[];
  pixelArtBusy: boolean;
  pixelArtUrl: (file: string) => string;
  coverMoodName: (mood: CoverMood) => string;
  applyCoverAssetToSelection: (asset: RuntimePixelArtAssetLike) => void | Promise<void>;
  togglePixelCoverFavorite: (key: string) => void;
  togglePixelCoverExcluded: (key: string) => void;
}) {
  const [parentRef, width] = useMeasuredWidth<HTMLDivElement>();
  const columns = Math.max(1, Math.floor((Math.max(width, 180) + 14) / 172));
  const rows = useMemo(() => chunkItems(entries, columns), [entries, columns]);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 286,
    overscan: 2
  });

  if (!entries.length) {
    return (
      <div className="emptyState">
        <strong>no covers here</strong>
        <p>Try another filter or rescan the pixelart folder.</p>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="coverGalleryGrid coverGalleryGridVirtual">
      <div className="coverGalleryVirtualCanvas" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const rowEntries = rows[virtualRow.index] || [];

          return (
            <div
              key={virtualRow.key}
              ref={rowVirtualizer.measureElement}
              data-index={virtualRow.index}
              className="coverGalleryVirtualRow"
              style={{ transform: `translateY(${virtualRow.start}px)`, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            >
              {rowEntries.map((entry) => {
                const imageUrl = entry.asset.url || pixelArtUrl(entry.asset.file);
                const tags = entry.tags.map(coverMoodName).join(", ");

                return (
                  <article
                    key={entry.key}
                    className={`coverGalleryCard ${entry.favorite ? "favorite" : ""} ${entry.excluded ? "excluded" : ""}`}
                  >
                    <button
                      type="button"
                      className="coverGalleryImageButton"
                      onClick={() => void applyCoverAssetToSelection(entry.asset)}
                      disabled={pixelArtBusy}
                      title="apply to selected songs"
                    >
                      <CoverGalleryImage src={imageUrl} label={entry.asset.label} />
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
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

          <VirtualCoverSongList
            songs={coverPickerSongList}
            selectedIds={coverSelectedSongIds}
            CoverComponent={CoverComponent}
            prettyTitle={prettyTitle}
            prettyMeta={prettyMeta}
            toggleCoverSongSelection={toggleCoverSongSelection}
          />
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

          <VirtualCoverGalleryGrid
            entries={filteredCoverGalleryAssets}
            pixelArtBusy={pixelArtBusy}
            pixelArtUrl={pixelArtUrl}
            coverMoodName={coverMoodName}
            applyCoverAssetToSelection={applyCoverAssetToSelection}
            togglePixelCoverFavorite={togglePixelCoverFavorite}
            togglePixelCoverExcluded={togglePixelCoverExcluded}
          />
        </section>
      </section>
    </section>
  );
}
