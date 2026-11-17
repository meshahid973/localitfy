import { useDeferredValue, useEffect, useRef, useState } from "react";
import type { Settings, SettingsCategory } from "./settings.types";

export type UseSettingsControllerOptions = {
  initialSettings: () => Settings;
};

export function useSettingsController({ initialSettings }: UseSettingsControllerOptions) {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const settingsRef = useRef(settings);
  const [settingsCategory, setSettingsCategory] = useState<SettingsCategory>("appearance");
  const [settingsSearch, setSettingsSearch] = useState("");
  const deferredSettingsSearch = useDeferredValue(settingsSearch);
  const [themeSettling, setThemeSettling] = useState(false);
  const [themeMotionReady, setThemeMotionReady] = useState(false);

  const saveSettingsTimerRef = useRef<number | null>(null);
  const themeSettlingTimerRef = useRef<number | null>(null);
  const themePaintIdleTimerRef = useRef<number | null>(null);
  const themeSettlingRef = useRef(false);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    themeSettlingRef.current = themeSettling;
  }, [themeSettling]);

  return {
    settings, setSettings, settingsRef,
    settingsCategory, setSettingsCategory,
    settingsSearch, setSettingsSearch, deferredSettingsSearch,
    themeSettling, setThemeSettling,
    themeMotionReady, setThemeMotionReady,
    saveSettingsTimerRef,
    themeSettlingTimerRef,
    themePaintIdleTimerRef,
    themeSettlingRef
  };
}
