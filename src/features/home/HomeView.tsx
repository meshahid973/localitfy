import type { CSSProperties } from "react";
import { Images, Maximize2, Minimize2, Play, Shuffle } from "lucide-react";
import { Cover } from "../covers/Cover";
import { MascotStateArt } from "../../shared/ui/LocaltifyViewUi";
import { prettyMeta, prettyTitle } from "../search/search.utils";
import type { Song } from "../library/song.types";
import type { Settings } from "../settings/settings.types";

export type HomeViewProps = {
  ambientStyle: CSSProperties;
  currentId: string | null;
  currentNowPlayingLabel: string;
  currentSong: Song | null;
  heroDisplayArtist: string;
  heroDisplayTitle: string;
  heroMotionClass: string;
  heroTitleClass: string;
  homeFreshShelfSongs: readonly Song[];
  homeListenNowSongs: readonly Song[];
  isPlaying: boolean;
  isThreeAm: boolean;
  nowPlayingSongMotionClass: string;
  nowPlayingTransitionKey: string;
  openCoversViewWithCurrentSong: () => unknown;
  playableSongCount: number;
  playerError: string | null;
  selectSong: (songId: string, shouldPlay?: boolean) => unknown;
  settings: Pick<Settings, "heroExpanded" | "volume">;
  shuffleLibrarySongsAction: () => unknown;
  toggleHeroExpanded: () => unknown;
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

  const continueSongs = (homeFreshShelfSongs.length ? homeFreshShelfSongs : homeListenNowSongs).slice(0, 9);
  const listenNowSongs = homeListenNowSongs.slice(0, 8);
  const artistKeys = new Set<string>();
  const artistSongs = [...homeListenNowSongs, ...homeFreshShelfSongs]
    .filter((song) => {
      const key = String(song.artist || "unknown artist").trim().toLowerCase() || "unknown artist";
      if (artistKeys.has(key)) return false;
      artistKeys.add(key);
      return true;
    })
    .slice(0, 8);

  const homeStyle = {
    ...ambientStyle,
    "--home-motion-seed": nowPlayingTransitionKey
  } as CSSProperties;

  const startListening = () => {
    if (currentSong?.id) {
      void selectSong(currentSong.id, true);
      return;
    }
    shuffleLibrarySongsAction();
  };

  return (
    <div className="homePage" style={homeStyle}>
      <section
        className={`homeHero ${settings.heroExpanded ? "homeHeroExpanded" : "homeHeroCompact"} ${heroMotionClass}`}
        aria-label="featured local track"
      >
        <div className="homeHeroMedia" aria-hidden="true">
          <Cover song={currentSong} className={`homeHeroArtwork ${nowPlayingSongMotionClass}`} priority="high" />
          <div className="homeHeroMediaShade" />
        </div>

        <div className={`homeHeroContent nowPlayingCopySwap ${nowPlayingSongMotionClass}`} data-song-motion-key={nowPlayingTransitionKey}>
          <div className="homeHeroKickerRow">
            <span className="homeHeroKicker">{currentNowPlayingLabel || "featured track"}</span>
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
              onClick={startListening}
              disabled={!currentSong && playableSongCount === 0}
            >
              <Play size={14} fill="currentColor" strokeWidth={2.2} aria-hidden="true" />
              <span>start listening</span>
            </button>

            <button
              className="homeHeroAction homeHeroActionSecondary"
              type="button"
              onClick={shuffleLibrarySongsAction}
              disabled={playableSongCount < 2}
              title="Shuffle the whole library"
            >
              <Shuffle size={14} strokeWidth={2.2} aria-hidden="true" />
              <span>shuffle</span>
            </button>
          </div>
        </div>

        <div className="homeHeroUtilities">
          <button
            className="homeHeroUtility"
            type="button"
            onClick={openCoversViewWithCurrentSong}
            title="Open pixel cover gallery"
            aria-label="open pixel cover gallery"
          >
            <Images size={16} strokeWidth={2.1} aria-hidden="true" />
          </button>
          <button
            className="homeHeroUtility"
            type="button"
            onClick={toggleHeroExpanded}
            aria-pressed={settings.heroExpanded}
            title={settings.heroExpanded ? "Use compact hero" : "Expand hero"}
            aria-label={settings.heroExpanded ? "use compact hero" : "expand hero"}
          >
            {settings.heroExpanded ? <Minimize2 size={16} strokeWidth={2.1} aria-hidden="true" /> : <Maximize2 size={16} strokeWidth={2.1} aria-hidden="true" />}
          </button>
        </div>
      </section>

      <section className="homeSection homeContinueSection" aria-labelledby="home-continue-title">
        <header className="homeSectionHeader">
          <div>
            <span className="homeSectionEyebrow">library</span>
            <h3 id="home-continue-title">Continue listening</h3>
          </div>
        </header>

        {continueSongs.length ? (
          <div className="homeContinueRail">
            {continueSongs.map((song) => {
              const active = song.id === currentId;
              return (
                <button
                  key={song.id}
                  className={`homeContinueCard ${active ? "active" : ""}`}
                  type="button"
                  onClick={() => void selectSong(song.id, true)}
                  title={`play ${song.title}`}
                >
                  <span className="homeContinueCoverWrap">
                    <Cover song={song} className="homeContinueCover" />
                    <span className="homeContinueHoverPlay" aria-hidden="true"><Play size={16} fill="currentColor" /></span>
                    {active && isPlaying ? <span className="homeContinuePlaying" aria-hidden="true"><i /><i /><i /></span> : null}
                  </span>
                  <span className="homeContinueCopy">
                    <strong>{prettyTitle(song.title, 5)}</strong>
                    <small>{prettyMeta(song.artist)}</small>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="homeEmptyState">
            <MascotStateArt state="empty" className="homeEmptyMascot" />
            <div><strong>your home is quiet</strong><span>import music and Localtify will build this shelf for you.</span></div>
          </div>
        )}
      </section>

      <section className="homeSection homeListenSection" aria-labelledby="home-listen-title">
        <header className="homeSectionHeader">
          <div>
            <span className="homeSectionEyebrow">music</span>
            <h3 id="home-listen-title">Listen now</h3>
          </div>
        </header>

        {listenNowSongs.length ? (
          <div className="homeListenGrid">
            {listenNowSongs.map((song) => {
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
                    <span className="homeListenPlay" aria-hidden="true"><Play size={12} fill="currentColor" /></span>
                  </span>
                  <span className="homeListenCopy">
                    <strong>{prettyTitle(song.title, 6)}</strong>
                    <small>{prettyMeta(song.artist)}</small>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </section>

      {artistSongs.length ? (
        <section className="homeSection homeArtistsSection" aria-labelledby="home-artists-title">
          <header className="homeSectionHeader">
            <div>
              <span className="homeSectionEyebrow">artists</span>
              <h3 id="home-artists-title">Top artists</h3>
            </div>
          </header>

          <div className="homeArtistRail">
            {artistSongs.map((song) => (
              <button
                key={`${song.id}-${song.artist || "unknown"}`}
                className="homeArtistCard"
                type="button"
                onClick={() => void selectSong(song.id, true)}
                title={`play ${song.artist || song.title}`}
              >
                <span className="homeArtistCoverWrap">
                  <Cover song={song} className="homeArtistCover" />
                  <span className="homeArtistPlay" aria-hidden="true"><Play size={14} fill="currentColor" /></span>
                </span>
                <strong>{prettyMeta(song.artist || "unknown artist")}</strong>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
