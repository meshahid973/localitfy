import { lazy, Suspense } from "react";
import { AnimatePresence, motion as Motion } from "motion/react";
import type { CSSProperties } from "react";
import { FolderPlus } from "lucide-react";
import UpdateIsland from "../../app/UpdateIsland";
import TitleBar from "./TitleBar";
import HomeView from "../home/HomeView";
import { Cover } from "../covers/Cover";
import PlayerBar from "../player/components/PlayerBar";
import QueuePanel from "../player/components/QueuePanel";
import PlaybackAudioElement from "../player/components/PlaybackAudioElement";
import Onboarding from "../../Onboarding";
import SongContextMenu from "../library/components/SongContextMenu";
import { MascotStateArt, UpdateStatusIcon, WindowCloseIcon } from "../../shared/ui/LocaltifyViewUi";
import type { MascotStateKey } from "../../shared/ui/LocaltifyViewUi";
import WhatsNewModal from "../updates/WhatsNewModal";
import { clamp } from "../../shared/utils/format";
import { prettyTitle } from "../search";
import type { AppShellProps } from "./appShell.contract";
import SidebarNav from "./SidebarNav";
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
const LyricsView = lazy(() => import("../lyrics/LyricsView"));
const LibraryView = lazy(() => import("../library/LibraryView"));
const ArtistsView = lazy(() => import("../artists/ArtistsView"));
const GenresView = lazy(() => import("../genres/GenresView"));
const AlbumsView = lazy(() => import("../albums/AlbumsView"));
const PlaylistsView = lazy(() => import("../playlists/PlaylistsView"));
const CoversView = lazy(() => import("../covers/CoversView"));
const AnalyticsView = lazy(() => import("../analytics/AnalyticsView"));
const SettingsView = lazy(() => import("../settings/SettingsView"));
const DownloadsView = lazy(() => import("../downloads/DownloadsView"));
const SongEditorModal = lazy(() => import("../library/components/SongEditorModal"));
const DeleteSongModal = lazy(() => import("../library/components/DeleteSongModal"));
const PlaylistPickerModal = lazy(() => import("../playlists/components/PlaylistPickerModal"));

export type { AppShellProps } from "./appShell.contract";

export default function AppShell(props: AppShellProps) {
  const {
    frame, updates, screensaver, effects, onboarding, navigation,
    home, library, artists, genres, albums, playlists, covers, analytics, settingsView, downloads,
    playerBar, modals, playbackAudio
  } = props;

  const {
    appRootRef, settings, platformInfo, themeMotionReady, showTopUpdateRibbon, isViewSwitching,
    heroMotion, heroMotionAppClass, homeEntranceSettledClass, isAppBackgrounded, scrollBusyRef,
    themeSettling, themePresetStyle, animatedThemeVisualStyle, customThemeStyle, effectiveTheme,
    effectiveAmbient, effectiveCoverColorSyncMode, effectiveNotes, statusText, draggedSongTitle,
    showStarBackdrop
  } = frame;
  const { updatePrompt, askUpdaterToDownload, askUpdaterToInstall, manualUpdateCheck, setUpdatePrompt } = updates;
  const {
    previewActive: screensaverPreviewActive, visible: screensaverVisible,
    dismissFromActivity: dismissScreensaverFromActivity, setVisible: setScreensaverVisible,
    visualSource: screensaverVisualSource
  } = screensaver;
  const {
    secretMode, secretBurst, secretToast, starParticleStyles, appToast, importAnimation
  } = effects;
  const { open: onboardingOpen, ...onboardingProps } = onboarding;
  const {
    effectiveSimpleMode, simpleModeView, view, changeView, importSongs, startSidebarResize,
    contentRef, updateSidebarLayout, openSidebarSettings
  } = navigation;
  const { isSeeking, isVolumeDragging, draggedSongId, isPlaying } = playerBar;
  const { isThreeAm } = home;

  const homeHeroCoverBrightness = clamp(Number(settings.homeHeroCoverBrightness ?? 1), 0.65, 1.55);
  const homeHeroCoverContrast = clamp(1.02 + (homeHeroCoverBrightness - 1) * 0.08, 0.98, 1.08);
  const homeHeroCoverSaturation = clamp(1.04 + (homeHeroCoverBrightness - 1) * 0.14, 1, 1.14);
  const homeHeroCoverGlowBrightness = clamp(0.72 + (homeHeroCoverBrightness - 1) * 0.34, 0.62, 0.92);
  const platformId = String(platformInfo.id || "unknown").toLowerCase();
  const mascotDebugMode =
    typeof window !== "undefined" &&
    window.localStorage.getItem("localtify:mascotDebug") === "1";


  return (
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
          ...themePresetStyle,
          ...animatedThemeVisualStyle,
          ...customThemeStyle
        } as CSSProperties
      }
      data-platform={platformId}
      data-linux={platformId === "linux" ? "on" : "off"}
      data-theme={effectiveTheme}
      data-anime-visuals={settings.animeVisuals || screensaverPreviewActive || screensaverVisible ? "on" : "off"}
      data-gif-visuals={settings.gifVisualsMode}
      data-custom-theme={settings.customThemeEnabled ? "true" : "false"}
      data-corners={settings.softCorners ? "soft" : "sharp"}
      data-ambient={effectiveAmbient ? "on" : "off"}
      data-cover-sync={effectiveCoverColorSyncMode}
      data-notes={effectiveNotes ? "on" : "off"}
      data-badge={settings.showHeroBadge ? "on" : "off"}
      data-home-banner={settings.homeBannerType || "dynamic"}
      data-blur-effects="normal"
      data-card-background={settings.mediaCardBackground || "glassy"}
      data-home-layout={settings.homeLayoutMode || "balanced"}
      data-library-row-style={settings.libraryRowStyle || "comfyRows"}
      data-stars-intensity={settings.starsIntensity || "off"}
      data-sidebar-behavior={settings.sidebarBehavior || "fixed"}
      data-player-background={settings.playerBackgroundStyle || "coverBlur"}
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
      {showStarBackdrop ? (
        <div className="localtifyStarsBackdrop" aria-hidden="true">
          <div className="localtifyStarsLayer localtifyStarsLayerA" />
          <div className="localtifyStarsLayer localtifyStarsLayerB" />
          <div className="localtifyStarsLayer localtifyStarsLayerC" />
        </div>
      ) : null}

      <TitleBar showWindowButtons={platformId !== "mac"}>
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
          {secretMode === "stars"
            ? starParticleStyles.map((style, index) => (
                <span
                  key={`star-${index}`}
                  className={index % 5 === 0 ? "secretParticle starParticle starParticleLarge" : "secretParticle starParticle"}
                  style={style}
                />
              ))
            : null}
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

      {effectiveSimpleMode ? (
        simpleModeView
      ) : (
        <div className="appShell">
          <aside className="sidebar">
            <SidebarNav
              view={view}
              changeView={changeView}
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
          </aside>

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
              {view === "home" ? <HomeView {...home} /> : null}

              <Suspense fallback={null}>
                {(view === "library" || view === "liked") ? <LibraryView {...library} /> : null}
                {view === "artists" ? <ArtistsView {...artists} /> : null}
                {view === "genres" ? <GenresView {...genres} /> : null}
                {view === "albums" ? <AlbumsView {...albums} /> : null}
                {view === "playlists" ? <PlaylistsView {...playlists} /> : null}
                {view === "covers" ? <CoversView {...covers} /> : null}
                {view === "analytics" ? <AnalyticsView {...analytics} /> : null}
                {view === "settings" ? <SettingsView {...settingsView} /> : null}
                {view === "downloads" ? <DownloadsView {...downloads} /> : null}
              </Suspense>
            </div>
          </section>

<PlayerBar {...playerBar} />
          <QueuePanel {...modals.queuePanel} />
          {modals.lyrics.open ? <Suspense fallback={null}><LyricsView {...modals.lyrics} anchorRef={contentRef} /></Suspense> : null}
        </div>
      )}

      <SongContextMenu {...modals.songContextMenu} />
      {modals.similarSongs.seed ? <Suspense fallback={null}><SimilarSongsDialog key={modals.similarSongs.seed.id} {...modals.similarSongs} /></Suspense> : null}

      <WhatsNewModal {...modals.whatsNew} />

      {modals.songEditor.song ? <Suspense fallback={null}><SongEditorModal {...modals.songEditor} /></Suspense> : null}

      {modals.playlistPicker.song ? <Suspense fallback={null}><PlaylistPickerModal {...modals.playlistPicker} /></Suspense> : null}

      {modals.deleteSong.song ? <Suspense fallback={null}><DeleteSongModal {...modals.deleteSong} /></Suspense> : null}

      <PlaybackAudioElement {...playbackAudio} />
    </main>
  );
}
