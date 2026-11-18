import "./home.css";
import { Fragment, lazy, Suspense, useCallback, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { AudioLines, Maximize2, Minimize2, Play, Shuffle, SlidersHorizontal, Smartphone } from "lucide-react";
import { isAndroidApp } from "../../app/platform";
import { Cover } from "../covers/Cover";
import { MascotStateArt } from "../../shared/ui/LocaltifyViewUi";
import { prettyMeta, prettyTitle } from "../search/search.utils";
import type { Song } from "../library/song.types";
import type { Settings } from "../settings/settings.types";
const HomeCustomizePanel = lazy(() => import("./HomeCustomizePanel"));
import { visibleHomeSections, type HomeLayoutPatch, type HomeSectionId } from "./homeLayout";
import { HomeDailyMixRail, HomeSongRail } from "./HomeShelves";
import { useHomeDay } from "./useHomeDay";
import type { SimilarSeedRequest } from "../analysis/similarSeed";
import { useAppActions } from "../shell/appActions";
import { diversifyHomeRecommendations, pickLikedSongs, pickMostPlayedSongs, pickNotPlayedYet, pickRecentlyPlayed, pickRediscover } from "./homeShelfPicks";

export type HomeViewProps = {
  ambientStyle: CSSProperties;
  currentId: string | null;
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
  openAnalysisSettings: () => unknown;
  openCoversViewWithCurrentSong: () => unknown;
  openDailyMixes: () => unknown;
  openSimilarSongs: (request: SimilarSeedRequest) => unknown;
  playableSongCount: number;
  playerError: string | null;
  playSongs: (songIds: string[], label: string) => unknown;
  selectSong: (songId: string, shouldPlay?: boolean) => unknown;
  songs: readonly Song[];
  settings: Pick<Settings, "heroExpanded" | "volume" | "homeSectionOrder" | "homeHiddenSections">;
  shuffleLibrarySongsAction: () => unknown;
  toggleHeroExpanded: () => unknown;
  updateHomeLayout: (patch: HomeLayoutPatch) => unknown;
};

export default function HomeView(props: HomeViewProps) {
  const {
    ambientStyle,
    currentId,
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
    openAnalysisSettings,
    openCoversViewWithCurrentSong,
    openDailyMixes,
    playableSongCount,
    playerError,
    playSongs,
    selectSong,
    songs,
    settings,
    shuffleLibrarySongsAction,
    toggleHeroExpanded,
    updateHomeLayout
  } = props;

  const actions = useAppActions();
  const day = useHomeDay();
  const android = isAndroidApp();
  const needsPhoneSync = android && songs.length === 0;
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const closeCustomize = useCallback(() => setCustomizeOpen(false), []);

  const listenNowSongs = useMemo(() => homeListenNowSongs.slice(0, android ? 4 : 8), [homeListenNowSongs, android]);
  const recentlyAddedSongs = useMemo(() => homeFreshShelfSongs.slice(0, 10), [homeFreshShelfSongs]);
  const visibleSections = visibleHomeSections(settings.homeSectionOrder, settings.homeHiddenSections);
  const showing = (id: HomeSectionId) => visibleSections.includes(id);
  const showMostListened = showing("mostListened");
  const showingListenNow = showing("listenNow");
  const mostPlayedSongs = useMemo(() => showMostListened ? pickMostPlayedSongs(songs) : [], [showMostListened, songs]);

  // Only work out the shelves that are on screen; a hidden shelf costs nothing.
  const showRecent = showing("recentlyPlayed"), showLiked = showing("likedSongs");
  const showRediscover = showing("rediscover"), showUnplayed = showing("notPlayedYet"), showMixes = showing("dailyMixes");
  const recentlyPlayedSongs = useMemo(() => (showRecent ? pickRecentlyPlayed(songs) : []), [showRecent, songs]);
  const likedSongs = useMemo(() => (showLiked ? pickLikedSongs(songs) : []), [showLiked, songs]);
  const rediscoverSongs = useMemo(() => showRediscover ? diversifyHomeRecommendations(pickRediscover(songs, new Date(), 32), showingListenNow ? listenNowSongs : []) : [], [showRediscover, songs, day, showingListenNow, listenNowSongs]);
  const notPlayedSongs = useMemo(() => showUnplayed ? diversifyHomeRecommendations(pickNotPlayedYet(songs, new Date(day + "T00:00:00"), 32), [...(showingListenNow ? listenNowSongs : []), ...rediscoverSongs]) : [], [showUnplayed, songs, day, showingListenNow, listenNowSongs, rediscoverSongs]);
  const songsById = useMemo(() => (showMixes ? new Map(songs.map((song) => [song.id, song])) : new Map<string, Song>()), [showMixes, songs]);

  const startListening = () => {
    if (currentSong?.id) {
      void selectSong(currentSong.id, true);
      return;
    }
    shuffleLibrarySongsAction();
  };

  const sections: Record<HomeSectionId, ReactNode> = {
    jumpBack: (
      <section
        className={`homeJumpBack ${settings.heroExpanded ? "expanded" : "compact"} ${heroMotionClass}`}
        aria-label="jump back in"
      >
        {currentSong ? <div className="homeFeatureArt" aria-hidden="true">
          <Cover song={currentSong} className="homeFeatureCover" priority="high" preferThumbnail={!settings.heroExpanded || android} />
        </div> : null}
        <div className={`homeJumpCopy nowPlayingCopySwap ${nowPlayingSongMotionClass}`} data-song-motion-key={nowPlayingTransitionKey}>
          {currentSong ? <span className="homeFeatureLabel">Jump back in</span> : null}
          <h2 className={heroTitleClass} title={currentSong?.title || (needsPhoneSync ? "Sync your music" : "drop in your music")}>{needsPhoneSync ? "Sync your music" : currentSong?.title || heroDisplayTitle}</h2>
          <p>{needsPhoneSync ? "Pair with your computer in Settings → Library." : heroDisplayArtist}</p>

          {playerError ? <div className="homeInlineNotice error">{playerError}</div> : null}
          {isThreeAm && settings.volume > 0.8 ? <div className="homeInlineNotice">volume is above 80% · late night ears deserve mercy.</div> : null}

          <div className="homeJumpActions">
            <button className="homeStartButton" type="button" onClick={needsPhoneSync ? () => actions.nav.go("settings", "nav") : startListening} disabled={!needsPhoneSync && !currentSong && playableSongCount === 0}>
              {needsPhoneSync ? <Smartphone size={12} aria-hidden="true" /> : <Play size={12} fill="currentColor" strokeWidth={2.3} aria-hidden="true" />}
              <span>{needsPhoneSync ? "Set up phone sync" : android ? (currentSong ? "Play" : "Shuffle music") : currentSong ? "Play track" : "Start Listening"}</span>
            </button>
            {!needsPhoneSync ? <button className="homeRoundButton" type="button" onClick={shuffleLibrarySongsAction} disabled={playableSongCount < 2} aria-label="shuffle library" title="Shuffle library">
              <Shuffle size={14} strokeWidth={2.2} aria-hidden="true" />
            </button> : null}
            {!android ? <button className="homeRoundButton" type="button" onClick={toggleHeroExpanded} aria-label={settings.heroExpanded ? "use compact hero" : "expand hero"} title={settings.heroExpanded ? "Use compact hero" : "Expand hero"}>
              {settings.heroExpanded ? <Minimize2 size={14} strokeWidth={2.1} aria-hidden="true" /> : <Maximize2 size={14} strokeWidth={2.1} aria-hidden="true" />}
            </button> : null}
          </div>
        </div>

      </section>
    ),
    listenNow: (
      <section className="homeSection homeListenSection" aria-labelledby="home-listen-title">
        <h3 id="home-listen-title">Listen now</h3>
        {listenNowSongs.length ? (
          <div className="homeListenGrid" data-count={listenNowSongs.length}>
            {listenNowSongs.map((song) => {
              const active = song.id === currentId;
              return (
                <button
                  key={song.id}
                  className={`homeListenRow ${active ? "active" : ""} ${active && isPlaying ? "playing" : ""}`}
                  type="button"
                  onClick={() => void selectSong(song.id, true)}
                  onContextMenu={(event) => void actions.openSongMenu(event, song)}
                  title={`play ${song.title}`}
                >
                  <Cover song={song} className="homeListenCover" preferThumbnail />
                  <span className="homeListenCopy">
                    <strong>{song.title || prettyTitle(song.title, 6)}</strong>
                    <small>{prettyMeta(song.artist)}</small>
                  </span>
                  <span className="homeListenPlay" aria-hidden="true">{active && isPlaying ? <AudioLines size={16} /> : <Play size={14} fill="currentColor" />}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="homeEmptyState">
            <MascotStateArt state="empty" className="homeEmptyMascot" />
            <div><strong>your home is quiet</strong><span>{needsPhoneSync ? "Sync your computer's library to listen here, even offline." : "import music and Localtify will build this page for you."}</span></div>
          </div>
        )}
      </section>
    ),
    mostListened: <HomeSongRail id="most-listened" title="Most listened of all time" songs={mostPlayedSongs} currentId={currentId} selectSong={selectSong} playSongs={playSongs} />,
    dailyMixes: <HomeDailyMixRail day={day} songsById={songsById} openDailyMixes={openDailyMixes} openAnalysisSettings={openAnalysisSettings} />,
    recentlyPlayed: <HomeSongRail id="recently-played" title="Recently played" songs={recentlyPlayedSongs} currentId={currentId} selectSong={selectSong} playSongs={playSongs} emptyText={android ? undefined : "Songs you play will show up here."} findSimilar={() => props.openSimilarSongs({ kind: "recent" })} />,
    newReleases: <HomeSongRail id="releases" title="Recently added" songs={recentlyAddedSongs} currentId={currentId} selectSong={selectSong} />,
    likedSongs: <HomeSongRail id="liked" title="Liked songs" songs={likedSongs} currentId={currentId} selectSong={selectSong} playSongs={playSongs} emptyText="Tap the heart on a song to keep it here." />,
    rediscover: <HomeSongRail id="rediscover" title="Rediscover" songs={rediscoverSongs} currentId={currentId} selectSong={selectSong} playSongs={playSongs} emptyText="Songs you played a lot but not in the last month will come back here." />,
    notPlayedYet: <HomeSongRail id="not-played" title="Not played yet" songs={notPlayedSongs} currentId={currentId} selectSong={selectSong} playSongs={playSongs} emptyText={playableSongCount === 0 ? "Add playable music to your library first." : "You have played every available song in your library."} />
  };

  return (
    <div className="homePage" style={ambientStyle}>
      <header className="homeTopBar">
        <h1>Home</h1>
        <button
          className={`homeCustomizeButton ${customizeOpen ? "active" : ""}`}
          type="button"
          onClick={() => setCustomizeOpen((open) => !open)}
          aria-label="Customize Home"
          title="Customize Home"
          aria-expanded={customizeOpen}
          aria-controls="home-customize-panel"
        >
          <SlidersHorizontal size={19} strokeWidth={1.9} aria-hidden="true" />
        </button>
        {customizeOpen ? (
          <Suspense fallback={null}>
          <HomeCustomizePanel
            sectionOrder={settings.homeSectionOrder}
            hiddenSections={settings.homeHiddenSections}
            updateHomeLayout={updateHomeLayout}
            openCovers={android ? undefined : openCoversViewWithCurrentSong}
            onClose={closeCustomize}
          />
          </Suspense>
        ) : null}
      </header>

      {needsPhoneSync ? sections.jumpBack : visibleSections.length ? visibleSections.map((id) => <Fragment key={id}>{sections[id]}</Fragment>) : (
        <div className="homeEmptyState homeAllHidden">
          <div><strong>every section is hidden</strong><span>use Customize Home to bring some back.</span></div>
        </div>
      )}

    </div>
  );
}


