import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function ToggleRow({ label, help, checked, onChange }: {
  label: string;
  help?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggleRow" title={help || label}>
      <span className="toggleRowCopy">
        <span className="settingsLabelLine">
          <strong>{label}</strong>
          {help ? <span className="settingsInfoDot" aria-hidden="true">i</span> : null}
        </span>
        {help ? <small>{help}</small> : null}
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} />
    </label>
  );
}

export function RangeRow({ label, value, min, max, step, suffix, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  const [draftValue, setDraftValue] = useState(value);
  const [editing, setEditing] = useState(false);
  const activeValue = editing ? draftValue : value;
  const shownValue = `${activeValue}${suffix || ""}`;
  const fill = ((activeValue - min) / (max - min || 1)) * 100;

  useEffect(() => {
    if (!editing) setDraftValue(value);
  }, [editing, value]);

  function commit(nextValue = draftValue) {
    const clamped = clamp(nextValue, min, max);
    setDraftValue(clamped);
    setEditing(false);
    if (clamped !== value) onChange(clamped);
  }

  return (
    <label className="rangeRow" title={`${label}: ${shownValue}`}>
      <span className="rangeRowCopy">
        <span className="settingsLabelLine"><strong>{label}</strong><span className="settingsInfoDot" aria-hidden="true">i</span></span>
        <small>{shownValue}</small>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={activeValue}
        style={{ ["--range-progress" as string]: `${clamp(fill, 0, 100)}%` } as CSSProperties}
        onPointerDown={() => { setEditing(true); setDraftValue(value); }}
        onChange={(event) => setDraftValue(Number(event.currentTarget.value))}
        onPointerUp={(event) => commit(Number(event.currentTarget.value))}
        onKeyUp={(event) => commit(Number(event.currentTarget.value))}
        onBlur={(event) => commit(Number(event.currentTarget.value))}
      />
    </label>
  );
}

export type ChoiceOption = { id: string; label?: string; name?: string; note?: string };
export type ThemeOption = { id: string; name: string; note?: string };
export type CustomThemeTokenOption = { key: string; label: string; help?: string; value: string };
export type CustomThemePresetOption = { id: string; name: string; note?: string; colors: { customThemeColor: string; [key: string]: string } };
export type SongLike = { id?: string; title?: string; artist?: string; album?: string; [key: string]: unknown };
export type PlatformInfoLike = {
  id?: "windows" | "linux" | "mac" | "unknown";
  label?: string;
  releaseLabel?: string;
  startupSettingSupported?: boolean;
  desktopControlsLabel?: string;
  desktopControlsHelp?: string;
  startupSettingLabel?: string;
  startupSettingHelp?: string;
  linuxInstallNotes?: string[];
};
export type DiagnosticsInfo = { items: Array<{ label: string; value: string | number }>; copyText: string };
export type UpdateSetting = (key: string, value: unknown) => void | Promise<void>;

export function detectSettingsPlatform(): Required<PlatformInfoLike> {
  const userAgent = typeof navigator !== "undefined" ? String(navigator.userAgent || "").toLowerCase() : "";
  const platform = typeof navigator !== "undefined" ? String(navigator.platform || "").toLowerCase() : "";
  const isLinux = /linux|x11|wayland/.test(userAgent) || platform.includes("linux");
  const isMac = /mac os|macintosh|darwin/.test(userAgent) || platform.includes("mac");
  const isWindows = /windows|win32|win64|wow64/.test(userAgent) || platform.includes("win");
  if (isLinux) return {
    id: "linux", label: "Linux", releaseLabel: "AppImage / RPM / DEB", startupSettingSupported: false,
    desktopControlsLabel: "Linux desktop controls", desktopControlsHelp: "Tray and media keys work where your Linux desktop environment exposes them.",
    startupSettingLabel: "Linux autostart", startupSettingHelp: "Hidden in this release. Linux autostart will use a proper desktop-entry flow later.",
    linuxInstallNotes: [
      "AppImage: right click > Properties > Allow executing file as program, or run chmod +x Localtify-0.4.1-x86_64.AppImage.",
      "If the AppImage does not open, install FUSE/libfuse2 for your distro, then run it again.",
      "RPM: for Fedora, openSUSE, and RHEL-style distros.",
      "DEB: for Ubuntu, Debian, Linux Mint, and related distros."
    ]
  };
  if (isMac) return {
    id: "mac", label: "macOS", releaseLabel: "macOS build not published yet", startupSettingSupported: false,
    desktopControlsLabel: "macOS desktop controls", desktopControlsHelp: "macOS support is not part of this release yet. Windows startup controls stay hidden.",
    startupSettingLabel: "Start localtify with macOS", startupSettingHelp: "macOS autostart will be added later when a signed macOS build exists.", linuxInstallNotes: []
  };
  return {
    id: isWindows ? "windows" : "unknown", label: isWindows ? "Windows" : "Unknown desktop",
    releaseLabel: isWindows ? "NSIS installer" : "Desktop build", startupSettingSupported: isWindows,
    desktopControlsLabel: isWindows ? "Windows controls" : "Desktop controls",
    desktopControlsHelp: isWindows ? "Use keyboard media keys, taskbar buttons, tray controls, and Windows now playing." : "Tray and media keys are available where the current desktop environment supports them.",
    startupSettingLabel: "Start localtify when Windows starts",
    startupSettingHelp: "Enabled by default so the player is ready after you sign in. You can turn it off anytime.", linuxInstallNotes: []
  };
}
