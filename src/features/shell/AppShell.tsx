import { lazy, Suspense, useState } from "react";
import { AnimatePresence, motion as Motion } from "motion/react";
import type { CSSProperties } from "react";
import { FolderPlus } from "lucide-react";
import UpdateIsland from "../../app/UpdateIsland";
import TitleBar from "./TitleBar";
import HomeView from "../home/HomeView";
import { Cover } from "../covers/Cover";
import { ArtworkAmbientContext } from "../covers/ArtworkBackdrop";
import { useWorkspaceCoverColor } from "../covers/cover.ambient";
import PlayerSurfaces from "../player/components/PlayerSurfaces";
import PlaybackAudioElement from "../player/components/PlaybackAudioElement";
import Onboarding from "../../Onboarding";
import SongContextMenu from "../library/components/SongContextMenu";
import CollectionContextMenu from "../library/components/CollectionContextMenu";
import { AppActionsContext, playableIds } from "./appActions";
import { useCollectionActions } from "./useCollectionActions";
import { CollectionLoading } from "../../shared/ui/CollectionLoading";
import { PageErrorBoundary } from "./PageErrorBoundary";
import { MascotStateArt, UpdateStatusIcon, WindowCloseIcon } from "../../shared/ui/LocaltifyViewUi";
import type { MascotStateKey } from "../../shared/ui/LocaltifyViewUi";
import WhatsNewModal from "../updates/WhatsNewModal";
import { clamp } from "../../shared/utils/format";
import { prettyTitle } from "../search";
import type { AppShellProps } from "./appShell.contract";
import type { Song } from "../library/song.types";
import { useDownloadTagPrompt } from "../tagging/useDownloadTagPrompt";
import SidebarNav from "./SidebarNav";
import { isAndroidApp } from "../../app/platform";
import {
  APP_VERSION, defaultUpdatePrompt, updateRibbonChildSpring, updateRibbonEnterSpring
} from "../updates/update.constants";
import { updateRibbonTitle } from "../updates/update.utils";
import { yukariUpdateImage } from "../../core/app.constants";
import "./app-core.css";
import "./motion.css";
import "./effects.css";
import "../../styles/view-shell.css";

const SimilarSongsDialog = lazy(() => import("../analysis/SimilarSongsDialog"));
const PhoneTabBar = lazy(() => import("./PhoneTabBar"));
const LibraryView = lazy(() => import("../library/LibraryView"));
const ArtistsView = lazy(() => import("../artists/ArtistsView"));
const GenresView = lazy(() => import("../genres/GenresView"));
const ArtistPage = lazy(() => import("../pages/SongGroupPage").then((module) => ({ default: module.ArtistPage })));
const GenrePage = lazy(() => import("../pages/SongGroupPage").then((module) => ({ default: module.GenrePage })));
const MixPage = lazy(() => import("../pages/MixPage"));
const PlaylistsView = lazy(() => import("../playlists/PlaylistsView"));
const CoversView = lazy(() => import("../covers/CoversView"));
const AnalyticsView = lazy(() => import("../analytics/AnalyticsView"));
const DiscoverView = lazy(() => import("../discover/DiscoverView"));
const SettingsView = lazy(() => import("../settings/SettingsView"));
const DownloadsView = lazy(() => import("../downloads/DownloadsView"));
const SongEditorModal = lazy(() => import("../library/components/SongEditorModal"));
const DeleteSongModal = lazy(() => import("../library/components/DeleteSongModal"));
const PlaylistPickerModal = lazy(() => import("../playlists/components/PlaylistPickerModal"));
const TagSearchDialog = lazy(() => import("../tagging/TagSearchDialog"));
const DownloadTagDialog = lazy(() => import("../tagging/DownloadTagDialog"));

export type { AppShellProps } from "./appShell.contract";

export default function AppShell(props: AppShellProps) {
  const {
    frame, updates, screensaver, effects, onboarding, navigation,
    home, library, artists, genres, playlists, covers, analytics, discover, settingsView, downloads,
    playerBar, modals, playbackAudio, collections
  } = props;

  const {
    appRootRef, settings, platformInfo, themeMotionReady, showTopUpdateRibbon, isViewSwitching,
    heroMotion, heroMotionAppClass, homeEntranceSettledClass, isAppBackgrounded, scrollBusyRef,
    themeSettling, effectiveTheme,
    effectiveAmbient, effectiveCoverColorSyncMode, effectiveNotes, statusText, draggedSongTitle
  } = frame;
  const { updatePrompt, askUpdaterToDownload, askUpdaterToInstall, manualUpdateCheck, setUpdatePrompt } = updates;
  const {
    previewActive: screensaverPreviewActive, visible: screensaverVisible,
    dismissFromActivity: dismissScreensaverFromActivity, setVisible: setScreensaverVisible,
    visualSource: screensaverVisualSource
  } = screensaver;
  const {
    secretMode, secretBurst, secretToast, appToast, importAnimation
  } = effects;
  const { open: onboardingOpen, ...onboardingProps } = onboarding;
  const {
    view, importSongs, startSidebarResize,
    contentRef, updateSidebarLayout, openSidebarSettings, history: nav
  } = navigation;
  const detail = nav.detail;
  const { isSeeking, isVolumeDragging, draggedSongId, isPlaying } = playerBar;
  const { isThreeAm } = home;
  const playerBackground = effectiveTheme === "light" && settings.playerBackgroundStyle === "oledBlack" ? "flat" : settings.playerBackgroundStyle || "coverBlur";
  const homeBanner = effectiveTheme === "light" && settings.homeBannerType === "cleanBlack" ? "none" : settings.homeBannerType || "dynamic";
  const cardBackground = effectiveTheme === "light" && settings.mediaCardBackground === "oledFlat" ? "solid" : settings.mediaCardBackground || "glassy";
  const workspaceCoverColor = useWorkspaceCoverColor(home.ambientStyle, home.currentSong?.id, effectiveCoverColorSyncMode !== "off" && !isAppBackgrounded);
  const [tagSearchSong, setTagSearchSong] = useState<Song | null>(null);
  // When a download batch finishes, offer to tag the songs it added.
  const { actions, collectionMenu, closeCollectionMenu } = useCollectionActions(nav, collections, modals.queuePanel.openSongContextMenu);
  const pageProps = { songs: library.songs, currentId: home.currentId, isPlaying, toggleLike: modals.songContextMenu.toggleLike, openPlaylistPicker: modals.songContextMenu.openPlaylistPicker };
  const downloadTagPrompt = useDownloadTagPrompt(settings.musicbrainzTagging === true, Boolean(downloads.downloadBusy || downloads.spotifyDownloadBusy), downloads.spotifyTracks, downloads.visibleDownloadResults);

  function openSimilarSongs(songIds: string[], key: string, title: string) {
    collections.openSimilar({ kind: "songs", key, title, songIds });
  }

  const homeHeroCoverBrightness = clamp(Number(settings.homeHeroCoverBrightness ?? 1), 0.65, 1.55);
  const homeHeroCoverContrast = clamp(1.02 + (homeHeroCoverBrightness - 1) * 0.08, 0.98, 1.08);
  const homeHeroCoverSaturation = clamp(1.04 + (homeHeroCoverBrightness - 1) * 0.14, 1, 1.14);
  const homeHeroCoverGlowBrightness = clamp(0.72 + (homeHeroCoverBrightness - 1) * 0.34, 0.62, 0.92);
  const platformId = String(platformInfo.id || "unknown").toLowerCase();
  const mascotDebugMode =
    typeof window !== "undefined" &&
    window.localStorage.getItem("localtify:mascotDebug") === "1";


  return (
    <AppActionsContext.Provider value={actions}>
    <ArtworkAmbientContext.Provider value={effectiveAmbient && !isAppBackgrounded}>
    <main
      ref={appRootRef}
      className={`app ${settings.animatedGlow ? "animatedGlow" : ""} ${
        settings.compactPlayer ? "compactPlayer" : ""
      } ${settings.denseList ? "denseList" : ""} ${themeMotionReady ? "themeMotionReady" : "themeMotionBooting"} animatedBackgrounds ${settings.reducedMotion ? "reducedMotion" : ""} ${showTopUpdateRibbon ? "updateRibbonVisible" : ""} ${isViewSwitching ? "viewSwitching" : ""} ${heroMotionAppClass} ${homeEntranceSettledClass} ${isSeeking || isVolumeDragging ? "playerScrubbing" : ""} ${isAppBackgrounded ? "appBackgrounded" : ""} ${scrollBusyRef.current ? "isScrolling" : ""} ${themeSettling ? "themeSettling" : ""} ${draggedSongId ? "songDragActive" : ""} ${isPlaying ? "appAudioPlaying" : "appAudioIdle"} ${
        secretMode !== "none" ? `secretActive secret-${secretMode}` : ""
      }`}
      style={
        {
          "--player-size": `${clamp(Number(settings.playerSize || 108), 74, 168)}px`,
          "--sidebar-width": `${clamp(Number(settings.sidebarWidth || 249), 184, 340)}px`,
          "--home-hero-cover-brightness": String(homeHeroCoverBrightness),
          "--home-hero-cover-contrast": String(homeHeroCoverContrast),
          "--home-hero-cover-saturation": String(homeHeroCoverSaturation),
          "--home-hero-cover-glow-brightness": String(homeHeroCoverGlowBrightness),
          "--workspace-cover-color": workspaceCoverColor
        } as CSSProperties
      }
      data-platform={platformId}
      data-linux={platformId === "linux" ? "on" : "off"}
      data-theme={effectiveTheme}
      data-anime-visuals={settings.animeVisuals || screensaverPreviewActive || screensaverVisible ? "on" : "off"}
      data-gif-visuals={settings.gifVisualsMode}
      data-corners={settings.softCorners ? "soft" : "sharp"}
      data-ambient={effectiveAmbient ? "on" : "off"}
      data-cover-sync={effectiveCoverColorSyncMode}
      data-notes={effectiveNotes ? "on" : "off"}
      data-badge={settings.showHeroBadge ? "on" : "off"}
      data-home-banner={homeBanner}
      data-blur-effects="normal"
      data-card-background={cardBackground}
      data-home-layout={settings.homeLayoutMode || "balanced"}
      data-library-row-style={settings.libraryRowStyle || "comfyRows"}
      data-sidebar-behavior={settings.sidebarBehavior || "slim"}
      data-player-background={playerBackground}
      data-hero-expanded={settings.heroExpanded ? "on" : "off"}
      data-hero-motion={heroMotion}
      data-status={statusText}
      data-app-version={APP_VERSION}
      data-secret-mode={secretMode}
      data-late-night={isThreeAm ? "on" : "off"}
      data-playing={isPlaying ? "on" : "off"}
      data-app-backgrounded={isAppBackgrounded ? "on" : "off"}
      data-motion-level={settings.reducedMotion ? "reduced" : "smooth"}
      data-drag-title={draggedSongTitle}
    >

      <TitleBar showWindowButtons={platformId !== "mac"} history={nav}>
        <UpdateIsland
          show={showTopUpdateRibbon}
          updatePrompt={updatePrompt}
          appVersion={APP_VERSION}
          reducedMotion={settings.reducedMotion}
          yukariUpdateImage={yukariUpdateImage}
          enterSpring={updateRibbonEnterSpring}
          childSpring={updateRibbonChildSpring}
          titleForPrompt={updateRibbonTitle}
          StatusIcon={UpdateStatusIcon}
          CloseIcon={WindowCloseIcon}
          onDownload={askUpdaterToDownload}
          onInstall={askUpdaterToInstall}
          onCheckAgain={manualUpdateCheck}
          onDismiss={() => setUpdatePrompt(defaultUpdatePrompt)}
        />
      </TitleBar>

      <AnimatePresence>
        {screensaverVisible ? (
          <Motion.div
            className="screensaverOverlay"
            role="presentation"
            onPointerMove={dismissScreensaverFromActivity}
            onClick={() => setScreensaverVisible(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: settings.reducedMotion ? 0.12 : 0.45, ease: "easeOut" }}
          >
            <div className="screensaverBackdrop" style={{ backgroundImage: `url(${screensaverVisualSource})` }} />
            <div className="screensaverGlow" />
            <Motion.div
              className="screensaverPanel"
              initial={settings.reducedMotion ? false : { opacity: 0, y: 18, scale: 0.982 }}
              animate={settings.reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={settings.reducedMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.99 }}
              transition={settings.reducedMotion ? { duration: 0.12 } : { type: "spring", stiffness: 130, damping: 20, mass: 0.8 }}
              style={{ backgroundImage: `url(${screensaverVisualSource})` }}
            >
              <div className="screensaverShade" />
              <div className="screensaverIdleText">am waiting..</div>
            </Motion.div>
          </Motion.div>
        ) : null}
      </AnimatePresence>

      {secretMode !== "none" ? (
        <div className={`secretLayer ${secretMode}`} key={`${secretMode}-${secretBurst}`} aria-hidden="true">
          {secretToast ? <div className="secretRibbon">{secretToast}</div> : null}
          {secretMode === "yukari" ? <img className="yukariSecretPeek" src={yukariUpdateImage} alt="" width={260} height={260} loading="lazy" decoding="async" fetchPriority="low" draggable={false} aria-hidden="true" /> : null}
        </div>
      ) : null}

      {appToast ? <div className="appToast error" key={appToast.id} role="alert">{appToast.message}</div> : null}

      {importAnimation.active ? (
        <div className={`importOverlay importPhase-${importAnimation.phase}`} role="status" aria-live="polite">
          <div className="importPanel">
            <div className="importScanStage" aria-hidden="true">
              <span className="importScannerLine" />
              <span className="importScannerGlow" />
              <span className="importScannerOrb" />
            </div>

            <div className="importPanelHead importPanelHeadMascotV496">
              <MascotStateArt
                state={importAnimation.phase === "success" ? "happy" : importAnimation.phase === "error" ? "error" : "loading"}
                className="importMascotV496"
              />
              <p className="eyebrow">local import</p>
              <h3>{importAnimation.phase === "success" ? importAnimation.message : "scanning your music"}</h3>
              <span>{importAnimation.phase === "error" ? "safe rollback" : importAnimation.message}</span>
            </div>

            <div className="importCounter">
              <strong>{importAnimation.count}</strong>
              <span>{importAnimation.count === 1 ? "song found" : "songs found"}</span>
            </div>

            <div className="importCoverGrid">
              {(importAnimation.preview.length ? importAnimation.preview : Array.from({ length: 10 }, () => null)).map((song, index) => (
                <div
                  className={song ? "importCoverTile" : "importCoverTile importCoverPlaceholder"}
                  key={song ? `${song.id}-${index}` : `import-placeholder-${index}`}
                  style={{ "--tile-delay": `${index * 42}ms` } as CSSProperties}
                >
                  {song ? <Cover song={song} className="importCoverArt" /> : <span className="importCoverSkeleton" />}
                  <small>{song ? prettyTitle(song.title, 4) : "scanning..."}</small>
                </div>
              ))}
            </div>

            <div className="importLogList" aria-hidden="true">
              {(importAnimation.preview.length
                ? importAnimation.preview.slice(0, 5).map((song) => prettyTitle(song.title, 5))
                : ["opening file picker", "reading audio tags", "matching cover art", "building search index", "saving library order"]
              ).map((line, index) => (
                <span key={`${line}-${index}`} style={{ "--log-delay": `${index * 70}ms` } as CSSProperties}>
                  {line}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {onboardingOpen ? (
        <Suspense fallback={null}>
          <Onboarding appVersion={APP_VERSION} {...onboardingProps} />
        </Suspense>
      ) : null}

      <div className="appShell">
          {isAndroidApp() ? (
            <Suspense fallback={null}>
              <PhoneTabBar view={view} changeView={nav.go} sidebarNavOrder={settings.sidebarNavOrder}
                sidebarHiddenNav={settings.sidebarHiddenNav} openSidebarSettings={openSidebarSettings} />
            </Suspense>
          ) : <aside className="sidebar">
            <SidebarNav
              view={view}
              changeView={nav.go}
              sidebarNavOrder={settings.sidebarNavOrder}
              sidebarHiddenNav={settings.sidebarHiddenNav}
              updateSidebarLayout={updateSidebarLayout}
              openSidebarSettings={openSidebarSettings}
            />

            <div className="sidebarBottom">
              <button className="mainAction importMainAction iconTextButton" onClick={importSongs} aria-label="Import music">
                <FolderPlus className="buttonInlineIcon" size={17} strokeWidth={2.1} aria-hidden="true" />
                <span className="buttonLabel">import music</span>
              </button>
            </div>

            <button
              className="sidebarResizeHandle"
              type="button"
              aria-label="resize sidebar"
              title="drag to resize sidebar"
              onPointerDown={startSidebarResize}
            >
              <span />
            </button>
          </aside>}

          <section className="content" ref={contentRef}>
            {mascotDebugMode ? (
              <section className="mascotDebugPanelV498" aria-label="Mascot state debug gallery">
                <div className="panelHead mascotDebugHeadV498">
                  <div>
                    <p className="eyebrow">mascot debug</p>
                    <h3>all mascot states</h3>
                  </div>
                  <button
                    className="softButton"
                    type="button"
                    onClick={() => {
                      window.localStorage.removeItem("localtify:mascotDebug");
                      window.location.reload();
                    }}
                  >
                    hide
                  </button>
                </div>

                <div className="mascotDebugGridV498">
                  {(["empty", "happy", "question", "info", "warning", "danger", "error", "loading"] as MascotStateKey[]).map((state) => (
                    <div className="mascotDebugCardV498" key={state}>
                      <MascotStateArt state={state} />
                      <strong>{state}</strong>
                      <small>{state}-state.png</small>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <div
              className={`pageTransition pageTransition-${view}`}
              data-view={view}
            >
              <PageErrorBoundary key={view + ":" + (detail?.id ?? "")}>
              {view === "home" ? <HomeView {...home} artworkAmbient={effectiveAmbient && !isAppBackgrounded} bannerType={homeBanner} /> : null}

              <Suspense fallback={<CollectionLoading label="Loading page…" />}>
                {(view === "library" || view === "liked") ? <LibraryView {...library} /> : null}
                {view === "artists" ? (detail?.kind === "artist"
                  ? <ArtistPage key={detail.id} id={detail.id} {...pageProps} openSimilar={openSimilarSongs} />
                  : <ArtistsView {...artists} />) : null}
                {view === "genres" ? (detail?.kind === "genre"
                  ? <GenrePage key={detail.id} id={detail.id} {...pageProps} openSimilar={openSimilarSongs} />
                  : <GenresView {...genres} />) : null}
                {view === "playlists" ? (detail?.kind === "mix"
                  ? <MixPage key={detail.id} mixId={detail.id} {...pageProps} savePlaylist={playlists.dailyMixes.savePlaylist} />
                  : <PlaylistsView {...playlists} detailPlaylistId={detail?.kind === "playlist" ? detail.id : null} />) : null}
                {view === "covers" ? <CoversView {...covers} /> : null}
                {view === "analytics" ? <AnalyticsView {...analytics} /> : null}
                {view === "discover" ? <DiscoverView {...discover} /> : null}
                {view === "settings" ? <SettingsView {...settingsView} /> : null}
                {view === "downloads" ? <DownloadsView {...downloads} /> : null}
              </Suspense>
              </PageErrorBoundary>
            </div>
          </section>

          <PlayerSurfaces player={playerBar} queue={modals.queuePanel} lyrics={modals.lyrics}
            contentRef={contentRef} backgroundStyle={playerBackground} backgrounded={isAppBackgrounded} />
      </div>

      <SongContextMenu {...modals.songContextMenu} findOnMusicBrainz={settings.musicbrainzTagging ? setTagSearchSong : undefined} />
      <CollectionContextMenu state={collectionMenu} onClose={closeCollectionMenu} open={actions.openCollection} play={actions.playCollection} queue={actions.queueCollection}
        findSimilar={(target) => target.playlist
          ? collections.openSimilar({ kind: "playlist", playlistId: target.playlist.id })
          : openSimilarSongs(playableIds(target.songs), `${target.kind}:${target.id}`, target.title)} />
      {tagSearchSong ? <Suspense fallback={null}><TagSearchDialog key={tagSearchSong.id} song={tagSearchSong} onClose={() => setTagSearchSong(null)} /></Suspense> : null}
      {downloadTagPrompt.songIds.length ? <Suspense fallback={null}><DownloadTagDialog songIds={downloadTagPrompt.songIds}
        titleOf={(id) => modals.songContextMenu.songsById.get(id)?.title || "Unknown song"} onClose={downloadTagPrompt.dismiss} /></Suspense> : null}
      {modals.similarSongs.seed ? <Suspense fallback={null}><SimilarSongsDialog key={modals.similarSongs.seed.key} {...modals.similarSongs} /></Suspense> : null}

      <WhatsNewModal {...modals.whatsNew} />

      {modals.songEditor.song ? <Suspense fallback={null}><SongEditorModal {...modals.songEditor} /></Suspense> : null}

      {modals.playlistPicker.song ? <Suspense fallback={null}><PlaylistPickerModal {...modals.playlistPicker} /></Suspense> : null}

      {modals.deleteSong.song ? <Suspense fallback={null}><DeleteSongModal {...modals.deleteSong} /></Suspense> : null}

      <PlaybackAudioElement {...playbackAudio} />
    </main>
    </ArtworkAmbientContext.Provider>
    </AppActionsContext.Provider>
  );
}
