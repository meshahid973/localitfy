import "./home.css";
import { Fragment, lazy, Suspense, useCallback, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Maximize2, Minimize2, Play, Shuffle, SlidersHorizontal } from "lucide-react";
import { Cover } from "../covers/Cover";
import { MascotStateArt } from "../../shared/ui/LocaltifyViewUi";
import { prettyMeta, prettyTitle } from "../search/search.utils";
import type { Song } from "../library/song.types";
import type { LocalAlbumEntry } from "../albums/album.types";
import type { Settings } from "../settings/settings.types";
const HomeCustomizePanel = lazy(() => import("./HomeCustomizePanel"));
import { visibleHomeSections, type HomeLayoutPatch, type HomeSectionId } from "./homeLayout";
import { HomeAlbumRail, HomeDailyMixRail, HomeSongRail } from "./HomeShelves";
import { pickLikedSongs, pickNewAlbums, pickNotPlayedYet, pickRecentlyPlayed, pickRediscover } from "./homeShelfPicks";

export type HomeViewProps = {
  albums: readonly LocalAlbumEntry[];
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
  openAlbum: (albumId: string) => unknown;
  openAnalysisSettings: () => unknown;
  openCoversViewWithCurrentSong: () => unknown;
  openDailyMixes: () => unknown;
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
    albums,
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
    openAlbum,
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

  const [customizeOpen, setCustomizeOpen] = useState(false);
  const closeCustomize = useCallback(() => setCustomizeOpen(false), []);

  const listenNowSongs = homeListenNowSongs.slice(0, 8);
  const newReleaseSongs = (homeFreshShelfSongs.length ? homeFreshShelfSongs : homeListenNowSongs).slice(0, 10);
  const visibleSections = visibleHomeSections(settings.homeSectionOrder, settings.homeHiddenSections);
  const showing = (id: HomeSectionId) => visibleSections.includes(id);
  const showMostListened = showing("mostListened");
  const mostListenedSongs = useMemo(() => {
    if (!showMostListened) return [];
    const artistKeys = new Set<string>();
    const result: Song[] = [];
    for (const shelf of [homeListenNowSongs, homeFreshShelfSongs]) {
      for (const song of shelf) {
        const key = String(song.artist || "unknown artist").trim().toLowerCase() || "unknown artist";
        if (artistKeys.has(key)) continue;
        artistKeys.add(key);
        result.push(song);
        if (result.length === 10) return result;
      }
    }
    return result;
  }, [homeListenNowSongs, homeFreshShelfSongs, showMostListened]);

  // Only work out the shelves that are on screen; a hidden shelf costs nothing.
  const showRecent = showing("recentlyPlayed"), showAlbums = showing("newAlbums"), showLiked = showing("likedSongs");
  const showRediscover = showing("rediscover"), showUnplayed = showing("notPlayedYet"), showMixes = showing("dailyMixes");
  const recentlyPlayedSongs = useMemo(() => (showRecent ? pickRecentlyPlayed(songs) : []), [showRecent, songs]);
  const newAlbums = useMemo(() => (showAlbums ? pickNewAlbums(albums) : []), [showAlbums, albums]);
  const likedSongs = useMemo(() => (showLiked ? pickLikedSongs(songs) : []), [showLiked, songs]);
  const rediscoverSongs = useMemo(() => (showRediscover ? pickRediscover(songs, new Date()) : []), [showRediscover, songs]);
  const notPlayedSongs = useMemo(() => (showUnplayed ? pickNotPlayedYet(songs, new Date()) : []), [showUnplayed, songs]);
  const songsById = useMemo(() => (showMixes ? new Map(songs.map((song) => [song.id, song])) : new Map<string, Song>()), [showMixes, songs]);

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

  const sections: Record<HomeSectionId, ReactNode> = {
    jumpBack: (
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
    ),
    listenNow: (
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
    ),
    mostListened: mostListenedSongs.length ? (
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
    ) : null,
    dailyMixes: <HomeDailyMixRail songsById={songsById} playSongs={playSongs} openDailyMixes={openDailyMixes} openAnalysisSettings={openAnalysisSettings} />,
    recentlyPlayed: <HomeSongRail id="recently-played" title="Recently played" songs={recentlyPlayedSongs} currentId={currentId} selectSong={selectSong} playSongs={playSongs} emptyText="Songs you play will show up here." />,
    newAlbums: <HomeAlbumRail albums={newAlbums} openAlbum={openAlbum} />,
    newReleases: <HomeSongRail id="releases" title="New Releases" songs={newReleaseSongs} currentId={currentId} selectSong={selectSong} />,
    likedSongs: <HomeSongRail id="liked" title="Liked songs" songs={likedSongs} currentId={currentId} selectSong={selectSong} playSongs={playSongs} emptyText="Tap the heart on a song to keep it here." />,
    rediscover: <HomeSongRail id="rediscover" title="Rediscover" songs={rediscoverSongs} currentId={currentId} selectSong={selectSong} playSongs={playSongs} emptyText="Songs you played a lot but not in the last month will come back here." />,
    notPlayedYet: <HomeSongRail id="not-played" title="Not played yet" songs={notPlayedSongs} currentId={currentId} selectSong={selectSong} playSongs={playSongs} emptyText="You have played every song in your library." />
  };

  return (
    <div className="homePage" style={homeStyle}>
      <header className="homeTopBar">
        <h1>Home</h1>
        <button
          className={`homeCustomizeButton ${customizeOpen ? "active" : ""}`}
          type="button"
          onClick={() => setCustomizeOpen((open) => !open)}
          aria-expanded={customizeOpen}
          aria-controls="home-customize-panel"
        >
          <SlidersHorizontal size={13} strokeWidth={2.1} aria-hidden="true" />
          <span>Customize Home</span>
        </button>
        {customizeOpen ? (
          <Suspense fallback={null}>
          <HomeCustomizePanel
            sectionOrder={settings.homeSectionOrder}
            hiddenSections={settings.homeHiddenSections}
            updateHomeLayout={updateHomeLayout}
            openCovers={openCoversViewWithCurrentSong}
            onClose={closeCustomize}
          />
          </Suspense>
        ) : null}
      </header>

      {visibleSections.length ? visibleSections.map((id) => <Fragment key={id}>{sections[id]}</Fragment>) : (
        <div className="homeEmptyState homeAllHidden">
          <div><strong>every section is hidden</strong><span>use Customize Home to bring some back.</span></div>
        </div>
      )}

      <span className="homeNowPlayingLabel" aria-hidden="true">{currentNowPlayingLabel}</span>
    </div>
  );
}


