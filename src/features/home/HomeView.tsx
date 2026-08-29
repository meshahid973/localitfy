import "./home.css";
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

  const listenNowSongs = homeListenNowSongs.slice(0, 8);
  const newReleaseSongs = (homeFreshShelfSongs.length ? homeFreshShelfSongs : homeListenNowSongs).slice(0, 10);
  const artistKeys = new Set<string>();
  const mostListenedSongs = [...homeListenNowSongs, ...homeFreshShelfSongs]
    .filter((song) => {
      const key = String(song.artist || "unknown artist").trim().toLowerCase() || "unknown artist";
      if (artistKeys.has(key)) return false;
      artistKeys.add(key);
      return true;
    })
    .slice(0, 10);

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
      <header className="homeTopBar">
        <h1>Home</h1>
        <button className="homeCustomizeButton" type="button" onClick={openCoversViewWithCurrentSong}>
          <Images size={13} strokeWidth={2.1} aria-hidden="true" />
          <span>Customize Home</span>
        </button>
      </header>

      <section
        className={`homeJumpBack ${settings.heroExpanded ? "expanded" : "compact"} ${heroMotionClass}`}
        aria-label="jump back in"
      >
        <div className={`homeJumpCopy nowPlayingCopySwap ${nowPlayingSongMotionClass}`} data-song-motion-key={nowPlayingTransitionKey}>
          <span className="homeJumpEyebrow">↻ JUMP BACK IN</span>
          <h2 className={heroTitleClass} title={currentSong?.title || "drop in your music"}>{heroDisplayTitle}</h2>
          <p>{heroDisplayArtist}</p>

          {playerError ? <div className="homeInlineNotice error">{playerError}</div> : null}
          {isThreeAm && settings.volume > 0.8 ? <div className="homeInlineNotice">volume is above 80% · late night ears deserve mercy.</div> : null}

          <div className="homeJumpActions">
            <button className="homeStartButton" type="button" onClick={startListening} disabled={!currentSong && playableSongCount === 0}>
              <Play size={12} fill="currentColor" strokeWidth={2.3} aria-hidden="true" />
              <span>Start Listening</span>
            </button>
            <button className="homeRoundButton" type="button" onClick={shuffleLibrarySongsAction} disabled={playableSongCount < 2} aria-label="shuffle library" title="Shuffle library">
              <Shuffle size={14} strokeWidth={2.2} aria-hidden="true" />
            </button>
            <button className="homeRoundButton" type="button" onClick={toggleHeroExpanded} aria-label={settings.heroExpanded ? "use compact hero" : "expand hero"} title={settings.heroExpanded ? "Use compact hero" : "Expand hero"}>
              {settings.heroExpanded ? <Minimize2 size={14} strokeWidth={2.1} aria-hidden="true" /> : <Maximize2 size={14} strokeWidth={2.1} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {currentSong ? (
          <div className="homeJumpArtwork" aria-hidden="true">
            <Cover song={currentSong} className="homeJumpCover" priority="high" />
          </div>
        ) : null}
      </section>

      <section className="homeSection homeListenSection" aria-labelledby="home-listen-title">
        <h3 id="home-listen-title">Listen now</h3>
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
                  <Cover song={song} className="homeListenCover" />
                  <span className="homeListenCopy">
                    <strong>{prettyTitle(song.title, 6)}</strong>
                    <small>{prettyMeta(song.artist)}</small>
                  </span>
                  <span className="homeListenPlay" aria-hidden="true"><Play size={12} fill="currentColor" /></span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="homeEmptyState">
            <MascotStateArt state="empty" className="homeEmptyMascot" />
            <div><strong>your home is quiet</strong><span>import music and Localtify will build this page for you.</span></div>
          </div>
        )}
      </section>

      {mostListenedSongs.length ? (
        <section className="homeSection homeArtistsSection" aria-labelledby="home-most-listened-title">
          <h3 id="home-most-listened-title">Most listened</h3>
          <div className="homeArtistRail">
            {mostListenedSongs.map((song) => (
              <button
                key={`${song.id}-${song.artist || "unknown"}`}
                className="homeArtistCard"
                type="button"
                onClick={() => void selectSong(song.id, true)}
                title={`play ${song.artist || song.title}`}
              >
                <span className="homeArtistCoverWrap">
                  <Cover song={song} className="homeArtistCover" />
                  <span className="homeArtistPlay" aria-hidden="true"><Play size={13} fill="currentColor" /></span>
                </span>
                <strong>{prettyMeta(song.artist || "unknown artist")}</strong>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {newReleaseSongs.length ? (
        <section className="homeSection homeReleasesSection" aria-labelledby="home-releases-title">
          <h3 id="home-releases-title">New Releases</h3>
          <div className="homeReleaseRail">
            {newReleaseSongs.map((song) => (
              <button
                key={song.id}
                className={`homeReleaseCard ${song.id === currentId ? "active" : ""}`}
                type="button"
                onClick={() => void selectSong(song.id, true)}
                title={`play ${song.title}`}
              >
                <span className="homeReleaseCoverWrap">
                  <Cover song={song} className="homeReleaseCover" />
                  <span className="homeReleasePlay" aria-hidden="true"><Play size={15} fill="currentColor" /></span>
                </span>
                <span className="homeReleaseCopy">
                  <strong>{prettyTitle(song.title, 5)}</strong>
                  <small>{prettyMeta(song.artist)}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <span className="homeNowPlayingLabel" aria-hidden="true">{currentNowPlayingLabel}</span>
    </div>
  );
}
