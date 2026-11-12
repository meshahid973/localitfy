import { setPairedComputerPlatform } from "../../app/platform";
import { markOnboardingSeenForThisRelease } from "../../features/onboarding/onboardingRelease";
import { APP_VERSION, WHATS_NEW_SEEN_KEY } from "../../features/updates/update.constants";
import { createAndroidBridge } from "./bridge";
import { phoneLibrary } from "./library";
import { installMediaSessionBridge } from "./mediaSession";
import { isSyncing, onSyncProgress, setFeaturesChangedHandler, syncNow } from "./sync";
import { installLiveConnection, onLiveEvent, restartLiveConnection } from "./live";
import "./android.css";

const AUTO_SYNC_AFTER_MS = 10 * 60 * 1000;

/** Runs before the app renders: the shared renderer then talks to this bridge instead of Electron's preload. */
export async function installAndroidBridge() {
  await phoneLibrary.load();
  setPairedComputerPlatform(phoneLibrary.pairing?.platform);
  window.localitfy = createAndroidBridge();
  installMediaSessionBridge(phoneLibrary.paths.files, phoneLibrary.paths.mediaPrefix);
  document.documentElement.classList.add("platformAndroid");
  // The welcome tour and release notes describe the Mac app; the phone starts from Settings → Library → Sync.
  markOnboardingSeenForThisRelease();
  window.localStorage.setItem(WHATS_NEW_SEEN_KEY, APP_VERSION);

  // The app reads its settings once at start, so pick up Mac feature switches (lyrics, analysis) by reloading,
  // but never in the middle of a song.
  setFeaturesChangedHandler(() => {
    if (navigator.mediaSession.playbackState !== "playing") window.location.reload();
  });

  // Sync on launch and whenever the app comes back after a while, if a Mac is paired.
  const autoSync = () => {
    if (!phoneLibrary.pairing || isSyncing()) return;
    if (phoneLibrary.lastSync && Date.now() - phoneLibrary.lastSync.at < AUTO_SYNC_AFTER_MS) return;
    void syncNow();
  };
  window.setTimeout(autoSync, 4000);

  // The live connection (likes, playback, remote control) runs alongside; a finished sync may have just paired.
  installLiveConnection();
  onSyncProgress((next) => {
    if (next.phase === "done") restartLiveConnection();
  });
  // Back in reach after being away: send what changed meanwhile (likes, plays) instead of waiting for the next sync.
  let wasOffline = false;
  onLiveEvent((event) => {
    if (event.type !== "connection") return;
    if (event.status === "offline") wasOffline = true;
    if (event.status === "connected" && wasOffline && !isSyncing()) void syncNow();
    if (event.status === "connected") wasOffline = false;
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") autoSync();
  });
}
