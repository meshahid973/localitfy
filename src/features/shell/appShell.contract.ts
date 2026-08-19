import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode, RefObject } from "react";
import type { HomeViewProps } from "../home/HomeView";
import type { LibraryViewProps } from "../library/LibraryView";
import type { AlbumsViewProps } from "../albums/AlbumsView";
import type { PlaylistsViewProps } from "../playlists/PlaylistsView";
import type { CoversViewProps } from "../covers/CoversView";
import type { AnalyticsViewProps } from "../analytics/AnalyticsView";
import type { SettingsViewProps } from "../settings/SettingsView";
import type { DownloadsViewProps } from "../downloads/DownloadsView";
import type { PlayerBarProps } from "../player/components/PlayerBar";
import type { PlaybackAudioElementProps } from "../player/components/PlaybackAudioElement";
import type { OnboardingProps } from "../../Onboarding";
import type { SettingsModalProps } from "../settings/SettingsModal";
import type { SongContextMenuProps } from "../library/components/SongContextMenu";
import type { SongEditorModalProps } from "../library/components/SongEditorModal";
import type { DeleteSongModalProps } from "../library/components/DeleteSongModal";
import type { PlaylistPickerModalProps } from "../playlists/components/PlaylistPickerModal";
import type { WhatsNewModalProps } from "../updates/WhatsNewModal";
import type { Settings } from "../settings/settings.types";
import type { CoverColorSyncMode, SecretMode } from "../settings/theme.types";
import type { View } from "./view.types";
import type { ImportAnimationState } from "../library/song.types";
import type { AppToastState } from "./useAppToast";
import type { UpdatePromptState } from "../updates/update.types";

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
  appToast: AppToastState; importAnimation: ImportAnimationState; libraryScanBusy: boolean;
  pixelArtBusy: boolean; libraryScanMessage: string;
};

export type ShellOnboardingContract = Omit<OnboardingProps, "appVersion"> & { open: boolean };

export type ShellNavigationContract = {
  effectiveSimpleMode: boolean; simpleModeView: ReactNode; view: View;
  changeView: (view: View, source?: string) => unknown; importSongs: () => unknown;
  startSidebarResize: (event: ReactPointerEvent<HTMLButtonElement>) => unknown;
  contentRef: RefObject<HTMLElement | null>; headerHint: string; greeting: string; query: string;
  handleSearchInput: (value: string) => unknown;
};

export type ShellModalContract = {
  settings: SettingsModalProps; songContextMenu: SongContextMenuProps; whatsNew: WhatsNewModalProps;
  songEditor: SongEditorModalProps; playlistPicker: PlaylistPickerModalProps; deleteSong: DeleteSongModalProps;
};

export type AppShellProps = {
  frame: ShellFrameContract; updates: ShellUpdateContract; screensaver: ShellScreensaverContract;
  effects: ShellEffectsContract; onboarding: ShellOnboardingContract; navigation: ShellNavigationContract;
  home: HomeViewProps; library: LibraryViewProps; albums: AlbumsViewProps; playlists: PlaylistsViewProps;
  covers: CoversViewProps; analytics: AnalyticsViewProps; settingsView: SettingsViewProps;
  downloads: DownloadsViewProps; playerBar: PlayerBarProps; modals: ShellModalContract;
  playbackAudio: PlaybackAudioElementProps;
};
