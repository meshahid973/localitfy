import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
/* localtify 0.3.6 V253 — remove cover stars, clean ambience text, and stabilize cover gallery virtualization. */
import { useVirtualizer } from "@tanstack/react-virtual";
import type { CSSProperties, ComponentType, Dispatch, SetStateAction } from "react";

function CoverGalleryImage({ src, label, priority = false }: { src: string; label: string; priority?: boolean }) {
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
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "low"}
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

    let frame = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setWidth(element.clientWidth || 0));
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
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

function normalizeSearch(value: string) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
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

function coverEntryMatches(entry: CoverGalleryEntryLike, query: string, coverMoodName: (mood: CoverMood) => string) {
  if (!query) return true;

  const tagText = entry.tags.map(coverMoodName).join(" ");
  const searchText = [
    entry.asset.label,
    entry.asset.file,
    entry.asset.discordKey,
    tagText,
    entry.excluded ? "hidden excluded" : "visible",
    `${entry.usage} uses`
  ]
    .join(" ")
    .toLowerCase();

  return searchText.includes(query);
}

function songMatches(song: SongLike, query: string) {
  if (!query) return true;

  const searchText = [song.title, song.artist, song.album, song.filePath, song.id]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchText.includes(query);
}

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
    estimateSize: () => 66,
    overscan: 4,
    getItemKey: (index) => songs[index]?.id || index
  });

  if (!songs.length) {
    return (
      <div className="emptyState coverEmptyState">
        <strong>no songs found</strong>
        <p>Try another search, or import music first.</p>
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
              data-index={virtualRow.index}
              type="button"
              className={`coverSongPick coverSongPickVirtual ${selected ? "active" : ""}`}
              onClick={() => toggleCoverSongSelection(song.id)}
              title={song.title || "unknown song"}
              style={{ "--cover-song-y": `${virtualRow.start}px`, transform: "translate3d(0, var(--cover-song-y), 0)" } as CSSProperties}
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
  activeEntryKey,
  onPreviewCover,
  applyCoverAssetToSelection,
  togglePixelCoverExcluded
}: {
  entries: CoverGalleryEntryLike[];
  pixelArtBusy: boolean;
  pixelArtUrl: (file: string) => string;
  coverMoodName: (mood: CoverMood) => string;
  activeEntryKey: string;
  onPreviewCover: (entry: CoverGalleryEntryLike) => void;
  applyCoverAssetToSelection: (asset: RuntimePixelArtAssetLike) => void | Promise<void>;
  togglePixelCoverExcluded: (key: string) => void;
}) {
  const [parentRef, width] = useMeasuredWidth<HTMLDivElement>();
  const columns = Math.max(1, Math.floor((Math.max(width, 220) + 16) / 204));
  const rows = useMemo(() => chunkItems(entries, columns), [entries, columns]);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 326,
    overscan: 3
  });

  if (!entries.length) {
    return (
      <div className="emptyState coverEmptyState">
        <strong>no covers here</strong>
        <p>Try another filter, clear search, or rescan the pixelart folder.</p>
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
              data-index={virtualRow.index}
              className="coverGalleryVirtualRow"
              style={{ "--cover-gallery-row-y": `${virtualRow.start}px`, transform: "translate3d(0, var(--cover-gallery-row-y), 0)", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } as CSSProperties}
            >
              {rowEntries.map((entry) => {
                const imageUrl = entry.asset.url || pixelArtUrl(entry.asset.file);
                const tags = entry.tags.map(coverMoodName).join(", ");
                const activePreview = activeEntryKey === entry.key;

                return (
                  <article
                    key={entry.key}
                    className={`coverGalleryCard ${entry.excluded ? "excluded" : ""} ${activePreview ? "activePreview" : ""}`}
                    onMouseEnter={() => onPreviewCover(entry)}
                    onFocus={() => onPreviewCover(entry)}
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
                        {entry.usage} use{entry.usage === 1 ? "" : "s"} • {tags || "mixed"}
                      </small>
                    </div>

                    <div className="coverGalleryActions">
                      <button
                        type="button"
                        className="coverPreviewButton"
                        onClick={() => onPreviewCover(entry)}
                        title="preview this cover"
                      >
                        preview
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
                        apply
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
  togglePixelCoverExcluded
}: CoverStudioProps) {
  const [coverSearch, setCoverSearch] = useState("");
  const [songSearch, setSongSearch] = useState("");
  const [previewEntryKey, setPreviewEntryKey] = useState("");
  const deferredCoverSearch = normalizeSearch(useDeferredValue(coverSearch));
  const deferredSongSearch = normalizeSearch(useDeferredValue(songSearch));

  const selectedCount = selectedCoverSongs.length || (currentSong ? 1 : 0);
  const randomizeDisabled = pixelArtBusy || (!selectedCoverSongs.length && !currentSong);

  const visibleGalleryAssets = useMemo(() => {
    if (!deferredCoverSearch) return filteredCoverGalleryAssets;
    return filteredCoverGalleryAssets.filter((entry) => coverEntryMatches(entry, deferredCoverSearch, coverMoodName));
  }, [deferredCoverSearch, filteredCoverGalleryAssets, coverMoodName]);

  const visibleCoverSongs = useMemo(() => {
    if (!deferredSongSearch) return coverPickerSongList;
    return coverPickerSongList.filter((song) => songMatches(song, deferredSongSearch));
  }, [coverPickerSongList, deferredSongSearch]);

  const previewEntry = useMemo(() => {
    return (
      visibleGalleryAssets.find((entry) => entry.key === previewEntryKey) ||
      coverStats.least ||
      visibleGalleryAssets[0] ||
      null
    );
  }, [coverStats.least, previewEntryKey, visibleGalleryAssets]);

  const previewImageUrl = previewEntry ? previewEntry.asset.url || pixelArtUrl(previewEntry.asset.file) : "";
  const previewTags = previewEntry ? previewEntry.tags.map(coverMoodName).join(", ") : "";
  const activeTargetSong = selectedCoverSongs[0] || currentSong;
  const targetExtraCount = Math.max(0, selectedCoverSongs.length - 1);
  const totalShown = visibleGalleryAssets.length;
  const totalBeforeSearch = filteredCoverGalleryAssets.length;

  useEffect(() => {
    if (!previewEntryKey || visibleGalleryAssets.some((entry) => entry.key === previewEntryKey)) return;
    setPreviewEntryKey("");
  }, [previewEntryKey, visibleGalleryAssets]);

  useEffect(() => {
    if (coverGalleryMood === "favorites") {
      setCoverGalleryMood("all");
    }
  }, [coverGalleryMood, setCoverGalleryMood]);

  return (
    <section className="coverStudioLayout coverStudioLayoutV252">
      <section className="panel coverStudioHero coverStudioHeroV252 ambientSurface" style={ambientStyle ?? undefined}>
        <div className="coverStudioHeroText">
          <p className="eyebrow">cover studio</p>
          <h3>album covers</h3>
          <p>Choose a song, preview a pixel cover, then apply it instantly. Search, hide, or randomize without leaving the gallery.</p>

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
              least used
            </button>

            <button type="button" onClick={() => void rescanPixelArtFolder()} disabled={pixelArtBusy}>
              rescan covers
            </button>
          </div>
        </div>

        <div className="coverStudioFocusCard" aria-label="cover preview">
          <div className="coverPreviewPair">
            <div className="coverPreviewSlot">
              <span>song</span>
              <CoverComponent song={activeTargetSong ?? currentSong} className="coverPreviewSongArt" />
            </div>

            <div className="coverPreviewArrow" aria-hidden="true">→</div>

            <div className="coverPreviewSlot">
              <span>cover</span>
              {previewEntry ? (
                <CoverGalleryImage src={previewImageUrl} label={previewEntry.asset.label} priority />
              ) : (
                <div className="coverPreviewEmpty">♪</div>
              )}
            </div>
          </div>

          <div className="coverPreviewText">
            <strong>{previewEntry ? previewEntry.asset.label : "pick a cover"}</strong>
            <small>
              {activeTargetSong ? prettyTitle(String(activeTargetSong.title || "selected song"), 6) : "no song selected"}
              {targetExtraCount ? ` + ${targetExtraCount} more` : ""}
            </small>
          </div>

          <button
            type="button"
            className="coverPreviewApplyButton"
            disabled={!previewEntry || pixelArtBusy || randomizeDisabled}
            onClick={() => previewEntry && void applyCoverAssetToSelection(previewEntry.asset)}
          >
            apply preview
          </button>
        </div>
      </section>

      <section className="coverMoodTabs" aria-label="cover filters">
        {coverMoodOptions.filter((option) => option.id !== "favorites").map((option) => {
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

      <section className="coverStudioStats coverStudioStatsV252" aria-label="cover stats">
        <div>
          <strong>{coverStats.usableCount ?? totalBeforeSearch}</strong>
          <span>usable</span>
        </div>
        <div>
          <strong>{coverStats.usedCount ?? 0}</strong>
          <span>used</span>
        </div>
        <div>
          <strong>{coverStats.excludedCount ?? 0}</strong>
          <span>hidden</span>
        </div>
      </section>

      <section className="coverStudioBody coverStudioBodyV252">
        <aside className="panel coverSelectedSongsPanel coverSelectedSongsPanelV252">
          <div className="panelHead">
            <div>
              <p className="eyebrow">album targets</p>
              <h3>{coverSelectedSongIds.length} selected</h3>
            </div>
          </div>

          <div className="coverSongSearchWrap">
            <input
              className="coverStudioSearchInput"
              value={songSearch}
              onChange={(event) => setSongSearch(event.currentTarget.value)}
              placeholder="search songs..."
              spellCheck={false}
            />
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
            songs={visibleCoverSongs}
            selectedIds={coverSelectedSongIds}
            CoverComponent={CoverComponent}
            prettyTitle={prettyTitle}
            prettyMeta={prettyMeta}
            toggleCoverSongSelection={toggleCoverSongSelection}
          />
        </aside>

        <section className="panel coverGalleryPanel coverGalleryPanelV252">
          <div className="coverGalleryHeader coverGalleryHeaderV252">
            <div>
              <p className="eyebrow">gallery</p>
              <h3>{coverMoodName(coverGalleryMood)}</h3>
            </div>

            <span>{totalShown} shown{deferredCoverSearch ? ` / ${totalBeforeSearch}` : ""}</span>
          </div>

          <div className="coverGalleryToolbar">
            <input
              className="coverStudioSearchInput coverGallerySearchInput"
              value={coverSearch}
              onChange={(event) => setCoverSearch(event.currentTarget.value)}
              placeholder="search covers or moods..."
              spellCheck={false}
            />

            {coverSearch ? (
              <button type="button" onClick={() => setCoverSearch("")}>
                clear
              </button>
            ) : null}
          </div>

          <div className="coverGallerySubStats coverGallerySubStatsV252">
            <span>
              least used <strong>{coverStats.least ? coverStats.least.asset.label : "none"}</strong>
            </span>
            <span>
              most used <strong>{coverStats.most ? coverStats.most.asset.label : "none"}</strong>
            </span>
            <span>
              preview <strong>{previewEntry ? previewEntry.asset.label : "none"}</strong>
            </span>
          </div>

          {previewEntry ? (
            <div className="coverGalleryPreviewBar">
              <CoverGalleryImage src={previewImageUrl} label={previewEntry.asset.label} priority />
              <div>
                <strong>{previewEntry.asset.label}</strong>
                <small>
                  {previewEntry.usage} use{previewEntry.usage === 1 ? "" : "s"} • {previewTags || "mixed"}
                </small>
              </div>
              <button type="button" disabled={pixelArtBusy || randomizeDisabled} onClick={() => void applyCoverAssetToSelection(previewEntry.asset)}>
                apply to selection
              </button>
            </div>
          ) : null}

          <VirtualCoverGalleryGrid
            entries={visibleGalleryAssets}
            pixelArtBusy={pixelArtBusy}
            pixelArtUrl={pixelArtUrl}
            coverMoodName={coverMoodName}
            activeEntryKey={previewEntry?.key || ""}
            onPreviewCover={(entry) => setPreviewEntryKey(entry.key)}
            applyCoverAssetToSelection={applyCoverAssetToSelection}
            togglePixelCoverExcluded={togglePixelCoverExcluded}
          />
        </section>
      </section>
    </section>
  );
}
