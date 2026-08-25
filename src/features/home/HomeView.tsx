import type { CSSProperties } from "react";
import { Images, Maximize2, Minimize2 } from "lucide-react";
import { Cover } from "../covers/Cover";
import { MascotStateArt } from "../../shared/ui/LocaltifyViewUi";
import { formatTime } from "../../shared/utils/format";
import { getAmbientStyle, getSongAmbientSource } from "../covers/cover.ambient";
import { prettyMeta, prettyTitle } from "../search/search.utils";

export type HomeViewProps = {
  ambientStyle: any;
  currentId: any;
  currentNowPlayingLabel: any;
  currentSong: any;
  heroDisplayArtist: any;
  heroDisplayTitle: any;
  heroMotionClass: any;
  heroTitleClass: any;
  homeFreshShelfSongs: any;
  homeListenNowSongs: any;
  isPlaying: any;
  isThreeAm: any;
  nowPlayingSongMotionClass: any;
  nowPlayingTransitionKey: any;
  openCoversViewWithCurrentSong: any;
  playableSongCount: any;
  playerError: any;
  selectSong: any;
  settings: any;
  shuffleLibrarySongsAction: any;
  toggleHeroExpanded: any;
};

export default function HomeView(props: HomeViewProps) {
  const {
    ambientStyle,
    currentId,
    currentNowPlayingLabel,
    currentSong,
    heroDisplayArtist,
    heroDisplayTitle,
    heroMotionClass,
    heroTitleClass,
    homeFreshShelfSongs,
    homeListenNowSongs,
    isPlaying,
    isThreeAm,
    nowPlayingSongMotionClass,
    nowPlayingTransitionKey,
    openCoversViewWithCurrentSong,
    playableSongCount,
    playerError,
    selectSong,
    settings,
    shuffleLibrarySongsAction,
    toggleHeroExpanded
  } = props;

  return (
    <>
      <section
        className={`hero heroPremium ambientSurface heroLayoutMotion ${settings.heroExpanded ? "heroExpanded" : "heroCompact"} ${heroMotionClass} ${heroTitleClass}`}
        style={{ ...ambientStyle, "--hero-motion-seed": nowPlayingTransitionKey } as CSSProperties}
      >
        <div className="heroAmbiencePulse" aria-hidden="true" />
        <div className={`heroCoverGhost ${nowPlayingSongMotionClass}`} data-song-motion-key={nowPlayingTransitionKey} aria-hidden="true" />

        <div className={`heroText heroTextClean nowPlayingCopySwap ${nowPlayingSongMotionClass}`} data-song-motion-key={nowPlayingTransitionKey}>
          <p className={`eyebrow nowPlayingEyebrowSwap ${nowPlayingSongMotionClass}`} title={currentNowPlayingLabel}>
            {currentNowPlayingLabel}
          </p>

          <h3 className={`heroTitle nowPlayingTitleSwap ${nowPlayingSongMotionClass}`} title={currentSong ? currentSong.title : "drop in your music"}>
            {heroDisplayTitle}
          </h3>

          <p className={`heroArtistLine nowPlayingArtistSwap ${nowPlayingSongMotionClass}`} title={currentSong ? currentSong.artist || "unknown artist" : "import songs to start listening"}>
            {heroDisplayArtist}
          </p>

          {playerError ? <div className="warningBox">{playerError}</div> : null}
          {isThreeAm && settings.volume > 0.8 ? (
            <div className="warningBox lateNightWarning">volume is above 80% · late night ears deserve mercy.</div>
          ) : null}

          <div className="heroQuickActions" aria-label="now playing actions">
            <button
              className="heroTinyButton heroTinyButtonPrimary"
              type="button"
              onClick={toggleHeroExpanded}
              aria-pressed={settings.heroExpanded}
              title={settings.heroExpanded ? "collapse the now playing banner" : "expand the now playing banner"}
            >
              {settings.heroExpanded ? <Minimize2 size={14} strokeWidth={2.2} aria-hidden="true" /> : <Maximize2 size={14} strokeWidth={2.2} aria-hidden="true" />}
              <span>{settings.heroExpanded ? "collapse" : "expand"}</span>
            </button>

            <button
              className="heroTinyButton heroTinyButtonSecondary"
              type="button"
              onClick={openCoversViewWithCurrentSong}
              title="open pixel cover gallery"
            >
              <Images size={14} strokeWidth={2.2} aria-hidden="true" />
              <span>covers</span>
            </button>
          </div>
        </div>

        <div className={`heroArtWrap nowPlayingArtSwap ${nowPlayingSongMotionClass}`} data-song-motion-key={nowPlayingTransitionKey}>
          <Cover song={currentSong} className="heroArt" priority="high" />
        </div>
      </section>

      <section className={`homeShelfStack ${heroMotionClass}`} aria-label="home music shelves">
        <section className="homeShelfPanel homeListenPanel">
          <div className="homeShelfHeader">
            <div>
              <p className="eyebrow">local picks</p>
              <h3>Listen now</h3>
            </div>
            <div className="homeShelfActions">
              <span>{playableSongCount || 0} playable</span>
              <button
                className="homeShelfActionButton"
                type="button"
                onClick={shuffleLibrarySongsAction}
                disabled={(playableSongCount || 0) < 2}
                title="Shuffle the whole library and fill the queue"
              >
                shuffle library
              </button>
            </div>
          </div>

          <div className="homeListenRail">
            {homeListenNowSongs.length ? (
              homeListenNowSongs.map((song: any, index: number) => {
                const active = song.id === currentId;
                const listenAmbienceSource = getSongAmbientSource(song);
                const listenAmbienceStyle = getAmbientStyle(listenAmbienceSource) ?? {};

                return (
                  <button
                    key={song.id}
                    className={`homeListenCard ${active ? "active" : ""} ${active && isPlaying ? "playing" : ""}`}
                    data-cover-ambience={listenAmbienceSource ? "on" : "off"}
                    type="button"
                    onClick={() => void selectSong(song.id, true)}
                    title={`play ${song.title}`}
                    style={{ "--card-delay": `${index * 48}ms`, ...listenAmbienceStyle } as CSSProperties}
                  >
                    {listenAmbienceSource ? (
                      <span className="homeListenBackground" aria-hidden="true">
                        <img
                          className="homeListenBackgroundImage"
                          src={listenAmbienceSource}
                          alt=""
                          width={520}
                          height={164}
                          loading="lazy"
                          decoding="async"
                          fetchPriority="low"
                          referrerPolicy="no-referrer"
                          draggable={false}
                        />
                      </span>
                    ) : null}

                    <span className="homeListenForeground">
                      <Cover song={song} className="homeListenCover" />
                      <span className="homeListenCopy">
                        <strong className="homeListenTitle">{prettyTitle(song.title, 5)}</strong>
                        <small className="homeListenArtist">{prettyMeta(song.artist)}</small>
                      </span>
                      <span className="homeListenMeta">{formatTime(song.duration || 0)}</span>
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="emptyState homeShelfEmpty homeShelfMascotEmptyV501">
                <MascotStateArt state="empty" className="homeShelfEmptyMascotV501" />
                <span className="mascotEmptyCopyV496">
                  <strong>no songs yet</strong>
                  <p>Import songs to start building your local library.</p>
                </span>
              </div>
            )}
          </div>
        </section>

        <section className="homeShelfPanel homeFreshPanel">
          <div className="homeShelfHeader">
            <div>
              <p className="eyebrow">fresh shelf</p>
              <h3>recent covers</h3>
            </div>
          </div>

          <div className="homeFreshRail">
            {homeFreshShelfSongs.length ? (
              homeFreshShelfSongs.map((song: any, index: number) => (
                <button
                  key={song.id}
                  className={`homeFreshCard ${song.id === currentId ? "active" : ""} ${song.id === currentId && isPlaying ? "playing" : ""}`}
                  type="button"
                  onClick={() => void selectSong(song.id, true)}
                  title={`play ${song.title}`}
                  style={{ "--card-delay": `${index * 42}ms` } as CSSProperties}
                >
                  <Cover song={song} className="homeFreshCover" />
                  <strong>{prettyTitle(song.title, 4)}</strong>
                  <small>{prettyMeta(song.artist)}</small>
                </button>
              ))
            ) : (
              <div className="emptyState homeShelfEmpty">
                <strong>nothing to show yet</strong>
                <p>your newest covers appear here after import.</p>
              </div>
            )}
          </div>
        </section>
      </section>
    </>
  );
}
