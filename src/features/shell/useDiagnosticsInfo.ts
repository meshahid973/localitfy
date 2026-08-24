import { useCallback, useMemo } from "react";
import type { Song } from "../library/song.types";
import type { Settings } from "../settings/settings.types";
import { APP_VERSION } from "../updates/update.constants";
import { updateStatusLabel } from "../updates";

type PlatformInfo = {
  id: string;
  label: string;
  releaseLabel: string;
  startupSettingSupported: boolean;
};

type DiagnosticsInfoOptions = {
  currentThemeName: string;
  downloadFolderLabel: string;
  performanceStatus: any;
  feedbackConfigStatus: any;
  platformInfo: PlatformInfo;
  playlistCount: number;
  settings: Settings;
  songs: Song[];
  updatePrompt: any;
  lastUpdateCheckedLabel: string;
  setDiagnosticsCopied: (copied: boolean) => void;
};

export function useDiagnosticsInfo({
  currentThemeName,
  downloadFolderLabel,
  performanceStatus,
  feedbackConfigStatus,
  platformInfo,
  playlistCount,
  settings,
  songs,
  updatePrompt,
  lastUpdateCheckedLabel,
  setDiagnosticsCopied
}: DiagnosticsInfoOptions) {
  const diagnosticsInfo = useMemo(() => {
    const themeLabel = settings.customThemeEnabled ? `${currentThemeName} + custom colors` : currentThemeName;
    const discordStatus = settings.discordEnabled ? "enabled" : "disabled";
    const startupStatus = platformInfo.startupSettingSupported
      ? (settings.startWithWindows ? "enabled" : "disabled")
      : "not supported on this platform";
    const libraryAlbumCount = new Set(
      songs
        .map((song) => String(song.album || "").trim().toLowerCase())
        .filter((album) => album && album !== "unknown album")
    ).size;
    const downloadFolderStatus = downloadFolderLabel || settings.downloadFolder || "default downloads folder";
    const updateStatus = updatePrompt.visible
      ? updateStatusLabel(updatePrompt.status)
      : lastUpdateCheckedLabel;
    const feedbackWebhookStatus = feedbackConfigStatus?.configured
      ? feedbackConfigStatus.valid
        ? "enabled"
        : "configured but invalid"
      : "not configured";
    const electronVersion = String(performanceStatus?.electronVersion || "not reported yet");
    const chromeVersion = String(performanceStatus?.chromeVersion || "not reported yet");
    const packageSupport = platformInfo.id === "windows"
      ? "Windows: full support"
      : platformInfo.id === "linux"
        ? "Linux: AppImage / DEB / RPM supported"
        : platformInfo.id === "mac"
          ? "macOS: not officially supported yet"
          : "desktop support: unknown platform";

    const items = [
      { label: "app version", value: APP_VERSION },
      { label: "platform", value: platformInfo.label },
      { label: "Electron", value: electronVersion },
      { label: "Chromium", value: chromeVersion },
      { label: "song count", value: String(songs.length) },
      { label: "playlist count", value: String(playlistCount) },
      { label: "album count", value: String(libraryAlbumCount) },
      { label: "downloads folder", value: downloadFolderStatus },
      { label: "Discord RPC", value: discordStatus },
      { label: "update status", value: updateStatus },
      { label: "feedback webhook", value: feedbackWebhookStatus },
      { label: "startup status", value: startupStatus },
      { label: "platform support", value: packageSupport }
    ];

    return {
      items,
      copyText: [
        `localtify version: ${APP_VERSION}`,
        `platform: ${platformInfo.label}`,
        `release package: ${platformInfo.releaseLabel}`,
        `electron: ${electronVersion}`,
        `chromium: ${chromeVersion}`,
        `song count: ${songs.length}`,
        `playlist count: ${playlistCount}`,
        `album count: ${libraryAlbumCount}`,
        `downloads folder: ${downloadFolderStatus}`,
        `theme: ${themeLabel}`,
        `Discord RPC: ${discordStatus}`,
        `update status: ${updateStatus}`,
        `feedback webhook: ${feedbackWebhookStatus}`,
        `startup status: ${startupStatus}`,
        `platform support: ${packageSupport}`
      ].join("\n")
    };
  }, [
    currentThemeName,
    downloadFolderLabel,
    performanceStatus?.chromeVersion,
    performanceStatus?.electronVersion,
    feedbackConfigStatus?.configured,
    feedbackConfigStatus?.valid,
    platformInfo.id,
    platformInfo.label,
    platformInfo.releaseLabel,
    platformInfo.startupSettingSupported,
    playlistCount,
    settings.customThemeEnabled,
    settings.discordEnabled,
    settings.downloadFolder,
    settings.startWithWindows,
    songs,
    updatePrompt,
    lastUpdateCheckedLabel
  ]);

  const copyDiagnosticsInfo = useCallback(async () => {
    const textToCopy = diagnosticsInfo.copyText;
    let copied = false;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = textToCopy;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "0";
        document.body.appendChild(textarea);
        textarea.select();
        copied = document.execCommand("copy");
        document.body.removeChild(textarea);
      } catch {
        copied = false;
      }
    }

    setDiagnosticsCopied(true);
    window.setTimeout(() => setDiagnosticsCopied(false), copied ? 1500 : 2200);
  }, [diagnosticsInfo.copyText, setDiagnosticsCopied]);

  return { diagnosticsInfo, copyDiagnosticsInfo };
}
