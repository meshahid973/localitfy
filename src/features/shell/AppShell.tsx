import { lazy, Suspense } from "react";
import { AnimatePresence, motion as Motion } from "motion/react";
import type { CSSProperties } from "react";
import { FolderPlus } from "lucide-react";
import UpdateIsland from "../../app/UpdateIsland";
import TitleBar from "./TitleBar";
import HomeView from "../home/HomeView";
import { Cover } from "../covers/Cover";
import SettingsModal from "../settings/SettingsModal";
import PlayerBar from "../player/components/PlayerBar";
import PlaybackAudioElement from "../player/components/PlaybackAudioElement";
import Onboarding from "../../Onboarding";
import SongContextMenu from "../library/components/SongContextMenu";
import SongEditorModal from "../library/components/SongEditorModal";
import DeleteSongModal from "../library/components/DeleteSongModal";
import { MascotStateArt, UpdateStatusIcon, WindowCloseIcon, mascotStateForToast } from "../../shared/ui/LocaltifyViewUi";
import type { MascotStateKey } from "../../shared/ui/LocaltifyViewUi";
import PlaylistPickerModal from "../playlists/components/PlaylistPickerModal";
import WhatsNewModal from "../updates/WhatsNewModal";
import { clamp } from "../../shared/utils/format";
import { prettyTitle } from "../search";
import type { AppShellProps } from "./appShell.contract";
import { navItems, sidebarNavGroups } from "./navigation.constants";
import {
  APP_VERSION, defaultUpdatePrompt, updateRibbonChildSpring, updateRibbonEnterSpring
} from "../updates/update.constants";
import { updateRibbonTitle } from "../updates/update.utils";
import { yukariUpdateImage } from "../../core/app.constants";
import "./app-core.css";
import "./motion.css";
import "./effects.css";
import "../../styles/view-shell.css";

const LibraryView = lazy(() => import("../library/LibraryView"));
const AlbumsView = lazy(() => import("../albums/AlbumsView"));
const PlaylistsView = lazy(() => import("../playlists/PlaylistsView"));
const CoversView = lazy(() => import("../covers/CoversView"));
const AnalyticsView = lazy(() => import("../analytics/AnalyticsView"));
const SettingsView = lazy(() => import("../settings/SettingsView"));
const DownloadsView = lazy(() => import("../downloads/DownloadsView"));

export type { AppShellProps } from "./appShell.contract";

export default function AppShell(props: AppShellProps) {
  const {
    frame, updates, screensaver, effects, onboarding, navigation,
    home, library, albums, playlists, covers, analytics, settingsView, downloads,
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
    secretMode, secretBurst, secretToast, starParticleStyles, appToast, importAnimation,
    libraryScanBusy, pixelArtBusy, libraryScanMessage
  } = effects;
  const { open: onboardingOpen, ...onboardingProps } = onboarding;
  const {
    effectiveSimpleMode, simpleModeView, view, changeView, importSongs, startSidebarResize,
    contentRef, headerHint, greeting, query, handleSearchInput
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

      <TitleBar>
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

      {appToast ? (
        <div className={`appToast ${appToast.kind} appToastMascotHostV496`} key={appToast.id} role="status">
          <MascotStateArt state={mascotStateForToast(appToast.kind)} className="appToastMascotV496" />
          <span className="appToastDot" />
          <strong>{appToast.message}</strong>
        </div>
      ) : null}

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

      {!importAnimation.active && (libraryScanBusy || pixelArtBusy) ? (
        <div className="tinyScanner tinyScannerMascotHostV496" role="status" aria-live="polite">
          <MascotStateArt state="loading" className="tinyScannerMascotV496" />
          <span className="scannerOrb" />
          <span>
            <strong>{pixelArtBusy ? "updating covers" : "scanning library"}</strong>
            <small>{pixelArtBusy ? "pixel art is being refreshed" : libraryScanMessage}</small>
          </span>
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
            <div className="sidebarNavGroupsV467" aria-label="localtify navigation groups">
              {sidebarNavGroups.map((group, groupIndex) => {
                const groupItems = group.itemIds
                  .map((itemId) => navItems.find((item) => item.id === itemId))
                  .filter(Boolean);

                return (
                  <div key={group.id} className={`sidebarNavGroupV467 sidebarNavGroup-${group.id}`}>
                    <p className="sidebarGroupLabelV467">{group.label}</p>

                    <nav
                      className={`nav navGroupedV467 ${group.id === "app" ? "navUtility" : "navMain"}`}
                      aria-label={`${group.label} navigation`}
                    >
                      {groupItems.map((item) => {
                        const Icon = item.icon;

                        return (
                          <button
                            key={item.id}
                            className={`navItem navItemAnimatedV468 nav-${item.id} ${view === item.id ? "active" : ""}`}
                            data-nav-id={item.id}
                            data-nav-group={group.id}
                            onClick={() => changeView(item.id, "nav")}
                            aria-label={`open ${item.label}`}
                          >
                            <span className="navDiscordPillV468" aria-hidden="true" />
                            <span className={`navIcon navIcon-${item.id}`} aria-hidden="true">
                              <span className="navIconMotionV468">
                                <Icon className="navLucideIcon" size={22} strokeWidth={2.75} fill="none" />
                              </span>
                            </span>
                            <span className="navText">
                              <strong>{item.label}</strong>
                              <small>{item.hint}</small>
                            </span>
                          </button>
                        );
                      })}
                    </nav>

                    {groupIndex < sidebarNavGroups.length - 1 ? <div className="navDivider" aria-hidden="true" /> : null}
                  </div>
                );
              })}
            </div>

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
            <header className="headerBar">
              <div className="headerText">
                {headerHint ? <p className="eyebrow">{headerHint}</p> : null}

                <h2>
                  {view === "home" && greeting}
                  {view === "library" && "your library"}
                  {view === "albums" && "albums"}
                  {view === "playlists" && "playlists"}
                  {view === "liked" && "liked songs"}
                  {view === "covers" && "pixel covers"}
                  {view === "analytics" && "listening analytics"}
                  {view === "downloads" && "downloads"}
                  {view === "settings" && "settings"}
                </h2>
              </div>

              <div className="headerTools compactHeaderTools">
                <div className="searchEasterWrap">
                  <input
                    className="search"
                    value={query}
                    onChange={(event) => {
                      const nextValue = event.currentTarget.value;
                      const command = nextValue.trim().toLowerCase();

                      if (command === "/feedback" || command === "feedback") {
                        event.currentTarget.value = "";
                        window.dispatchEvent(new CustomEvent("localtify:open-feedback"));
                        return;
                      }

                      handleSearchInput(nextValue);
                    }}
                    placeholder="search songs, try /feedback"
                  />
                </div>
              </div>
            </header>

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
        </div>
      )}

      <SettingsModal {...modals.settings} />

      <SongContextMenu {...modals.songContextMenu} />

      <WhatsNewModal {...modals.whatsNew} />

      <SongEditorModal {...modals.songEditor} />

      <PlaylistPickerModal {...modals.playlistPicker} />

      <DeleteSongModal {...modals.deleteSong} />

      <PlaybackAudioElement {...playbackAudio} />
    </main>
  );
}
