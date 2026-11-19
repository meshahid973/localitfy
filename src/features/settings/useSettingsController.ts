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
    const flush = () => {
      if (saveSettingsTimerRef.current === null) return;
      window.clearTimeout(saveSettingsTimerRef.current);
      saveSettingsTimerRef.current = null;
      void window.localitfy.saveSettings(settingsRef.current).catch(error => console.warn("[localtify settings flush]", error));
    };
    const onVisibility = () => { if (document.hidden) flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, []);

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
