// @ts-nocheck
import { memo, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
/* localtify 0.3.9 V425 — missing cover filter + cache tools. */
/* localtify 0.3.9 V307 — cover studio stable render. */
import { useVirtualizer } from "@tanstack/react-virtual";
import type { CSSProperties, ComponentType, Dispatch, SetStateAction } from "react";

const CoverGalleryImage = memo(function CoverGalleryImage({ src, label, priority = false }: { src: string; label: string; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  const fallback = String(label || "cover").trim().slice(0, 1).toUpperCase() || "♪";

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <span className={`coverGalleryImageShellCleanOnly isLoaded ${failed ? "isFailed" : ""}`}>
      <span className="coverGalleryImagePlaceholderCleanOnly" aria-hidden="true">{fallback}</span>

      {src && !failed ? (
        <img
          className="coverGalleryImageCleanOnly isLoaded"
          src={src}
          alt=""
          width={220}
          height={220}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "low"}
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => setFailed(true)}
        />
      ) : null}
    </span>
  );
});


function useMeasuredWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    let frame = 0;
    let lastWidth = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const nextWidth = element.clientWidth || 0;
        if (Math.abs(nextWidth - lastWidth) < 8) return;
        lastWidth = nextWidth;
        setWidth(nextWidth);
      });
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
  missingCoverSongs?: SongLike[];

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
  randomizeMissingCovers?: () => void | Promise<void>;
  cleanupCoverCache?: () => void | Promise<void>;
  rescanPixelArtFolder: () => void | Promise<void>;

  selectCurrentSongForCovers: () => void;
  selectVisibleSongsForCovers: () => void;
  setCoverSelectedSongIds: Dispatch<SetStateAction<string[]>>;
  toggleCoverSongSelection: (songId: string) => void;

  applyCoverAssetToSelection: (asset: RuntimePixelArtAssetLike) => void | Promise<void>;
  togglePixelCoverFavorite?: (key: string) => void;
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
    estimateSize: () => 56,
    overscan: 1,
    getItemKey: (index) => songs[index]?.id || index
  });

  if (!songs.length) {
    return (
      <div className="emptyState coverEmptyState coverEmptyStateClean">
        <strong>no matching songs</strong>
        <p>Clear the search or import songs first.</p>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="coverSongList coverSongListVirtual coverSongListClean">
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
                <strong>{prettyTitle(String(song.title || "untitled"), 6)}</strong>
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
  onPreviewCover,
  onApplyCover,
  togglePixelCoverExcluded
}: {
  entries: CoverGalleryEntryLike[];
  pixelArtBusy: boolean;
  pixelArtUrl: (file: string) => string;
  coverMoodName: (mood: CoverMood) => string;
  onPreviewCover: (entry: CoverGalleryEntryLike) => void;
  onApplyCover: (entry: CoverGalleryEntryLike) => void | Promise<void>;
  togglePixelCoverExcluded: (key: string) => void;
}) {
  const [parentRef, width] = useMeasuredWidth<HTMLDivElement>();
  const columns = Math.max(2, Math.floor((Math.max(width, 320) + 10) / 132));
  const rows = useMemo(() => chunkItems(entries, columns), [entries, columns]);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 184,
    overscan: 1
  });

  if (!entries.length) {
    return (
      <div className="emptyState coverEmptyState coverEmptyStateClean coverEmptyStateBig">
        <strong>no covers found</strong>
        <p>Clear the search, change filter, or rescan the pixelart folder.</p>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="coverGalleryGridCleanOnly">
      <div className="coverGalleryVirtualCanvasCleanOnly" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const rowEntries = rows[virtualRow.index] || [];

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              className="coverGalleryVirtualRowCleanOnly"
              style={{ "--cover-gallery-row-y": `${virtualRow.start}px`, transform: "translate3d(0, var(--cover-gallery-row-y), 0)", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } as CSSProperties}
            >
              {rowEntries.map((entry) => {
                const imageUrl = entry.asset.url || pixelArtUrl(entry.asset.file);
                const tags = entry.tags.map(coverMoodName).filter(Boolean).slice(0, 2).join(" · ");

                return (
                  <article
                    key={entry.key}
                    className={`coverGalleryCardCleanOnly ${entry.excluded ? "excluded" : ""}`}
                    onFocus={() => onPreviewCover(entry)}
                  >
                    <button
                      type="button"
                      className="coverGalleryImageButtonCleanOnly"
                      onClick={() => void onApplyCover(entry)}
                      disabled={pixelArtBusy}
                      title="apply cover"
                    >
                      <CoverGalleryImage src={imageUrl} label={entry.asset.label} />
                    </button>

                    <div className="coverGalleryInfoCleanOnly">
                      <strong title={entry.asset.label}>{entry.asset.label}</strong>
                      <small>{entry.usage} use{entry.usage === 1 ? "" : "s"}{tags ? ` • ${tags}` : ""}</small>
                    </div>

                    <div className="coverGalleryActionsCleanOnly">
                      <button
                        type="button"
                        onClick={() => togglePixelCoverExcluded(entry.key)}
                        className={`coverHideButton ${entry.excluded ? "danger active" : ""}`}
                        aria-label={entry.excluded ? "show cover again" : "hide cover"}
                        title={entry.excluded ? "show cover again" : "hide cover"}
                      >
                        <span aria-hidden="true">{entry.excluded ? "↺" : "×"}</span>
                      </button>

                      <button
                        type="button"
                        className="coverApplyButton"
                        disabled={pixelArtBusy}
                        onClick={() => void onApplyCover(entry)}
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
  missingCoverSongs = [],
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
  randomizeMissingCovers,
  cleanupCoverCache,
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
  const [songFilter, setSongFilter] = useState<"all" | "missing">("all");
  const [previewEntryKey, setPreviewEntryKey] = useState("");
  const [coverToast, setCoverToast] = useState("");
  const [recentCoverEntries, setRecentCoverEntries] = useState<CoverGalleryEntryLike[]>([]);
  const toastTimerRef = useRef<number | null>(null);
  const deferredCoverSearch = normalizeSearch(useDeferredValue(coverSearch));
  const deferredSongSearch = normalizeSearch(useDeferredValue(songSearch));

  const selectedCount = selectedCoverSongs.length || (currentSong ? 1 : 0);
  const randomizeDisabled = pixelArtBusy || (!selectedCoverSongs.length && !currentSong);

  const visibleGalleryAssets = useMemo(() => {
    if (!deferredCoverSearch) return filteredCoverGalleryAssets;
    return filteredCoverGalleryAssets.filter((entry) => coverEntryMatches(entry, deferredCoverSearch, coverMoodName));
  }, [deferredCoverSearch, filteredCoverGalleryAssets, coverMoodName]);

  const visibleCoverSongs = useMemo(() => {
    const sourceSongs = songFilter === "missing" ? missingCoverSongs : coverPickerSongList;
    if (!deferredSongSearch) return sourceSongs;
    return sourceSongs.filter((song) => songMatches(song, deferredSongSearch));
  }, [coverPickerSongList, deferredSongSearch, missingCoverSongs, songFilter]);

  const previewEntry = useMemo(() => {
    return (
      visibleGalleryAssets.find((entry) => entry.key === previewEntryKey) ||
      recentCoverEntries[0] ||
      coverStats.least ||
      visibleGalleryAssets[0] ||
      null
    );
  }, [coverStats.least, previewEntryKey, recentCoverEntries, visibleGalleryAssets]);

  const previewImageUrl = previewEntry ? previewEntry.asset.url || pixelArtUrl(previewEntry.asset.file) : "";
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

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  function flashCoverToast(message: string) {
    setCoverToast(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setCoverToast(""), 2200);
  }

  async function applyEntry(entry: CoverGalleryEntryLike) {
    if (!entry || pixelArtBusy || randomizeDisabled) return;
    setPreviewEntryKey(entry.key);
    await Promise.resolve(applyCoverAssetToSelection(entry.asset));
    setRecentCoverEntries((current) => [entry, ...current.filter((item) => item.key !== entry.key)].slice(0, 8));
    flashCoverToast(`applied ${entry.asset.label}`);
  }

  async function randomizeWithToast(mood: CoverMood) {
    if (randomizeDisabled) return;
    await Promise.resolve(randomizeSelectedCovers(mood));
    flashCoverToast(mood === "leastUsed" ? "applied least-used covers" : "randomized selected covers");
  }

  return (
    <section className="coverStudioLayout coverStudioCleanLayout">
      <section className="panel coverStudioHero coverStudioCleanHero ambientSurface" style={ambientStyle ?? undefined}>
        <div className="coverStudioHeroText coverStudioCleanHeroText">
          <p className="eyebrow">cover studio</p>
          <h3>album covers</h3>
          <p>Pick songs on the left, then click any cover to apply it. Clean gallery, less noise.</p>
        </div>

        <div className="coverStudioHeroActions coverStudioCleanActions">
          <button
            className="heroMain"
            type="button"
            disabled={randomizeDisabled}
            onClick={() => void randomizeWithToast(coverGalleryMood)}
          >
            {pixelArtBusy ? "working..." : `randomize ${selectedCount}`}
          </button>

          <button type="button" onClick={() => void randomizeWithToast("leastUsed")} disabled={pixelArtBusy || randomizeDisabled}>
            least used
          </button>

          <button type="button" onClick={() => void randomizeMissingCovers?.()} disabled={pixelArtBusy || !missingCoverSongs.length}>
            fix missing {missingCoverSongs.length ? `(${missingCoverSongs.length})` : ""}
          </button>

          <button type="button" onClick={() => void cleanupCoverCache?.()} disabled={pixelArtBusy}>
            clean cache
          </button>

          <button type="button" onClick={() => void rescanPixelArtFolder()} disabled={pixelArtBusy}>
            rescan
          </button>
        </div>
      </section>

      {coverToast ? <div className="coverApplyToast" role="status">{coverToast}</div> : null}

      <section className="coverMoodTabs coverMoodTabsClean" aria-label="cover filters">
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

      <section className="coverStudioBody coverStudioCleanBody">
        <aside className="panel coverSelectedSongsPanel coverSelectedSongsPanelClean">
          <div className="panelHead coverPanelHeadClean">
            <div>
              <p className="eyebrow">songs</p>
              <h3>{coverSelectedSongIds.length} selected</h3>
            </div>
            <span>{songFilter === "missing" ? `${visibleCoverSongs.length} missing` : visibleCoverSongs.length}</span>
          </div>

          <div className="coverSongSearchWrap">
            <input
              className="coverStudioSearchInput"
              value={songSearch}
              onChange={(event) => setSongSearch(event.currentTarget.value)}
              placeholder="search songs"
              spellCheck={false}
            />
          </div>

          <div className="coverSongTools coverSongToolsClean">
            <button type="button" className={songFilter === "all" ? "active" : ""} onClick={() => setSongFilter("all")}>all</button>
            <button type="button" className={songFilter === "missing" ? "active" : ""} onClick={() => setSongFilter("missing")}>missing {missingCoverSongs.length ? `(${missingCoverSongs.length})` : ""}</button>
            <button type="button" onClick={selectCurrentSongForCovers}>current</button>
            <button type="button" onClick={selectVisibleSongsForCovers}>visible</button>
            <button type="button" onClick={() => setCoverSelectedSongIds([])}>clear</button>
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

        <section className="panel coverGalleryPanel coverGalleryPanelClean">
          <div className="coverGalleryHeader coverGalleryHeaderClean">
            <div>
              <p className="eyebrow">gallery</p>
              <h3>{coverMoodName(coverGalleryMood)}</h3>
            </div>

            <span>{totalShown}{deferredCoverSearch ? ` / ${totalBeforeSearch}` : ""} shown</span>
          </div>

          <div className="coverGalleryToolbar coverGalleryToolbarClean">
            <input
              className="coverStudioSearchInput coverGallerySearchInput"
              value={coverSearch}
              onChange={(event) => setCoverSearch(event.currentTarget.value)}
              placeholder="search covers"
              spellCheck={false}
            />

            {coverSearch ? <button type="button" onClick={() => setCoverSearch("")}>clear</button> : null}
          </div>

          <div className="coverQuickApplyBar">
            <div className="coverQuickPreview" aria-label="cover preview">
              <CoverComponent song={activeTargetSong ?? currentSong} className="coverStudioMiniSongArt" />
              <span aria-hidden="true">→</span>
              {previewEntry ? <CoverGalleryImage src={previewImageUrl} label={previewEntry.asset.label} priority /> : <div className="coverPreviewEmpty">♪</div>}
              <button type="button" disabled={!previewEntry || pixelArtBusy || randomizeDisabled} onClick={() => previewEntry && void applyEntry(previewEntry)}>
                apply preview
              </button>
            </div>

            {recentCoverEntries.length ? (
              <div className="coverRecentInline" aria-label="recent covers">
                <strong>recent</strong>
                {recentCoverEntries.slice(0, 5).map((entry) => {
                  const imageUrl = entry.asset.url || pixelArtUrl(entry.asset.file);
                  return (
                    <button key={entry.key} type="button" onClick={() => void applyEntry(entry)} title={`apply ${entry.asset.label}`}>
                      <CoverGalleryImage src={imageUrl} label={entry.asset.label} />
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <VirtualCoverGalleryGrid
            entries={visibleGalleryAssets}
            pixelArtBusy={pixelArtBusy}
            pixelArtUrl={pixelArtUrl}
            coverMoodName={coverMoodName}
            onPreviewCover={(entry) => setPreviewEntryKey(entry.key)}
            onApplyCover={applyEntry}
            togglePixelCoverExcluded={togglePixelCoverExcluded}
          />
        </section>
      </section>
    </section>
  );
}

