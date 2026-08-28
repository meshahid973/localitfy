import type { CSSProperties } from "react";
import { LocaltifyStateCard } from "../../shared/ui/LocaltifyViewUi";
import { formatTime } from "../../shared/utils/format";
import { prettyTitle } from "../search/search.utils";

export type AnalyticsViewProps = {
  analyticsRecapCards: any;
  analyticsStatCards: any;
  averageSongSeconds: any;
  importSongs: any;
  libraryHealthLabel: any;
  libraryLengthLabel: any;
  likedPercent: any;
  longestSong: any;
  missingFileCount: any;
  neverPlayedSongs: any;
  playedPercent: any;
  ready: any;
  recentImportWeekCount: any;
  songs: any;
};

export default function AnalyticsView(props: AnalyticsViewProps) {
  const {
    analyticsRecapCards,
    analyticsStatCards,
    averageSongSeconds,
    importSongs,
    libraryHealthLabel,
    libraryLengthLabel,
    likedPercent,
    longestSong,
    missingFileCount,
    neverPlayedSongs,
    playedPercent,
    recentImportWeekCount,
    songs
  } = props;

  return (
    <section className="analyticsStudioV339" aria-label="lightweight listening recap">
      <section className="analyticsHeroV339">
        <div className="analyticsHeroCopyV339">
          <p className="eyebrow">local recap</p>
          <h3>your listening, cleaned up</h3>
          <p>
            {songs.length
              ? "Fast recap cards from your real local library data: imports, plays, listening time, file health, and library length without heavy charts."
              : "Import songs and localtify will build a lightweight recap here."}
          </p>
        </div>

        <div className="analyticsHeroMeterV339" aria-label="library readiness">
          <span style={{ "--meter": `${playedPercent}%` } as CSSProperties}>
            <strong>{playedPercent}%</strong>
            <small>played</small>
          </span>
          <span style={{ "--meter": `${likedPercent}%` } as CSSProperties}>
            <strong>{likedPercent}%</strong>
            <small>liked</small>
          </span>
          <span style={{ "--meter": `${libraryHealthLabel === "healthy" ? 100 : Math.max(0, 100 - missingFileCount * 8)}%` } as CSSProperties}>
            <strong>{libraryHealthLabel}</strong>
            <small>health</small>
          </span>
        </div>
      </section>

      {!songs.length ? (
        <LocaltifyStateCard
          tone="info"
          eyebrow="analytics"
          title="Play songs first"
          message="Your monthly and yearly recap appears after Localtify has songs and play history to read."
          detail="Localtify only uses your local library data: play counts, durations, imports, liked songs, and missing-file checks."
          actions={<button className="mainAction" type="button" onClick={importSongs}>import songs</button>}
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

      <section className="analyticsRecapGridV339" aria-label="recap cards">
        {(analyticsRecapCards || []).map((card, index) => {
          const progress =
            typeof card.progress === "number"
              ? Math.min(100, Math.max(songs.length ? 4 : 0, card.progress))
              : index === 0
                ? Math.min(100, Math.max(4, recentImportWeekCount * 12))
                : index === 1
                  ? Math.min(100, Math.max(4, songs.length ? 64 : 4))
                  : Math.min(100, Math.max(4, playedPercent));

          return (
            <article
              key={card.label}
              className={`analyticsRecapCardV339 recap-${index}`}
              style={{ "--recap-progress": `${progress}%` } as CSSProperties}
            >
              <span>{card.label}</span>
              <strong title={card.value}>{card.value}</strong>
              <small>{card.note}</small>
              <em>{card.meta}</em>
              <i aria-hidden="true" />
            </article>
          );
        })}
      </section>

      <section className="analyticsSnapshotV339" aria-label="quick stats">
        {analyticsStatCards.map((card) => (
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
          <strong>{(missingFileCount + neverPlayedSongs.length).toLocaleString()}</strong>
          <small>{missingFileCount ? `${missingFileCount} missing file${missingFileCount === 1 ? "" : "s"}` : `${neverPlayedSongs.length} never played`}</small>
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
            Use the recap cards above for a clean localtify wrapped-style summary. These numbers come from local song metadata and saved play counts, so they stay lightweight and private.
          </p>
        </div>
        <button
          type="button"
          className="softButton analyticsShareButtonV339"
          onClick={() => navigator.clipboard?.writeText?.(`localtify recap: ${analyticsRecapCards.map((card) => `${card.label}: ${card.value}`).join(" · ")}`)}
          disabled={!songs.length}
        >
          copy recap line
        </button>
      </section>
    </section>
  );
}
