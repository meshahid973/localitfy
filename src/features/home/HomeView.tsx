import type { CSSProperties } from "react";
import { Images, Maximize2, Minimize2, Play, Shuffle } from "lucide-react";
import { Cover } from "../covers/Cover";
import { MascotStateArt } from "../../shared/ui/LocaltifyViewUi";
import { formatTime } from "../../shared/utils/format";
import { prettyMeta, prettyTitle } from "../search/search.utils";

export type HomeViewProps = {
  [key: string]: any;
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

  const listenNowSongs = Array.isArray(homeListenNowSongs) ? homeListenNowSongs.slice(0, 6) : [];
  const rotationSongs = Array.isArray(homeFreshShelfSongs) ? homeFreshShelfSongs.slice(0, 10) : [];

  return (
    <div className="homePage">
      <section
        className={`homeHero ${settings.heroExpanded ? "homeHeroExpanded" : "homeHeroCompact"} ${heroMotionClass}`}
        style={{ ...ambientStyle, "--home-motion-seed": nowPlayingTransitionKey } as CSSProperties}
        aria-label="now playing"
      >
        <div className="homeHeroMedia" aria-hidden="true">
          <Cover song={currentSong} className={`homeHeroArtwork ${nowPlayingSongMotionClass}`} priority="high" />
          <div className="homeHeroMediaShade" />
        </div>

        <div className={`homeHeroContent nowPlayingCopySwap ${nowPlayingSongMotionClass}`} data-song-motion-key={nowPlayingTransitionKey}>
          <div className="homeHeroKickerRow">
            <span className="homeHeroKicker">{currentNowPlayingLabel || "now playing"}</span>
            {currentSong ? <span className={`homeHeroPlayingDot ${isPlaying ? "isPlaying" : ""}`} aria-hidden="true" /> : null}
          </div>

          <h3 className={`homeHeroTitle ${heroTitleClass}`} title={currentSong ? currentSong.title : "drop in your music"}>
            {heroDisplayTitle}
          </h3>

          <p className="homeHeroArtist" title={currentSong ? currentSong.artist || "unknown artist" : "import songs to start listening"}>
            {heroDisplayArtist}
          </p>

          {playerError ? <div className="homeHeroNotice homeHeroNoticeError">{playerError}</div> : null}
          {isThreeAm && settings.volume > 0.8 ? (
            <div className="homeHeroNotice">volume is above 80% · late night ears deserve mercy.</div>
          ) : null}

          <div className="homeHeroActions">
            <button
              className="homeHeroAction homeHeroActionPrimary"
              type="button"
              onClick={shuffleLibrarySongsAction}
              disabled={(playableSongCount || 0) < 2}
              title="Shuffle the whole library"
            >
              <Shuffle size={16} strokeWidth={2.2} aria-hidden="true" />
              <span>shuffle library</span>
            </button>

            <button
              className="homeHeroAction homeHeroActionSecondary"
              type="button"
              onClick={openCoversViewWithCurrentSong}
              title="Open pixel cover gallery"
            >
              <Images size={16} strokeWidth={2.2} aria-hidden="true" />
              <span>covers</span>
            </button>
          </div>
        </div>

        <button
          className="homeHeroSizeToggle"
          type="button"
          onClick={toggleHeroExpanded}
          aria-pressed={settings.heroExpanded}
          title={settings.heroExpanded ? "Use compact hero" : "Expand hero"}
        >
          {settings.heroExpanded ? <Minimize2 size={17} strokeWidth={2.1} aria-hidden="true" /> : <Maximize2 size={17} strokeWidth={2.1} aria-hidden="true" />}
          <span className="srOnly">{settings.heroExpanded ? "compact hero" : "expand hero"}</span>
        </button>
      </section>

      <section className="homeSection homeListenSection" aria-labelledby="home-listen-title">
        <header className="homeSectionHeader">
          <div>
            <span className="homeSectionEyebrow">made from your library</span>
            <h3 id="home-listen-title">Listen now</h3>
          </div>
          <span className="homeSectionMeta">{playableSongCount || 0} playable</span>
        </header>

        {listenNowSongs.length ? (
          <div className="homeListenGrid">
            {listenNowSongs.map((song: any) => {
              const active = song.id === currentId;
              return (
                <button
                  key={song.id}
                  className={`homeListenRow ${active ? "active" : ""} ${active && isPlaying ? "playing" : ""}`}
                  type="button"
                  onClick={() => void selectSong(song.id, true)}
                  title={`play ${song.title}`}
                >
                  <span className="homeListenCoverWrap">
                    <Cover song={song} className="homeListenCover" />
                    <span className="homeListenPlay" aria-hidden="true"><Play size={13} fill="currentColor" /></span>
                  </span>
                  <span className="homeListenCopy">
                    <strong>{prettyTitle(song.title, 6)}</strong>
                    <small>{prettyMeta(song.artist)}</small>
                  </span>
                  <span className="homeListenTime">{formatTime(song.duration || 0)}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="homeEmptyState">
            <MascotStateArt state="empty" className="homeEmptyMascot" />
            <div><strong>your home is quiet</strong><span>import music and Localtify will build this section for you.</span></div>
          </div>
        )}
      </section>

      <section className="homeSection homeRotationSection" aria-labelledby="home-rotation-title">
        <header className="homeSectionHeader">
          <div>
            <span className="homeSectionEyebrow">fresh shelf</span>
            <h3 id="home-rotation-title">Recent rotation</h3>
          </div>
        </header>

        {rotationSongs.length ? (
          <div className="homeRotationRail">
            {rotationSongs.map((song: any) => {
              const active = song.id === currentId;
              return (
                <button
                  key={song.id}
                  className={`homeRotationCard ${active ? "active" : ""}`}
                  type="button"
                  onClick={() => void selectSong(song.id, true)}
                  title={`play ${song.title}`}
                >
                  <span className="homeRotationCoverWrap">
                    <Cover song={song} className="homeRotationCover" />
                    {active && isPlaying ? <span className="homeRotationPlaying" aria-hidden="true"><i /><i /><i /></span> : null}
                  </span>
                  <strong>{prettyTitle(song.title, 4)}</strong>
                  <small>{prettyMeta(song.artist)}</small>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="homeEmptyState homeEmptyStateCompact">
            <div><strong>nothing recent yet</strong><span>newly imported covers will show up here.</span></div>
          </div>
        )}
      </section>
    </div>
  );
}
