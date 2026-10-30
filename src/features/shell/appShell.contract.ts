import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode, RefObject } from "react";
import type { HomeViewProps } from "../home/HomeView";
import type { LibraryViewProps } from "../library/LibraryView";
import type { ArtistsViewProps } from "../artists/ArtistsView";
import type { GenresViewProps } from "../genres/GenresView";
import type { AlbumsViewProps } from "../albums/AlbumsView";
import type { PlaylistsViewProps } from "../playlists/PlaylistsView";
import type { CoversViewProps } from "../covers/CoversView";
import type { AnalyticsViewProps } from "../analytics/AnalyticsView";
import type { DiscoverViewProps } from "../discover/DiscoverView";
import type { SettingsViewProps } from "../settings/SettingsView";
import type { DownloadsViewProps } from "../downloads/DownloadsView";
import type { PlayerBarProps } from "../player/components/PlayerBar";
import type { QueuePanelProps } from "../player/components/QueuePanel";
import type { LyricsViewProps } from "../lyrics/LyricsView";
import type { PlaybackAudioElementProps } from "../player/components/PlaybackAudioElement";
import type { OnboardingProps } from "../../Onboarding";
import type { SongContextMenuProps } from "../library/components/SongContextMenu";
import type { SimilarSongsDialogProps } from "../analysis/SimilarSongsDialog";
import type { SongEditorModalProps } from "../library/components/SongEditorModal";
import type { DeleteSongModalProps } from "../library/components/DeleteSongModal";
import type { PlaylistPickerModalProps } from "../playlists/components/PlaylistPickerModal";
import type { WhatsNewModalProps } from "../updates/WhatsNewModal";
import type { Settings } from "../settings/settings.types";
import type { CoverColorSyncMode, SecretMode } from "../settings/theme.types";
import type { View } from "./view.types";
import type { SidebarLayoutPatch } from "./SidebarNav";
import type { ImportAnimationState } from "../library/song.types";
import type { AppToastState } from "./useAppToast";
import type { UpdatePromptState } from "../updates/update.types";
import type { NavigationHistory } from "./useNavigationHistory";
import type { Playlist } from "../playlists/playlist.types";
import type { PlaybackSourceRef } from "../player/playbackSource";
import type { SimilarSeedRequest } from "../analysis/similarSeed";

export type AppShellPlatformInfo = { id: "windows" | "linux" | "mac" | "unknown" | string };

export type ShellFrameContract = {
  appRootRef: RefObject<HTMLElement | null>; settings: Settings; platformInfo: AppShellPlatformInfo;
  themeMotionReady: boolean; showTopUpdateRibbon: boolean; isViewSwitching: boolean;
  heroMotion: "idle" | "expanding" | "compacting"; heroMotionAppClass: string; homeEntranceSettledClass: string;
  isAppBackgrounded: boolean; scrollBusyRef: RefObject<boolean>; themeSettling: boolean;
  themePresetStyle: CSSProperties; animatedThemeVisualStyle: CSSProperties; customThemeStyle: CSSProperties;
  effectiveTheme: string; effectiveAmbient: boolean; effectiveCoverColorSyncMode: CoverColorSyncMode;
  effectiveNotes: boolean; statusText: string; draggedSongTitle: string; showStarBackdrop: boolean;
};

export type ShellUpdateContract = {
  updatePrompt: UpdatePromptState; askUpdaterToDownload: () => unknown; askUpdaterToInstall: () => unknown;
  manualUpdateCheck: () => unknown; setUpdatePrompt: (next: UpdatePromptState) => void; progress: number;
};

export type ShellScreensaverContract = {
  previewActive: boolean; visible: boolean; dismissFromActivity: () => unknown;
  setVisible: (visible: boolean) => void; visualSource: string;
};

export type ShellEffectsContract = {
  secretMode: SecretMode; secretBurst: number; secretToast: string; starParticleStyles: CSSProperties[];
  appToast: AppToastState; importAnimation: ImportAnimationState;
};

export type ShellOnboardingContract = Omit<OnboardingProps, "appVersion"> & { open: boolean };

export type ShellNavigationContract = {
  effectiveSimpleMode: boolean; simpleModeView: ReactNode; view: View;
  changeView: (view: View, source?: string) => unknown; importSongs: () => unknown;
  startSidebarResize: (event: ReactPointerEvent<HTMLButtonElement>) => unknown;
  contentRef: RefObject<HTMLElement | null>;
  updateSidebarLayout: (patch: SidebarLayoutPatch) => unknown; openSidebarSettings: () => unknown;
  history: NavigationHistory;
};

/** Playback for whole collections, shared by every page through the app actions. */
export type ShellCollectionsContract = {
  playSongs: (songIds: string[], label: string, source: PlaybackSourceRef | null, shuffle: boolean, startId?: string) => unknown;
  queueSongs: (songIds: string[], label: string) => unknown;
  playPlaylist: (playlist: Playlist, shuffle: boolean) => unknown;
  openSimilar: (request: SimilarSeedRequest) => unknown;
};

export type ShellModalContract = {
  songContextMenu: SongContextMenuProps; similarSongs: SimilarSongsDialogProps; queuePanel: QueuePanelProps; lyrics: Omit<LyricsViewProps, "anchorRef">; whatsNew: WhatsNewModalProps;
  songEditor: SongEditorModalProps; playlistPicker: PlaylistPickerModalProps; deleteSong: DeleteSongModalProps;
};

export type AppShellProps = {
  frame: ShellFrameContract; updates: ShellUpdateContract; screensaver: ShellScreensaverContract;
  effects: ShellEffectsContract; onboarding: ShellOnboardingContract; navigation: ShellNavigationContract;
  home: HomeViewProps; library: LibraryViewProps; artists: ArtistsViewProps; genres: GenresViewProps; albums: AlbumsViewProps; playlists: PlaylistsViewProps;
  covers: CoversViewProps; analytics: AnalyticsViewProps; discover: DiscoverViewProps; settingsView: SettingsViewProps;
  downloads: DownloadsViewProps; playerBar: PlayerBarProps; modals: ShellModalContract;
  playbackAudio: PlaybackAudioElementProps; collections: ShellCollectionsContract;
};
