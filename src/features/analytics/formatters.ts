import type { LocaltifyAnalyticsSnapshot } from "./analyticsSnapshot";

export function localtifyAnalyticsNumber(snapshot: LocaltifyAnalyticsSnapshot, key: string, fallback = 0) {
  const value = Number(snapshot[key]);
  return Number.isFinite(value) ? value : fallback;
}

export function localtifyAnalyticsString(snapshot: LocaltifyAnalyticsSnapshot, key: string, fallback = "") {
  const value = snapshot[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function formatAnalyticsDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${safeSeconds}s`;
}

/** Pure presentation values; no library scans or React state ownership in App. */
export type AnalyticsRecapInputs = {
  songCount: number;
  monthImportCount: number;
  monthImportSeconds: number;
  monthArtistCount: number;
  yearImportCount: number;
  yearImportSeconds: number;
  yearAlbumCount: number;
};
export function buildAnalyticsRecapCards(input: AnalyticsRecapInputs) {
  const { songCount, monthImportCount, monthImportSeconds, monthArtistCount,
    yearImportCount, yearImportSeconds, yearAlbumCount } = input;
  return [
      {
        label: "monthly recap",
        value: monthImportCount ? `${monthImportCount.toLocaleString()} imported` : "no imports",
        note: monthImportCount
          ? `${formatAnalyticsDuration(monthImportSeconds)} of music added this month`
          : "import music this month to build a recap",
        meta: `${monthArtistCount.toLocaleString()} artist${monthArtistCount === 1 ? "" : "s"}`,
        progress: songCount ? Math.min(100, Math.round((monthImportCount / Math.max(1, songCount)) * 100)) : 0
      },
      {
        label: "yearly recap",
        value: yearImportCount ? `${yearImportCount.toLocaleString()} imported` : "year is quiet",
        note: yearImportCount
          ? `${formatAnalyticsDuration(yearImportSeconds)} of music imported this year`
          : "your yearly recap starts with imports",
        meta: `${yearAlbumCount.toLocaleString()} album${yearAlbumCount === 1 ? "" : "s"}`,
        progress: songCount ? Math.min(100, Math.round((yearImportCount / Math.max(1, songCount)) * 100)) : 0
      }
    ];
}

export type AnalyticsStatInputs = {
  songCount: number;
  libraryArtistCount: number;
  libraryAlbumCount: number;
  totalPlays: number;
  playedSongCount: number;
  averagePlaysPerSong: number;
  libraryHealthLabel: string;
  effectiveMissingFileCount: number;
};
export function buildAnalyticsStatCards(input: AnalyticsStatInputs) {
  const { songCount, libraryArtistCount, libraryAlbumCount, totalPlays,
    playedSongCount, averagePlaysPerSong, libraryHealthLabel, effectiveMissingFileCount } = input;
  return ([
    {
      label: "songs",
      value: songCount.toLocaleString(),
      note: `${libraryArtistCount.toLocaleString()} artist${libraryArtistCount === 1 ? "" : "s"} • ${libraryAlbumCount.toLocaleString()} album${libraryAlbumCount === 1 ? "" : "s"}`
    },
    {
      label: "plays",
      value: totalPlays.toLocaleString(),
      note: `${playedSongCount.toLocaleString()} played song${playedSongCount === 1 ? "" : "s"} • ${averagePlaysPerSong} avg`
    },
    {
      label: "library health",
      value: libraryHealthLabel,
      note: effectiveMissingFileCount > 0 ? `${effectiveMissingFileCount.toLocaleString()} missing file${effectiveMissingFileCount === 1 ? "" : "s"}` : "all files available"
    }
  ]);
}
