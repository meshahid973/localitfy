import { useEffect, useRef, useState } from "react";
import type { Song } from "../library/song.types";
import type { Playlist } from "../playlists/playlist.types";
import type { Settings } from "../settings/settings.types";
import type { View } from "../shell/view.types";
import {
  createLocaltifyLibraryWorker,
  makeLocaltifyAnalyticsSnapshotFallback,
  type LocaltifyAnalyticsSnapshot
} from "./analyticsSnapshot";
import { isLocaltifyAnalyticsConfigured, trackAudienceSnapshot, trackMarketingSnapshot, trackPlaylistSnapshot } from "../../analytics";

import { runLocaltifyIdleTask as runIdleTask } from "../../app/runtime/idle";

export type UseAnalyticsRuntimeOptions = {
  ready: boolean;
  view: View;
  songs: Song[];
  likedCount: number;
  playlists: Playlist[];
  settings: Settings;
  isShuffle: boolean;
  repeatMode: "off" | "one" | "all";
  downloadResultCount: number;
};

export function useAnalyticsRuntime(options: UseAnalyticsRuntimeOptions) {
  const { ready, view, songs, likedCount, playlists, settings, isShuffle, repeatMode, downloadResultCount } = options;
  const analyticsWorkerRef = useRef<Worker | null>(null);
  const analyticsWorkerRequestRef = useRef(0);
  const [analyticsAudienceSnapshot, setAnalyticsAudienceSnapshot] = useState<LocaltifyAnalyticsSnapshot>(() =>
    makeLocaltifyAnalyticsSnapshotFallback({
      activeView: view,
      songs: [],
      likedCount: 0,
      playlists: [],
      settings,
      isShuffle,
      repeatMode,
      downloadResultCount: 0
    })
  );
  const [analyticsAudienceSnapshotReady, setAnalyticsAudienceSnapshotReady] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const requestId = analyticsWorkerRequestRef.current + 1;
    analyticsWorkerRequestRef.current = requestId;
    setAnalyticsAudienceSnapshotReady(false);

    const workerPayload = {
      type: "compute-analytics-snapshot",
      requestId,
      activeView: view,
      songs,
      likedCount,
      playlists,
      settings: {
        discordEnabled: settings.discordEnabled,
        discordPrivacyMode: settings.discordPrivacyMode,
        discordButtons: settings.discordButtons,
        discordArtMode: settings.discordArtMode,
        discordActivityStyle: settings.discordActivityStyle,
        startWithWindows: settings.startWithWindows,
        minimizeToTray: settings.minimizeToTray,
        theme: settings.theme,
        coverColorSyncMode: settings.coverColorSyncMode,
        compactPlayer: settings.compactPlayer,
        reducedMotion: settings.reducedMotion,
        crossfadeEnabled: settings.crossfadeEnabled,
        gaplessPlayback: settings.gaplessPlayback,
        volumeNormalization: settings.volumeNormalization,
        perSongVolumeMemory: settings.perSongVolumeMemory,
        playbackSpeed: settings.playbackSpeed
      },
      isShuffle,
      repeatMode,
      downloadResultCount
    };

    let cancelled = false;
    const applySnapshot = (snapshot: LocaltifyAnalyticsSnapshot) => {
      if (cancelled || analyticsWorkerRequestRef.current !== requestId) return;
      setAnalyticsAudienceSnapshot(snapshot);
      setAnalyticsAudienceSnapshotReady(true);
    };
    let cancelFallback: (() => void) | undefined;
    const applyFallback = () => {
      cancelFallback?.();
      if (cancelled) return;
      cancelFallback = runIdleTask(() => {
        if (!cancelled) applySnapshot(makeLocaltifyAnalyticsSnapshotFallback(workerPayload));
      }, 900);
    };
    const worker = analyticsWorkerRef.current || createLocaltifyLibraryWorker();
    if (!worker) {
      applyFallback();
      return () => { cancelled = true; cancelFallback?.(); };
    }

    analyticsWorkerRef.current = worker;
    const handleMessage = (event: MessageEvent) => {
      const data = event.data || {};
      if (data.type !== "analytics-snapshot" || data.requestId !== requestId) return;
      if (data.snapshot && !data.error) applySnapshot(data.snapshot);
      else applyFallback();
    };
    const handleError = () => {
      try {
        worker.removeEventListener("message", handleMessage);
        worker.removeEventListener("error", handleError);
        worker.terminate();
      } catch { /* worker shutdown is best-effort */ }
      if (analyticsWorkerRef.current === worker) analyticsWorkerRef.current = null;
      applyFallback();
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    // Rapid settings/navigation changes coalesce before structured cloning.
    // The worker needs seven song fields and playlist lengths, not URLs,
    // cover data, file paths, or full playlist ID arrays.
    const sendTimer = window.setTimeout(() => {
      if (cancelled) return;
      try {
        worker.postMessage({
          ...workerPayload,
          songs: songs.map(({ title, artist, album, duration, playCount, dateAdded, fileExists }) =>
            ({ title, artist, album, duration, playCount, dateAdded, fileExists })),
          playlists: undefined,
          playlistSongCounts: playlists.map(playlist => playlist.songIds.length)
        });
      } catch { handleError(); }
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(sendTimer);
      cancelFallback?.();
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
    };
  }, [
    ready, songs, likedCount, playlists, view,
    settings.discordEnabled, settings.discordPrivacyMode, settings.discordButtons,
    settings.discordArtMode, settings.discordActivityStyle, settings.startWithWindows,
    settings.minimizeToTray, settings.theme,
    settings.coverColorSyncMode, settings.compactPlayer,
    settings.reducedMotion, settings.crossfadeEnabled, settings.gaplessPlayback,
    settings.volumeNormalization, settings.perSongVolumeMemory, settings.playbackSpeed,
    isShuffle, repeatMode, downloadResultCount
  ]);

  useEffect(() => () => {
    try { analyticsWorkerRef.current?.terminate(); } catch { /* best-effort */ }
    analyticsWorkerRef.current = null;
  }, []);

  useEffect(() => {
    if (!ready || !analyticsAudienceSnapshotReady || !isLocaltifyAnalyticsConfigured()) return;
    const cancel = runIdleTask(() => {
      trackAudienceSnapshot(analyticsAudienceSnapshot);
      trackMarketingSnapshot(analyticsAudienceSnapshot);
      trackPlaylistSnapshot({
        playlist_count: Number(analyticsAudienceSnapshot.playlist_count || 0),
        playlist_song_total: Number(analyticsAudienceSnapshot.playlist_song_total || 0),
        has_playlists: Boolean(analyticsAudienceSnapshot.has_playlists),
        user_stage: String(analyticsAudienceSnapshot.user_stage || "new_no_library"),
        audience_segment: String(analyticsAudienceSnapshot.audience_segment || "new_local_music_user")
      });
    }, 2600);
    return cancel;
  }, [ready, analyticsAudienceSnapshotReady, analyticsAudienceSnapshot]);

  return { analyticsAudienceSnapshot, analyticsAudienceSnapshotReady };
}
