import { useDeferredValue, useEffect, useRef, useState } from "react";
import type { Settings, SettingsCategory, CustomThemeColorKey, CustomThemePreset } from "./settings.types";
import { readSavedCustomThemePresets } from "./customTheme";

export type UseSettingsControllerOptions = {
  initialSettings: () => Settings;
};

export function useSettingsController({ initialSettings }: UseSettingsControllerOptions) {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const settingsRef = useRef(settings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsCategory, setSettingsCategory] = useState<SettingsCategory>("appearance");
  const [settingsSearch, setSettingsSearch] = useState("");
  const deferredSettingsSearch = useDeferredValue(settingsSearch);
  const [customThemeName, setCustomThemeName] = useState("My Custom Theme");
  const [customThemeHexDrafts, setCustomThemeHexDrafts] = useState<Partial<Record<CustomThemeColorKey, string>>>({});
  const [savedCustomThemes, setSavedCustomThemes] = useState<CustomThemePreset[]>(() => readSavedCustomThemePresets());
  const [themeSettling, setThemeSettling] = useState(false);
  const [themeMotionReady, setThemeMotionReady] = useState(false);

  const saveSettingsTimerRef = useRef<number | null>(null);
  const themeSettlingTimerRef = useRef<number | null>(null);
  const customThemeCommitTimerRef = useRef<number | null>(null);
  const customThemeQuietCommitTimerRef = useRef<number | null>(null);
  const customThemeQuietPatchRef = useRef<Partial<Settings>>({});
  const customThemePreviewFrameRef = useRef<number | null>(null);
  const themePaintIdleTimerRef = useRef<number | null>(null);
  const customThemeLivePatchRef = useRef<Partial<Settings>>({});
  const pendingCustomThemePreviewPatchRef = useRef<Partial<Settings>>({});
  const themeSettlingRef = useRef(false);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    themeSettlingRef.current = themeSettling;
  }, [themeSettling]);

  return {
    settings, setSettings, settingsRef,
    settingsOpen, setSettingsOpen,
    settingsCategory, setSettingsCategory,
    settingsSearch, setSettingsSearch, deferredSettingsSearch,
    customThemeName, setCustomThemeName,
    customThemeHexDrafts, setCustomThemeHexDrafts,
    savedCustomThemes, setSavedCustomThemes,
    themeSettling, setThemeSettling,
    themeMotionReady, setThemeMotionReady,
    saveSettingsTimerRef,
    themeSettlingTimerRef,
    customThemeCommitTimerRef,
    customThemeQuietCommitTimerRef,
    customThemeQuietPatchRef,
    customThemePreviewFrameRef,
    themePaintIdleTimerRef,
    customThemeLivePatchRef,
    pendingCustomThemePreviewPatchRef,
    themeSettlingRef
  };
}
