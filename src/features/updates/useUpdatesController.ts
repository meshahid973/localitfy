import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { trackUpdatePopupSeen } from "../../analytics";
import type { AppToastKind, View } from "../shell/view.types";
import { APP_VERSION, WHATS_NEW_SEEN_KEY, defaultUpdatePrompt } from "./update.constants";
import type { AutoUpdateEvent, UpdatePromptState } from "./update.types";
import { friendlyUpdateError, updateWasLeftAlone } from "./update.utils";

type UpdatesControllerOptions = {
  ready: boolean;
  autoUpdateEnabled: boolean;
  analyticsViewRef: RefObject<View>;
  setStatusText: Dispatch<SetStateAction<string>>;
  showAppToast: (message: string, kind?: AppToastKind) => void;
};

export function useUpdatesController({
  ready,
  autoUpdateEnabled,
  analyticsViewRef,
  setStatusText,
  showAppToast
}: UpdatesControllerOptions) {
  const [updatePrompt, setUpdatePrompt] = useState<UpdatePromptState>(defaultUpdatePrompt);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [lastUpdateCheckedLabel, setLastUpdateCheckedLabel] = useState("not checked yet");
  const updateAnalyticsSeenRef = useRef("");
  const updateNagTimerRef = useRef<number | null>(null);
  const updateNagVersionRef = useRef("");
  const updateNagStatusRef = useRef<"available" | "downloaded">("available");

  const clearUpdateNagTimer = useCallback(() => {
    if (updateNagTimerRef.current !== null) {
      window.clearTimeout(updateNagTimerRef.current);
      updateNagTimerRef.current = null;
    }
  }, []);

  const showUpdateNag = useCallback((stage: 1 | 2 | 3, versionInput?: string) => {
    const version = versionInput || updateNagVersionRef.current || updatePrompt.version || "latest";
    if (updateWasLeftAlone(version)) return;

    updateNagVersionRef.current = version;
    setUpdatePrompt({
      visible: true,
      status: updateNagStatusRef.current,
      version,
      percent: updateNagStatusRef.current === "downloaded" ? 100 : 0,
      nagStage: stage,
      message: "",
      error: "",
      libraryBackedUp: true
    });
  }, [updatePrompt.version]);

  const scheduleUpdateNag = useCallback((
    versionInput?: string,
    stageInput?: 1 | 2 | 3,
    customDelayMs?: number,
    statusInput?: "available" | "downloaded"
  ) => {
    const version = versionInput || updatePrompt.version || updateNagVersionRef.current || "latest";
    const stage = stageInput || 1;
    if (updateWasLeftAlone(version)) return;

    updateNagVersionRef.current = version;
    updateNagStatusRef.current = statusInput || updateNagStatusRef.current || "available";
    clearUpdateNagTimer();

    const delayMs = typeof customDelayMs === "number" ? customDelayMs : stage === 1 ? 120_000 : 60_000;
    updateNagTimerRef.current = window.setTimeout(() => {
      updateNagTimerRef.current = null;
      showUpdateNag(stage, version);
    }, delayMs);
  }, [clearUpdateNagTimer, showUpdateNag, updatePrompt.version]);

  useEffect(() => {
    if (!ready) return;
    const seenVersion = window.localStorage.getItem(WHATS_NEW_SEEN_KEY);
    if (seenVersion === APP_VERSION) return;
    const timer = window.setTimeout(() => setWhatsNewOpen(true), 420);
    return () => window.clearTimeout(timer);
  }, [ready]);

  useEffect(() => {
    if (!window.localitfy.onAutoUpdate) return;

    const off = window.localitfy.onAutoUpdate((payload: AutoUpdateEvent) => {
      if (!payload || typeof payload !== "object") return;

      const version = payload.version || "latest";
      const percent = Math.min(100, Math.max(0, Number(payload.percent || 0)));

      if (!payload.silent && ["checking", "not-available", "available", "error", "dev"].includes(payload.type)) {
        setLastUpdateCheckedLabel(payload.type === "checking" ? "checking now" : "just now");
      }

      if (payload.type === "backup") {
        setUpdatePrompt((old) => ({
          ...old,
          visible: old.visible,
          backupPath: payload.backupPath || old.backupPath,
          libraryBackedUp: Boolean(payload.libraryBackedUp),
          message: old.message || payload.message || "your library has been backed up"
        }));
        return;
      }

      if (payload.type === "checking") {
        if (payload.silent) return;
        setUpdatePrompt({ visible: true, status: "checking", version: "", percent: 0, message: payload.message || "Checking for updates...", error: "" });
        showAppToast("Checking for updates", "work");
        return;
      }

      if (payload.type === "available") {
        updateNagVersionRef.current = version;
        updateNagStatusRef.current = "available";
        if (version && updateWasLeftAlone(version)) return;
        setUpdatePrompt({
          visible: true,
          status: "available",
          version,
          percent: 0,
          message: payload.message || `localtify ${version} is ready to download.`,
          error: "",
          backupPath: payload.backupPath || "",
          libraryBackedUp: Boolean(payload.libraryBackedUp),
          releaseNotes: payload.releaseNotes || ""
        });
        showAppToast("Update available", "success");
        return;
      }

      if (payload.type === "downloading") {
        setUpdatePrompt((old) => ({
          ...old,
          visible: true,
          status: "downloading",
          percent,
          message: payload.message || `Downloading update... ${Math.round(percent)}%`,
          error: "",
          backupPath: payload.backupPath || old.backupPath,
          libraryBackedUp: Boolean(payload.libraryBackedUp || old.libraryBackedUp),
          downloadedBytes: payload.downloadedBytes,
          totalBytes: payload.totalBytes,
          sizeBytes: payload.sizeBytes,
          speedBytesPerSecond: payload.speedBytesPerSecond
        }));
        return;
      }

      if (payload.type === "downloaded") {
        updateNagVersionRef.current = version || updateNagVersionRef.current || "latest";
        updateNagStatusRef.current = "downloaded";
        setUpdatePrompt((old) => ({
          ...old,
          visible: true,
          status: "downloaded",
          percent: 100,
          version: version || old.version,
          message: payload.message || "Update ready. Your library has been backed up. Restart localtify to install it.",
          error: "",
          backupPath: payload.backupPath || old.backupPath,
          libraryBackedUp: Boolean(payload.libraryBackedUp || old.libraryBackedUp),
          releaseNotes: payload.releaseNotes || old.releaseNotes
        }));
        showAppToast("Update ready to install", "success");
        return;
      }

      if (payload.type === "not-available") {
        if (payload.silent) return;
        setUpdatePrompt(defaultUpdatePrompt);
        setStatusText("localtify is up to date");
        showAppToast("localtify is up to date", "success");
        return;
      }

      if (payload.type === "dev") {
        if (payload.silent) return;
        setUpdatePrompt(defaultUpdatePrompt);
        setStatusText("update checks work in the installed app");
        showAppToast("Update checks work after installing the app", "work");
        return;
      }

      if (payload.type === "error") {
        if (payload.silent) return;
        const message = friendlyUpdateError(payload.error || payload.message);
        setUpdatePrompt({ visible: true, status: "error", version: "", percent: 0, message, error: message });
        showAppToast("Update check failed", "error");
      }
    });

    return () => off();
  }, [setStatusText, showAppToast]);

  useEffect(() => {
    if (!ready || !autoUpdateEnabled || !window.localitfy.checkForUpdates) return;
    const timer = window.setTimeout(() => {
      window.localitfy.checkForUpdates?.({ silent: true }).catch(() => undefined);
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [ready, autoUpdateEnabled]);

  useEffect(() => () => clearUpdateNagTimer(), [clearUpdateNagTimer]);

  useEffect(() => {
    if (!updatePrompt.visible) return;
    const signature = [updatePrompt.status, updatePrompt.version || "none", updatePrompt.nagStage || 0].join(":");
    if (updateAnalyticsSeenRef.current === signature) return;
    updateAnalyticsSeenRef.current = signature;
    trackUpdatePopupSeen({
      update_status: updatePrompt.status,
      current_version: APP_VERSION,
      latest_version: updatePrompt.version || null,
      current_view: analyticsViewRef.current,
      has_error: Boolean(updatePrompt.error)
    });
  }, [analyticsViewRef, updatePrompt.visible, updatePrompt.status, updatePrompt.version, updatePrompt.error, updatePrompt.nagStage]);

  useEffect(() => {
    if (!updatePrompt.visible) return;
    if (updatePrompt.status !== "latest" && updatePrompt.status !== "dev") return;
    const timer = window.setTimeout(() => setUpdatePrompt(defaultUpdatePrompt), updatePrompt.status === "latest" ? 1400 : 2600);
    return () => window.clearTimeout(timer);
  }, [updatePrompt.visible, updatePrompt.status]);

  const askUpdaterToDownload = useCallback(async () => {
    if (!window.localitfy.downloadUpdate) {
      setUpdatePrompt((old) => ({ ...old, visible: true, status: "error", message: "Could not check for updates. Try again later.", error: "Updater is not available in this build." }));
      return;
    }
    setUpdatePrompt((old) => ({ ...old, visible: true, status: "downloading", percent: 0, message: "Backing up your library, then starting download...", error: "" }));
    await window.localitfy.downloadUpdate().catch((error: unknown) => {
      const message = friendlyUpdateError(error);
      setUpdatePrompt((old) => ({ ...old, visible: true, status: "error", message, error: message }));
    });
  }, []);

  const askUpdaterToInstall = useCallback(async () => {
    if (!window.localitfy.installUpdate) return;
    await window.localitfy.installUpdate().catch(() => {
      setUpdatePrompt((old) => ({ ...old, visible: true, status: "error", message: "Could not restart to install the update.", error: "Could not restart to install the update." }));
    });
  }, []);

  const manualUpdateCheck = useCallback(async () => {
    setLastUpdateCheckedLabel("checking now");
    if (!window.localitfy.checkForUpdates) {
      setUpdatePrompt({ visible: true, status: "error", version: "", percent: 0, message: "Could not check for updates. Try again later.", error: "Updater is not available in this build." });
      setLastUpdateCheckedLabel("just now");
      return;
    }
    setUpdatePrompt({ visible: true, status: "checking", version: "", percent: 0, message: "Checking for updates...", error: "" });
    await window.localitfy.checkForUpdates({ silent: false }).catch((error: unknown) => {
      const message = friendlyUpdateError(error);
      setUpdatePrompt({ visible: true, status: "error", version: "", percent: 0, message, error: message });
      setLastUpdateCheckedLabel("just now");
    });
  }, []);

  const openUpdateChangelog = useCallback(() => setWhatsNewOpen(true), []);
  const closeWhatsNew = useCallback(() => {
    window.localStorage.setItem(WHATS_NEW_SEEN_KEY, APP_VERSION);
    setWhatsNewOpen(false);
  }, []);

  const handleUpdateLater = useCallback(() => {
    const currentStage = updatePrompt.nagStage || 0;
    const nextStage = currentStage >= 2 ? 3 : currentStage === 1 ? 2 : 1;
    const nextDelay = currentStage === 0 ? 120_000 : 60_000;
    const version = updatePrompt.version || updateNagVersionRef.current || "latest";
    const reminderStatus = updatePrompt.status === "downloaded" ? "downloaded" : "available";
    setUpdatePrompt(defaultUpdatePrompt);
    scheduleUpdateNag(version, nextStage, nextDelay, reminderStatus);
    setStatusText("update reminder snoozed");
  }, [scheduleUpdateNag, setStatusText, updatePrompt.nagStage, updatePrompt.status, updatePrompt.version]);

  const showDebugUpdateAvailable = useCallback(() => {
    clearUpdateNagTimer();
    updateNagVersionRef.current = "test";
    updateNagStatusRef.current = "available";
    setUpdatePrompt({ visible: true, status: "available", version: "test", percent: 0, message: "localtify test update is ready to download.", error: "", libraryBackedUp: true });
  }, [clearUpdateNagTimer]);

  return {
    updatePrompt,
    setUpdatePrompt,
    whatsNewOpen,
    setWhatsNewOpen,
    openUpdateChangelog,
    closeWhatsNew,
    askUpdaterToDownload,
    askUpdaterToInstall,
    manualUpdateCheck,
    handleUpdateLater,
    skipAvailableUpdate: handleUpdateLater,
    clearUpdateNagTimer,
    showUpdateNag,
    showDebugUpdateAvailable,
    lastUpdateCheckedLabel
  };
}
