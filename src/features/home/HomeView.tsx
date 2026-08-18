import type { CSSProperties } from "react";
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
  filteredSongs: any;
  heroDisplayArtist: any;
  heroDisplayTitle: any;
  heroMotionClass: any;
  heroTitleClass: any;
  homeDashboardClass: any;
  homeFreshShelfSongs: any;
  homeListenNowSongs: any;
  isPlaying: any;
  isThreeAm: any;
  likedSongs: any;
  mostPlayed: any;
  now: any;
  nowPlayingSongMotionClass: any;
  nowPlayingTransitionKey: any;
  openCoversViewWithCurrentSong: any;
  playableSongCount: any;
  playerError: any;
  renderHomeSongCards: any;
  renderSongRows: any;
  selectSong: any;
  settings: any;
  showHomeSideCards: any;
  shuffleLibrarySongsAction: any;
  songs: any;
  toggleHeroExpanded: any;
  topSongs: any;
  totalMinutes: any;
  totalPlays: any;
  updateSetting: any;
};

export default function HomeView(props: HomeViewProps) {
  const {
    ambientStyle,
    currentId,
    currentNowPlayingLabel,
    currentSong,
    filteredSongs,
    heroDisplayArtist,
    heroDisplayTitle,
    heroMotionClass,
    heroTitleClass,
    homeDashboardClass,
    homeFreshShelfSongs,
    homeListenNowSongs,
    isPlaying,
    isThreeAm,
    likedSongs,
    mostPlayed,
    nowPlayingSongMotionClass,
    nowPlayingTransitionKey,
    openCoversViewWithCurrentSong,
    playableSongCount,
    playerError,
    renderHomeSongCards,
    renderSongRows,
    selectSong,
    settings,
    showHomeSideCards,
    shuffleLibrarySongsAction,
    songs,
    toggleHeroExpanded,
    topSongs,
    totalMinutes,
    totalPlays,
    updateSetting
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
                    <p className={`eyebrow nowPlayingEyebrowSwap ${nowPlayingSongMotionClass}`} title={currentNowPlayingLabel}>{currentNowPlayingLabel}</p>

                    <h3 className={`heroTitle nowPlayingTitleSwap ${nowPlayingSongMotionClass}`} title={currentSong ? currentSong.title : "drop in your music"}>
                      {heroDisplayTitle}
                    </h3>
                    <p className={`heroArtistLine nowPlayingArtistSwap ${nowPlayingSongMotionClass}`} title={currentSong ? currentSong.artist || "unknown artist" : "import songs to start listening"}>
                      {heroDisplayArtist}
                    </p>

                    {playerError ? <div className="warningBox">{playerError}</div> : null}
                    {isThreeAm && settings.volume > 0.8 ? (
                      <div className="warningBox lateNightWarning">volume is above 80% � late night ears deserve mercy.</div>
                    ) : null}
                    <div className="heroQuickActions">
                      <button
                        className="heroTinyButton"
                        type="button"
                        onClick={toggleHeroExpanded}
                        aria-pressed={settings.heroExpanded}
                        title={settings.heroExpanded ? "shrink the now playing banner" : "expand the now playing banner"}
                      >
                        {settings.heroExpanded ? "compact player" : "expand player"}
                      </button>

                      <button
                        className="heroTinyButton"
                        type="button"
                        onClick={openCoversViewWithCurrentSong}
                        title="open pixel cover gallery"
                      >
                        covers
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
                        homeListenNowSongs.map((song, index) => {
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
                              style={{
                                "--card-delay": `${index * 48}ms`,
                                ...listenAmbienceStyle
                              } as CSSProperties}
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
                        homeFreshShelfSongs.map((song, index) => (
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

                <section className={homeDashboardClass}>
                  <section className={`panel largePanel homeLibraryPanel ${settings.homeExpanded ? "homeLibraryExpanded" : "homeLibraryCompact"}`}>
                    <div className="panelHead">
                      <div>
                        <p className="eyebrow">library</p>
                        <h3>quick library</h3>
                      </div>
                      <div className="homeLibraryActions">
                        <span>{songs.length} song{songs.length === 1 ? "" : "s"}</span>
                        <button
                          className="expandLibraryButton"
                          type="button"
                          onClick={() => updateSetting("homeExpanded", !settings.homeExpanded)}
                          aria-pressed={settings.homeExpanded}
                          title={settings.homeExpanded ? "compact quick library" : "expand quick library"}
                        >
                          {settings.homeExpanded ? "compact" : "expand"}
                        </button>
                      </div>
                    </div>

                    {settings.homeExpanded
                      ? renderHomeSongCards(filteredSongs, "homeAlbumGrid")
                      : renderSongRows(filteredSongs, "songList homeSongList")}
                  </section>

                  {showHomeSideCards ? (
                    <aside className="stack">
                      <section className="panel">
                        <p className="eyebrow">analytics</p>
                        <h3>quick stats</h3>

                        <div className="statsGrid">
                          <div className="statCard">
                            <span>most played</span>
                            <strong>{mostPlayed ? prettyTitle(mostPlayed.title, 5) : "none yet"}</strong>
                          </div>

                          <div className="statRowSmall">
                            <div className="statCard">
                              <span>liked</span>
                              <strong>{likedSongs.length}</strong>
                            </div>

                            <div className="statCard">
                              <span>plays</span>
                              <strong>{totalPlays}</strong>
                            </div>
                          </div>

                          <div className="statCard">
                            <span>minutes listened</span>
                            <strong>{totalMinutes}</strong>
                          </div>

                          <div className="miniBars">
                            {(topSongs.length ? topSongs : songs.slice(0, 6)).map((song) => (
                              <div
                                key={song.id}
                                title={`${song.title}: ${song.playCount} plays`}
                                style={{
                                  height: `${Math.max(14, Math.min(100, song.playCount * 18 || 14))}%`
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      </section>

                      <section className="panel">
                        <div className="panelHead">
                          <div>
                            <p className="eyebrow">top songs</p>
                            <h3>little chart</h3>
                          </div>
                        </div>

                        <div className="topList">
                          {topSongs.length ? (
                            topSongs.map((song, index) => (
                              <button key={song.id} className="topRow" onClick={() => void selectSong(song.id, true)}>
                                <span>{index + 1}</span>
                                <strong>{prettyTitle(song.title, 5)}</strong>
                                <small>{song.playCount} plays</small>
                              </button>
                            ))
                          ) : (
                            <p className="softText">play some songs and your little chart appears here.</p>
                          )}
                        </div>
                      </section>
                    </aside>
                  ) : null}
                </section>
              </>
            
  );
}
