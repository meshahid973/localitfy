export type LocaltifyPlatformInfo = {
  id: "windows" | "linux" | "mac" | "unknown";
  label: string;
  releaseLabel: string;
  startupSettingSupported: boolean;
  desktopControlsLabel: string;
  desktopControlsHelp: string;
  startupSettingLabel: string;
  startupSettingHelp: string;
  linuxInstallNotes: string[];
};

export function getLocaltifyPlatformInfo(): LocaltifyPlatformInfo {
  const userAgent = typeof navigator !== "undefined" ? String(navigator.userAgent || "").toLowerCase() : "";
  const platform = typeof navigator !== "undefined" ? String(navigator.platform || "").toLowerCase() : "";
  const isLinux = /linux|x11|wayland/.test(userAgent) || platform.includes("linux");
  const isMac = /mac os|macintosh|darwin/.test(userAgent) || platform.includes("mac");
  const isWindows = /windows|win32|win64|wow64/.test(userAgent) || platform.includes("win");

  if (isLinux) return {
    id: "linux", label: "Linux", releaseLabel: "AppImage / RPM / DEB", startupSettingSupported: false,
    desktopControlsLabel: "Linux desktop controls",
    desktopControlsHelp: "Tray and media keys work where your Linux desktop environment exposes them. Windows startup is hidden here because Linux uses desktop-specific autostart files.",
    startupSettingLabel: "Start localtify with Linux",
    startupSettingHelp: "Linux autostart will be added later through a proper desktop-entry flow.",
    linuxInstallNotes: [
      "AppImage: chmod +x localtify-0.4.1-x86_64.AppImage, then run it directly.",
      "RPM: for Fedora, openSUSE, and RHEL-style distros.",
      "DEB: for Ubuntu, Debian, Linux Mint, and related distros."
    ]
  };

  if (isMac) return {
    id: "mac", label: "macOS", releaseLabel: "macOS build not published yet", startupSettingSupported: false,
    desktopControlsLabel: "macOS desktop controls",
    desktopControlsHelp: "macOS support is not part of this release yet. This page keeps Windows-only startup controls hidden.",
    startupSettingLabel: "Start localtify with macOS",
    startupSettingHelp: "macOS autostart will be added later when a signed macOS build exists.",
    linuxInstallNotes: []
  };

  return {
    id: isWindows ? "windows" : "unknown",
    label: isWindows ? "Windows" : "Unknown desktop",
    releaseLabel: isWindows ? "NSIS installer" : "Desktop build",
    startupSettingSupported: isWindows,
    desktopControlsLabel: isWindows ? "Windows controls" : "Desktop controls",
    desktopControlsHelp: isWindows
      ? "Use keyboard media keys, taskbar buttons, tray controls, and Windows now playing."
      : "Tray and media keys are available where the current desktop environment supports them.",
    startupSettingLabel: "Start localtify when Windows starts",
    startupSettingHelp: "Enabled by default so the player is ready after you sign in. You can turn it off anytime.",
    linuxInstallNotes: []
  };
}
