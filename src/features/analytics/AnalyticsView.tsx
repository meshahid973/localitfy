import "./analytics.css";
import { isAndroidApp } from "../../app/platform";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArcDropdownMenu } from "../../shared/ui/ArcDropdownMenu";
import type { ListeningSummary } from "./listeningSummary";
import { formatAnalyticsDuration } from "./formatters";
import { LocaltifyStateCard } from "../../shared/ui/LocaltifyViewUi";
import { PageHeader } from "../../shared/ui/PageHeader";
import { formatTime } from "../../shared/utils/format";
import { prettyTitle } from "../search/search.utils";
import type { Song } from "../library/song.types";

export type AnalyticsRecapCard = { label: string; value: string; note: string; meta: string; progress?: number };
export type AnalyticsStatCard = { label: string; value: string; note: string };
export type AnalyticsViewProps = {
  analyticsRecapCards: AnalyticsRecapCard[];
  analyticsStatCards: AnalyticsStatCard[];
  averageSongSeconds: number;
  importSongs: () => unknown;
  libraryHealthLabel: string;
  libraryHealthPercent: number;
  libraryLengthLabel: string;
  likedPercent: number;
  longestSong: Song | null;
  missingFileCount: number;
  neverPlayedCount: number;
  playedPercent: number;
  recentImportWeekCount: number;
  songs: Song[];
};

export default function AnalyticsView(props: AnalyticsViewProps) {
  const {
    analyticsRecapCards,
    analyticsStatCards,
    averageSongSeconds,
    importSongs,
    libraryHealthLabel,
    libraryHealthPercent,
    libraryLengthLabel,
    likedPercent,
    longestSong,
    missingFileCount,
    neverPlayedCount,
    playedPercent,
    recentImportWeekCount,
    songs
  } = props;

  return (
    <section data-page-section="analytics" className="analyticsStudioV339" aria-label="lightweight listening recap">
      <PageHeader
        eyebrow="local recap"
        title="Analytics"
        description={songs.length
          ? "Imports, plays, listening time, and file health from your local library."
          : "Import songs and localtify will build a lightweight recap here."}
      >
        <div className="analyticsHeroMeterV339" aria-label="library readiness">
          <span style={{ "--meter": `${playedPercent}%` } as CSSProperties}>
            <strong>{playedPercent}%</strong>
            <small>played</small>
          </span>
          <span style={{ "--meter": `${likedPercent}%` } as CSSProperties}>
            <strong>{likedPercent}%</strong>
            <small>liked</small>
          </span>
          <span title={libraryHealthLabel} style={{ "--meter": `${libraryHealthPercent}%` } as CSSProperties}>
            <strong>{songs.length ? `${libraryHealthPercent}%` : "empty"}</strong>
            <small>health</small>
          </span>
        </div>
      </PageHeader>

      {!songs.length ? (
        <LocaltifyStateCard
          tone="info"
          eyebrow="analytics"
          title="Play songs first"
          message="Your monthly and yearly recap appears after Localtify has songs and play history to read."
          detail="Localtify only uses your local library data: play counts, durations, imports, liked songs, and missing-file checks."
          actions={isAndroidApp() ? null : <button className="mainAction" type="button" onClick={importSongs}>import songs</button>}
        />
      ) : missingFileCount ? (
        <LocaltifyStateCard
          tone="warning"
          eyebrow="library warning"
          title="Some songs need attention"
          message={`${missingFileCount} file${missingFileCount === 1 ? "" : "s"} could not be found on disk. Analytics still works, but those songs may not play until repaired.`}
          detail="This usually happens when a file was moved, renamed, or deleted outside Localtify."
        />
      ) : null}

      <RecordedListening songs={songs} />
      <section className="analyticsRecapGridV339" aria-label="recap cards">
        {(analyticsRecapCards || []).filter(card => card.label !== "all-time listening").map((card, index) => {
          const progress = typeof card.progress === "number" ? Math.min(100, Math.max(0, card.progress)) : undefined;

          return (
            <article
              key={card.label}
              className={`analyticsRecapCardV339 recap-${index}`}
              style={{ "--recap-progress": `${progress ?? 0}%` } as CSSProperties}
            >
              <span>{card.label}</span>
              <strong title={card.value}>{card.value}</strong>
              <small>{card.note}</small>
              <em>{card.meta}</em>
              {progress !== undefined ? <i aria-hidden="true" /> : null}
            </article>
          );
        })}
      </section>

      <section className="analyticsSnapshotV339" aria-label="quick stats">
        {analyticsStatCards.filter(card => card.label !== "listened").map((card) => (
          <article key={card.label} className="analyticsSnapshotCardV339">
            <span>{card.label}</span>
            <strong title={card.value}>{card.value}</strong>
            <small>{card.note}</small>
          </article>
        ))}
      </section>

      <section className="analyticsMiniBoardV339" aria-label="recap helper">
        <div className="analyticsMiniCardV339">
          <span>this week</span>
          <strong>{recentImportWeekCount.toLocaleString()}</strong>
          <small>new import{recentImportWeekCount === 1 ? "" : "s"}</small>
        </div>

        <div className="analyticsMiniCardV339">
          <span>library length</span>
          <strong>{libraryLengthLabel}</strong>
          <small>{averageSongSeconds ? `${formatTime(averageSongSeconds)} average track` : "import songs to calculate"}</small>
        </div>

        <div className="analyticsMiniCardV339">
          <span>needs attention</span>
          <strong>{(missingFileCount || neverPlayedCount).toLocaleString()}</strong>
          <small>{missingFileCount ? `${missingFileCount} missing file${missingFileCount === 1 ? "" : "s"}` : `${neverPlayedCount} never played`}</small>
        </div>

        <div className="analyticsMiniCardV339">
          <span>longest track</span>
          <strong>{longestSong ? formatTime(longestSong.duration || 0) : "—"}</strong>
          <small>{longestSong ? prettyTitle(longestSong.title, 5) : "no songs yet"}</small>
        </div>
      </section>

      <section className="analyticsSharePanelV339">
        <div>
          <p className="eyebrow">recap ready</p>
          <h3>built for monthly or yearly posts</h3>
          <p>
            Share your monthly and yearly import totals. Recorded listening history is shown separately above, using UTC dates.
          </p>
        </div>
        <button
          type="button"
          className="softButton analyticsShareButtonV339"
          onClick={() => navigator.clipboard?.writeText?.(`localtify recap: ${analyticsRecapCards.filter(card => card.label !== "all-time listening").map((card) => `${card.label}: ${card.value}`).join(" · ")}`)}
          disabled={!songs.length}
        >
          copy recap line
        </button>
      </section>
    </section>
  );
}

const PERIODS = [{value:"7", label:"Last 7 days"},{value:"30", label:"Last 30 days"},{value:"90", label:"Last 90 days"}] as const;

function RecordedListening({ songs }: { songs: Song[] }) {
  const [period, setPeriod] = useState<"7" | "30" | "90">("30");
  const [revision, refresh] = useState(0);
  const [result, setResult] = useState<ListeningSummary | null>(null);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selectedDay, setSelectedDay] = useState("");
  useEffect(() => {
    let active = true;
    setBusy(true); setFailed(false); setResult(null); setSelectedDay("");
    window.localitfy.getListeningSummary({days: Number(period) as 7 | 30 | 90})
      .then(value => { if (active) { setResult(value); setFailed(!value); } })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [period, revision]);
  const insights = useMemo(() => {
    const metadata = new Map(songs.map(song => [song.id, song]));
    const artists = new Map<string, number>(), genres = new Map<string, number>();
    for (const entry of result?.bySong || []) {
      const song = metadata.get(entry.id);
      if (!song) continue;
      for (const [map, label] of [[artists, song.artist], [genres, song.genre]] as const) {
        const value = label?.trim() || "Unknown";
        map.set(value, (map.get(value) || 0) + entry.ms);
      }
    }
    const top = (map: Map<string, number>) => [...map].sort((a,b) => b[1]-a[1]).slice(0,5);
    return { artists: top(artists), genres: top(genres) };
  },[result,songs]);
  const dayItems = (result?.byDay || []).map(day => ({ value: day.day, label: `${day.day} · ${formatAnalyticsDuration(day.ms / 1000)}` }));
  const shown = result?.byDay.find(day => day.day === selectedDay);
  return <section className="analyticsRecorded" aria-label="Recorded listening">
    <div className="analyticsRecordedHeader"><h2>Listening history</h2><ArcDropdownMenu ariaLabel="Listening history period" value={period} items={PERIODS} onValueChange={setPeriod} /><button type="button" className="softButton" disabled={busy} onClick={() => refresh(n=>n+1)}>Refresh</button></div>
    {busy ? <p role="status">Loading listening history…</p> : failed || !result ? <p role="status">Listening history is unavailable. {isAndroidApp() ? "Connect to your paired computer to retrieve it." : "Try refreshing."}</p> : <>
      <strong>{formatAnalyticsDuration(result.totalMs / 1000)} recorded · {result.sessions.toLocaleString()} listening events</strong>
      <p>Events are counted once and grouped by the UTC day they began. Older unrecorded listening is not estimated.{isAndroidApp() ? " Includes computer history as of the timestamp below; unsynced phone plays are not included." : ""}</p>
      <small>Snapshot: {new Date(result.generatedAt).toLocaleString()}</small>
      {result.totalMs > 0 ? <>
        <div className="analyticsRecordedHeader"><ArcDropdownMenu ariaLabel="Inspect listening day" value={selectedDay || dayItems.at(-1)?.value || ""} items={dayItems} onValueChange={setSelectedDay} /><p role="status">{shown ? shown.day + " · " + formatAnalyticsDuration(shown.ms/1000) : "Select a UTC day to inspect recorded listening."}</p></div>
        <div className="analyticsRecordedInsights">{([["Top artist credits", insights.artists],["Top genre tags", insights.genres]] as const).map(([title, entries]) => <div key={title}><h3>{title}</h3>{entries.map(([name,ms])=><p key={name}><span>{name}</span><strong>{formatAnalyticsDuration(ms/1000)}</strong></p>)}</div>)}</div>
      </> : <p>No listening events have been recorded for this period.</p>}
    </>}
  </section>;
}
