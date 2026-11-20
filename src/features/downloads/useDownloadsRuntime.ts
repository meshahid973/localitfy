import { useCallback, useEffect, useRef, useState } from "react";
import type { Song } from "../library/song.types";
import type { Settings } from "../settings/settings.types";
import type { AppToastKind, View } from "../shell/view.types";
import { applyLibraryOrder } from "../library/library.utils";
import { sanitizeSongList } from "../search/search.utils";
import { downloadAudioOptions } from "./download.selectors";
import { useStableCallback } from "../../shared/hooks/useStableCallback";
import type { DownloadQueueItem, DownloadResult, DownloadRetryItem, SpotifyTrack } from "./download.types";
import {
  enrichDownloadResultsWithLibraryMatches,
  formatSpotifyPrivatePlaylistMessage,
  friendlyDownloadError,
  mergeDownloadProgress,
  retryDownloadsInOrder, makeQueuedDownloads, parseDownloadUrls
} from "./downloadProcessing";

export type DownloadsTab = "youtube" | "spotify";

export type DownloadsRuntimeOptions = {
  ready: boolean;
  songs: Song[];
  setStatusText: (message: string) => void;
  setPlayerError: (message: string) => void;
  settingsRef: {current:Settings};
  currentId: string;
  setCurrentId: (id:string)=>void;
  rememberCurrentSong: (id:string)=>Promise<void>;
  setSongs: (songs:Song[])=>void;
  setLibraryScanMessage: (message:string)=>void;
  changeView: (view:View,source?:"nav"|"onboarding"|"settings"|"unknown")=>void;
  updateSetting: <K extends keyof Settings>(key:K,value:Settings[K],debounce?:boolean)=>Promise<void>;
  showAppToast: (message:string,kind?:AppToastKind)=>void;
  upsertSpotifyPlaylistFromImport: (name:string,songs:Song[])=>string|null;
  clearPlaybackCaches: ()=>void;
};

export function useDownloadsRuntime({ ready, songs, setStatusText, setPlayerError, settingsRef, currentId, setCurrentId, rememberCurrentSong, setSongs, setLibraryScanMessage, changeView, updateSetting, showAppToast, upsertSpotifyPlaylistFromImport, clearPlaybackCaches }: DownloadsRuntimeOptions) {
  const operation = useRef(false);
  const retryController = useRef<AbortController | null>(null);
  const beginDownloadOperation = useCallback(() => {
    if (operation.current) return false;
    operation.current = true;
    return true;
  }, []);
  const endDownloadOperation = useCallback(() => { operation.current = false; }, []);
  const cancelDownloadRetries = useCallback(() => { retryController.current?.abort(); }, []);
  const retryDownloads = useCallback(async (items: DownloadRetryItem[], retry: (item: DownloadRetryItem) => Promise<unknown>) => {
    if (operation.current || retryController.current) return;
    const controller = new AbortController();
    retryController.current = controller;
    try { await retryDownloadsInOrder(items, retry, controller.signal); }
    catch (error) { setPlayerError(`Could not retry downloads: ${String(error)}`); }
    finally { if (retryController.current === controller) retryController.current = null; }
  }, [setPlayerError]);
  useEffect(() => () => { retryController.current?.abort(); }, []);
  const songsRef = useRef(songs);
  useEffect(() => { songsRef.current = songs; }, [songs]);
  const [downloadText, setDownloadText] = useState("");
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [downloadResults, setDownloadResults] = useState<DownloadResult[]>([]);
  const [downloadQueue, setDownloadQueue] = useState<DownloadQueueItem[]>([]);
  const [downloadFolderLabel, setDownloadFolderLabel] = useState("");



  useEffect(() => {
    if (!ready || !window.localitfy?.getDownloadJobs) return;
    let cancelled = false;
    void window.localitfy.getDownloadJobs().then(({ jobs, error }) => {
      if (cancelled) return;
      if (error) setPlayerError(error);
      const completed = enrichDownloadResultsWithLibraryMatches(jobs.filter(item => item.status === "done").map(item => ({ ...item, ok: true })), songsRef.current);
      const byId = new Map(completed.map(item => [item.recoveryId, item]));
      const restored = jobs.map(item => item.status === "done" ? { ...item, ...byId.get(item.recoveryId) } : item);
      setDownloadQueue(current => {
        const ids = new Set(current.map(item => item.recoveryId || item.id));
        return [...current, ...restored.filter(item => !ids.has(item.id) && !current.some(active => active.url === item.url))];
      });
    }).catch(error => { if (!cancelled) setPlayerError(`Could not restore downloads: ${String(error)}`); });
    return () => { cancelled = true; };
  }, [ready, setPlayerError]);

  const [convertBusy, setConvertBusy] = useState(false);
  const [convertProgress, setConvertProgress] = useState(0);
  const [convertMessage, setConvertMessage] = useState("");

  useEffect(() => window.localitfy.onDownloadProgress(payload => {
    if (payload.type === "convert") {
      const percent = Number(payload.progress ?? 0);
      setConvertProgress(Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0);
      setConvertMessage(payload.message || "Converting...");
    } else setDownloadQueue(current => mergeDownloadProgress(current, payload));
  }), []);


  const [downloadsTab, setDownloadsTab] = useState<DownloadsTab>("youtube");
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [spotifyTracks, setSpotifyTracks] = useState<SpotifyTrack[]>([]);
  const [spotifySourceName, setSpotifySourceName] = useState("");
  const [spotifySourceType, setSpotifySourceType] = useState("");
  const [spotifyFetchBusy, setSpotifyFetchBusy] = useState(false);
  const [spotifyFetchError, setSpotifyFetchError] = useState("");
  const [spotifySelectedIds, setSpotifySelectedIds] = useState<Set<string>>(() => new Set());
  const [spotifyDownloadBusy, setSpotifyDownloadBusy] = useState(false);
  const [spotifyLoggedIn, setSpotifyLoggedIn] = useState(false);
  const [spotifyConnectionReady, setSpotifyConnectionReady] = useState(true);
  const [spotifyNeedsClientId, setSpotifyNeedsClientId] = useState(false);
  const [spotifyConnectionMode, setSpotifyConnectionMode] = useState("oauth-pkce");
  const [spotifyRedirectUri, setSpotifyRedirectUri] = useState("http://127.0.0.1:43877/spotify/callback");
  const [spotifyLoginBusy, setSpotifyLoginBusy] = useState(false);

  const updateSpotifyConnectionState = useCallback((res: any = {}) => {
    const hasReadyValue = Object.prototype.hasOwnProperty.call(res || {}, "ready") || Object.prototype.hasOwnProperty.call(res || {}, "ok");
    const fallbackAvailable = Boolean(res?.fallbackAvailable || res?.publicOnly || res?.mode === "public-fallback");
    const connectionReady = hasReadyValue ? Boolean(res?.ready ?? res?.ok ?? fallbackAvailable) : true;
    const loggedIn = Boolean(res?.loggedIn);
    const needsClientId = Boolean(res?.needsClientId) && !fallbackAvailable;

    setSpotifyConnectionReady(connectionReady || fallbackAvailable);
    setSpotifyNeedsClientId(needsClientId);
    setSpotifyConnectionMode(String(res?.mode || (fallbackAvailable ? "public-fallback" : "oauth-pkce")));
    if (res?.redirectUri) setSpotifyRedirectUri(String(res.redirectUri));
    setSpotifyLoggedIn(loggedIn || Boolean(res?.ok && fallbackAvailable));

    return {
      ready: connectionReady || fallbackAvailable,
      loggedIn: loggedIn || Boolean(res?.ok && fallbackAvailable),
      fallbackAvailable
    };
  }, []);

  useEffect(() => {
    if (downloadsTab !== "spotify" || !ready) return;

    let cancelled = false;

    Promise.resolve((window.localitfy as any).spotifyCheck?.())
      .then((res: any) => {
        if (cancelled) return;
        updateSpotifyConnectionState(res || { ready: true, loggedIn: false, mode: "oauth-pkce" });
      })
      .catch(() => {
        if (cancelled) return;
        setSpotifyConnectionReady(true);
        setSpotifyNeedsClientId(false);
        setSpotifyConnectionMode("oauth-pkce");
        setSpotifyLoggedIn(false);
      });

    return () => {
      cancelled = true;
    };
  }, [downloadsTab, ready, updateSpotifyConnectionState]);

  async function handleSpotifyLogin() {
    if (spotifyLoginBusy) return;

    setSpotifyLoginBusy(true);
    setSpotifyFetchError("");
    setStatusText("opening spotify login...");

    try {
      const bridge = (window.localitfy as any);
      if (!bridge?.spotifyLogin) {
        setSpotifyFetchError("Spotify login is unavailable in this build.");
        setStatusText("spotify login unavailable");
        return;
      }

      const res = await bridge.spotifyLogin();
      const state = updateSpotifyConnectionState(res || {});

      if (!res?.ok && !state.loggedIn && !state.fallbackAvailable) {
        const message = res?.needsClientId
          ? "Spotify connection is unavailable in this build. You can still retry with a public Spotify link when public import is available."
          : res?.error || "Spotify login cancelled.";
        setSpotifyFetchError(message);
        setStatusText(res?.cancelled ? "spotify login cancelled" : "spotify connection failed");
      } else {
        setSpotifyFetchError("");
        setStatusText(state.fallbackAvailable && !res?.loggedIn ? "spotify public import ready — paste a link" : "spotify connected — paste a link to fetch tracks");
      }
    } catch (error) {
      const message = String((error as Error)?.message || "Spotify login failed.");
      setSpotifyFetchError(message);
      setStatusText(/cancel/i.test(message) ? "spotify login cancelled" : "spotify connection failed");
    } finally {
      setSpotifyLoginBusy(false);
    }
  }

  async function handleSpotifyLogout() {
    try {
      const res = await (window.localitfy as any).spotifyLogout?.();
      updateSpotifyConnectionState(res || { ready: true, loggedIn: false, mode: "oauth-pkce" });
    } catch {
      setSpotifyConnectionReady(true);
      setSpotifyNeedsClientId(false);
      setSpotifyLoggedIn(false);
    }

    setSpotifyTracks([]);
    setSpotifySelectedIds(new Set());
    setSpotifyUrl("");
    setSpotifyFetchError("");
    setStatusText("disconnected from spotify");
  }

  async function fetchSpotifyTracks() {
    const cleanUrl = spotifyUrl.trim();
    if (!cleanUrl) return;

    setSpotifyFetchBusy(true);
    setSpotifyFetchError("");
    setSpotifyTracks([]);
    setSpotifySelectedIds(new Set());
    setSpotifySourceName("");
    setSpotifySourceType("");
    setPlayerError("");
    setStatusText("fetching spotify tracks...");

    try {
      const bridge = (window.localitfy as any);
      const checkRes = await Promise.resolve(bridge?.spotifyCheck?.()).catch(() => null);
      if (checkRes) {
        const connection = updateSpotifyConnectionState(checkRes);
        if ((!connection.ready || checkRes?.needsClientId) && !connection.fallbackAvailable) {
          const message = "Spotify public import is unavailable in this build. Try Connect Spotify or retry later.";
          setSpotifyFetchError(message);
          setStatusText("spotify setup needed");
          return;
        }
      }

      const spotifyFetchBridge = bridge?.spotifyFetch || bridge?.spotifyFetchTracks;
      if (!spotifyFetchBridge) {
        setSpotifyFetchError("Spotify import is unavailable in this build.");
        setStatusText("spotify fetch unavailable");
        return;
      }

      const result = bridge?.spotifyFetch
        ? await spotifyFetchBridge({ url: cleanUrl })
        : await spotifyFetchBridge(cleanUrl);

      if (result?.loggedIn !== undefined || result?.ready !== undefined || result?.mode) {
        updateSpotifyConnectionState(result);
      }

      if (result?.error) {
        const message = formatSpotifyPrivatePlaylistMessage(result.error, result.hint);
        setSpotifyFetchError(message);
        setStatusText(/public|private|profile/i.test(message) ? "spotify playlist not public" : "spotify fetch failed");
        return;
      }

      if (!result || !Array.isArray(result.tracks) || !result.tracks.length) {
        setSpotifyFetchError("No tracks found. Make sure the link is a public Spotify playlist, album, or track.");
        setStatusText("no spotify tracks found");
        return;
      }

      const tracks: SpotifyTrack[] = result.tracks.map((t: SpotifyTrack, i: number) => ({
        ...t,
        id: t.id || `spt_${i}`,
        title: (t.title || (t as any).name || "unknown track").trim(),
        artist: (t.artist || (t as any).artists || "").trim(),
        albumName: (t.albumName || (t as any).album || "").trim(),
        coverUrl: (t.coverUrl || (t as any).spotifyCoverUrl || (t as any).albumCoverUrl || "").trim(),
        spotifyUrl: String((t as any).spotifyUrl || "").trim(),
        isrc: String((t as any).isrc || "").trim(),
        durationMs: Number((t as any).durationMs || 0) || undefined
      }));

      const sourceName = String(result.playlistName || result.name || result.title || "").trim();
      const sourceType = String(result.type || "").trim();
      const finalSourceType = sourceType || (tracks.length === 1 ? "track" : "playlist");

      setSpotifySourceName(sourceName || (finalSourceType === "album" ? "Spotify Album" : finalSourceType === "track" ? "Spotify Track" : "Spotify Playlist"));
      setSpotifySourceType(finalSourceType);
      setSpotifyTracks(tracks);
      setSpotifySelectedIds(new Set(tracks.map((t) => t.id)));
      setSpotifyFetchError("");
      setStatusText(`fetched ${tracks.length} track${tracks.length !== 1 ? "s" : ""} from spotify`);
    } catch (error) {
      const message = formatSpotifyPrivatePlaylistMessage(String((error as Error)?.message || "Failed to fetch Spotify tracks."));
      setSpotifyFetchError(message);
      setStatusText(/public|private|profile/i.test(message) ? "spotify playlist not public" : "spotify fetch failed");
      console.error("[localtify spotify fetch failed]", error);
    } finally {
      setSpotifyFetchBusy(false);
    }
  }

  const syncDownloadFilesToQueue = useCallback((results: DownloadResult[], librarySongs: Song[] = songs) => {
    if (!results.length) return;

    const enrichedResults = enrichDownloadResultsWithLibraryMatches(results, librarySongs);

    setDownloadQueue((current) => {
      const next = [...current];
      enrichedResults.forEach((result) => {
        const resultSpotifyTrackId = String(result.spotifyTrackId || "").trim();
        const index = result.recoveryId
          ? next.findIndex(item => item.recoveryId === result.recoveryId)
          : next.findIndex(item => !item.recoveryId && (
              Boolean(resultSpotifyTrackId && item.spotifyTrackId === resultSpotifyTrackId) ||
              Boolean(result.url && item.url === result.url) || Boolean(result.filePath && item.filePath === result.filePath)
            ));

        if (index === -1) return;

        next[index] = {
          ...next[index],
          recoveryId: result.recoveryId || next[index].recoveryId,
          status: result.status || (result.ok ? "done" : "failed"),
          progress: 100,
          message: result.ok
            ? result.importedToLibrary
              ? "Added to library"
              : "Downloaded, but not imported"
            : friendlyDownloadError(result.error || "Download failed."),
          filePath: result.filePath,
          filename: result.filename,
          error: result.ok ? "" : friendlyDownloadError(result.error || "Download failed."),
          importedToLibrary: result.importedToLibrary,
          librarySongId: result.librarySongId,
          statusLabel: result.statusLabel,
          spotifyTrackId: result.spotifyTrackId || next[index].spotifyTrackId,
          spotifyUrl: result.spotifyUrl || next[index].spotifyUrl,
          providerUrl: result.providerUrl || next[index].providerUrl,
          matchScore: result.matchScore,
          title: result.filename || next[index].title
        };
      });
      return next;
    });
  }, [songs]);

  const chooseInitialSong = useStableCallback(async (nextSongs: Song[]) => {
    if (currentId || !nextSongs.length) return;
    setCurrentId(nextSongs[0].id);
    await rememberCurrentSong(nextSongs[0].id);
  });

  async function resolveLibrarySnapshot(snapshot: unknown, changed: boolean): Promise<Song[]> {
    if (Array.isArray(snapshot)) return applyLibraryOrder(sanitizeSongList(snapshot));
    if (changed && window.localitfy?.bootstrap) {
      try {
        const refreshed = await window.localitfy.bootstrap();
        if (Array.isArray(refreshed?.songs)) return applyLibraryOrder(sanitizeSongList(refreshed.songs));
      } catch (error) { console.warn("[localtify download library refresh failed]", error); }
      showAppToast("Library refresh incomplete. Existing tracks have been preserved.", "error");
    }
    return songsRef.current;
  }

  async function clearFailedDownloads() {
    const statuses = new Set(["failed", "cancelled", "interrupted"]);
    const selected = downloadQueue.filter(item => statuses.has(item.status));
    const ids = new Set(selected.map(item => item.id));
    try { await window.localitfy.clearDownloadJobs(selected.flatMap(item => item.recoveryId ? [item.recoveryId] : [])); }
    catch (error) { setPlayerError(String(error)); return; }
    setDownloadQueue((items) => items.filter((item) => !ids.has(item.id)));
    setDownloadResults((items) => items.filter((item: any) => item.ok));
    setSpotifyTracks((items) => items.map((track: any) => (
      track.downloadStatus === "failed"
        ? { ...track, downloadStatus: "ready", downloadError: "", downloadMessage: "Ready" }
        : track
    )));
    setSpotifyFetchError("");
    setStatusText("cleared failed downloads");
    showAppToast("cleared failed downloads", "success");
  }

  async function clearFinishedDownloads() {
    const selected = downloadQueue.filter(item => item.status === "done");
    const ids = new Set(selected.map(item => item.id));
    try { await window.localitfy.clearDownloadJobs(selected.flatMap(item => item.recoveryId ? [item.recoveryId] : [])); }
    catch (error) { setPlayerError(String(error)); return; }
    setDownloadQueue((items) => items.filter((item) => !ids.has(item.id)));
    setDownloadResults((items) => items.filter((item: any) => !item.ok));
    setStatusText("cleared finished downloads");
    showAppToast("cleared finished downloads", "success");
  }

  function openDownloadedSongInLibrary(item: DownloadResult | DownloadQueueItem) {
    const filePath = "filePath" in item ? item.filePath : undefined;
    if (!filePath) {
      changeView("library", "unknown");
      return;
    }

    const match = songsRef.current.find((song) => song.filePath === filePath);
    if (match) {
      setCurrentId(match.id);
      void rememberCurrentSong(match.id);
      changeView("library", "unknown");
      setStatusText("opened downloaded song in library");
    } else {
      changeView("library", "unknown");
      setStatusText("download is saved, but auto-add is off");
    }
  }

  async function chooseDownloadFolder() {
    try {
      const result = await window.localitfy.chooseDownloadFolder?.();
      if (!result || result.canceled || !result.folder) return;
      await updateSetting("downloadFolder", result.folder);
      setDownloadFolderLabel(result.folder);
      showAppToast("download folder updated", "success");
    } catch (error) {
      console.error("[localtify choose download folder failed]", error);
      showAppToast("could not choose download folder", "error");
    }
  }

  async function cancelCurrentDownload() {
    cancelDownloadRetries();
    try {
      await window.localitfy.cancelDownload?.();
      setStatusText(convertBusy ? "Cancelling conversion…" : "Cancelling downloads…");
      setDownloadQueue((current) => current.map((item) => (
        item.status === "queued" || item.status === "downloading" || item.status === "converting"
          ? { ...item, status: "cancelled", progress: item.progress, message: "Download cancelled" }
          : item
      )));
    } catch (error) {
      console.error("[localtify cancel download failed]", error);
      showAppToast("could not cancel download", "error");
    }
  }

  async function retryDownload(url: string, source: "youtube" | "spotify" | "auto" = "auto", spotifyTrackId = "", recoveryId?: string) {
    if (!url) {
      showAppToast("No URL saved for this failed item", "error");
      return;
    }

    setStatusText("retrying failed download...");
    showAppToast("retrying failed download", "info");

    if (recoveryId) {
      await downloadAudioLinks(url, recoveryId);
      return;
    }

    if (source === "spotify" || url.startsWith("spotify:")) {
      const track = spotifyTracks.find((item: any) => item.id === spotifyTrackId) ||
        spotifyTracks.find((item: any) => url.toLowerCase().includes(String(item.title || "").toLowerCase()));
      if (track) {
        await downloadSpotifyTracks([track]);
        return;
      }

      setDownloadsTab("spotify");
      setSpotifyFetchError("Could not match this failed queue item back to a Spotify track. Fetch the playlist again, then retry the track.");
      return;
    }

    setDownloadText(url);
    await downloadAudioLinks(url);
  }

  async function retrySpotifyTrack(track: SpotifyTrack) {
    if (!track?.id) return;
    await downloadSpotifyTracks([track]);
  }

  async function downloadAudioLinks(overrideText?: string, recoveryId?: string) {
    const settings = settingsRef.current;
    const urls = parseDownloadUrls(overrideText || downloadText);

    if (!urls.length && !recoveryId) {
      setPlayerError("paste at least one YouTube link first");
      setStatusText("nothing to download");
      return;
    }

    if (!beginDownloadOperation()) return;
    setDownloadBusy(true);
    setConvertBusy(false);
    setConvertProgress(0);
    setConvertMessage("");
    setPlayerError("");
    setStatusText("downloading audio...");
    if (recoveryId) setDownloadQueue(items => items.map(item => item.recoveryId === recoveryId ? { ...item, status: "queued", statusLabel: "", error: "", message: "Resuming download" } : item));
    else setDownloadQueue(items => [...items.filter(item => item.recoveryId || !urls.includes(item.url)), ...makeQueuedDownloads(urls)]);

    try {
      const result = recoveryId ? await window.localitfy.resumeDownloadJob(recoveryId) : await window.localitfy.downloadAudioUrls({
        urls,
        options: { ...downloadAudioOptions(settings), cleanTitle: settings.downloadCleanTitle }
      });

      const autoAdd = result.autoAdd ?? settings.downloadAutoAdd;
      const downloads = result.downloads || [];
      const successCount = downloads.filter((item) => item.ok).length;
      const failCount = downloads.filter((item) => !item.ok).length;

      const nextSongs = await resolveLibrarySnapshot(result.songs, successCount > 0 || Number(result.changedCount || 0)>0);

      const enrichedDownloads = enrichDownloadResultsWithLibraryMatches(downloads, nextSongs);
      setDownloadResults(enrichedDownloads);
      syncDownloadFilesToQueue(enrichedDownloads, nextSongs);
      setDownloadFolderLabel(result.downloadFolder || settings.downloadFolder || "");
      clearPlaybackCaches();
      setSongs(nextSongs);
      setLibraryScanMessage(`library refreshed: ${nextSongs.length} tracks`);
      await chooseInitialSong(nextSongs);

      if (successCount > 0) {
        const importedCount = enrichedDownloads.filter((item: any) => item.ok && item.importedToLibrary).length;
        const notImportedCount = enrichedDownloads.filter((item: any) => item.ok && !item.importedToLibrary).length;
        setStatusText(
          autoAdd
            ? notImportedCount > 0
              ? `downloaded ${successCount}; ${notImportedCount} not imported`
              : `downloaded ${successCount} and added ${importedCount || result.changedCount || successCount} to library`
            : `downloaded ${successCount} file${successCount === 1 ? "" : "s"}`
        );
        showAppToast(
          notImportedCount > 0
            ? `${notImportedCount} downloaded file${notImportedCount === 1 ? "" : "s"} not imported`
            : `added ${importedCount || successCount} to library`,
          notImportedCount > 0 ? "info" : "success"
        );
        if (autoAdd) changeView("library", "unknown");
      } else {
        setStatusText("download failed");
        setPlayerError("no audio files downloaded. check the results below.");
      }

      if (failCount > 0) {
        console.warn("[localitfy download partial failures]", downloads);
      }
    } catch (error) {
      console.error("[localitfy download failed]", error);
      const message = friendlyDownloadError((error as Error)?.message || "Download failed.");
      const failedDownloads = urls.map((url) => ({
        ok: false,
        url,
        error: message,
        statusLabel: "Failed — retry available"
      })) as any[];

      setDownloadResults(failedDownloads);
      setDownloadQueue((items) => items.map((item) => (recoveryId ? item.recoveryId === recoveryId : !item.recoveryId && urls.includes(item.url)) ? ({
        ...item,
        status: "failed",
        progress: 100,
        message,
        error: message,
        statusLabel: "Failed — retry available"
      }) : item));
      setPlayerError(message);
      setStatusText("download failed");
      showAppToast("Download failed — retry from the queue", "error");
    } finally {
      setDownloadBusy(false);
      endDownloadOperation();
    }
  }

  async function downloadSpotifyTracks(trackOverride?: SpotifyTrack[]) {
    const settings = settingsRef.current;
    const selected = Array.isArray(trackOverride) && trackOverride.length
      ? trackOverride
      : spotifyTracks.filter((t) => spotifySelectedIds.has(t.id));
    if (!selected.length || !beginDownloadOperation()) return;

    const selectedIds = new Set(selected.map(track=>track.id));
    if (Array.isArray(trackOverride) && trackOverride.length) {
      setSpotifySelectedIds(new Set(trackOverride.map((track) => track.id)));
    }

    setSpotifyDownloadBusy(true);
    setDownloadBusy(true);
    setDownloadResults([]);
    setPlayerError("");
    setSpotifyFetchError("");
    setSpotifyTracks((items) => items.map((track: any) => (
      selectedIds.has(track.id)
        ? { ...track, downloadStatus: "queued", downloadError: "", downloadMessage: "Queued" }
        : track
    )));
    setDownloadQueue(items => [
      ...items.filter(item => item.recoveryId || !selectedIds.has(item.spotifyTrackId || "")),
      ...selected.map((t, i) => ({
        id: `spt_${t.id}_${i}`,
        spotifyTrackId: t.id,
        source: "spotify",
        url: (t as any).spotifyUrl || `spotify:track:${t.id}`,
        title: t.artist ? `${t.artist} — ${t.title}` : t.title,
        status: "queued" as const,
        progress: 0,
        message: "Waiting..."
      }))
    ]);
    setStatusText(`downloading ${selected.length} track${selected.length !== 1 ? "s" : ""} from spotify...`);

    try {
      const bridge = (window.localitfy as any);
      const spotifyDownloadBridge = bridge?.spotifyDownloadBatch || bridge?.spotdlDownloadBatch;
      if (!spotifyDownloadBridge) {
        const message = "Spotify downloading is unavailable in this build.";
        setSpotifyFetchError(message);
        setDownloadQueue((items) => items.map((item) => !item.recoveryId && selectedIds.has(item.spotifyTrackId || "") ? ({ ...item, status: "failed", progress: 100, message, error: message, statusLabel: "Failed — retry available" }) : item));
        setStatusText("spotify download failed");
        showAppToast("Spotify download bridge missing", "error");
        return;
      }

      const result = await spotifyDownloadBridge({
        tracks: selected.map((t) => ({
          id: t.id,
          title: t.title,
          artist: t.artist,
          albumName: t.albumName,
          coverUrl: t.coverUrl || (t as any).spotifyCoverUrl || (t as any).albumCoverUrl || "",
          spotifyUrl: (t as any).spotifyUrl || "",
          isrc: (t as any).isrc || "",
          duration: t.duration,
          durationMs: (t as any).durationMs
        })),
        sourceName: spotifySourceName,
        sourceType: spotifySourceType,
        options: {
          ...downloadAudioOptions(settings),
          sourceName: spotifySourceName,
          sourceType: spotifySourceType
        }
      });

      if (!result) throw new Error("No Spotify download result returned.");
      if (result) {
        setDownloadFolderLabel(result.downloadFolder || settings.downloadFolder || "");

        const downloads = result.downloads || [];
        const successCount = downloads.filter((d: DownloadResult) => d.ok).length;
        const failCount = downloads.filter((d: DownloadResult) => !d.ok).length;

        const nextSongs = await resolveLibrarySnapshot(result.songs,successCount>0 || Number(result.changedCount||0)>0);

        const enrichedDownloads = enrichDownloadResultsWithLibraryMatches(downloads, nextSongs);
        setDownloadResults(enrichedDownloads);
        syncDownloadFilesToQueue(enrichedDownloads, nextSongs);

        const enrichedDownloadsBySpotifyId = new Map(
          enrichedDownloads
            .map((item: DownloadResult): [string, DownloadResult] => [String(item.spotifyTrackId || "").trim(), item])
            .filter(([id]) => Boolean(id))
        );
        const rawDownloadsBySpotifyId = new Map(
          downloads
            .map((item: DownloadResult): [string, DownloadResult] => [String(item.spotifyTrackId || "").trim(), item])
            .filter(([id]) => Boolean(id))
        );

        setSpotifyTracks((items) => items.map((track: any) => {
          if (!selectedIds.has(track.id)) return track;

          const resultForTrack: any =
            enrichedDownloadsBySpotifyId.get(String(track.id || "").trim()) ||
            rawDownloadsBySpotifyId.get(String(track.id || "").trim()) ||
            null;
          if (!resultForTrack) {
            return {
              ...track,
              downloadStatus: "failed",
              downloadError: "No result returned for this track.",
              downloadMessage: "No result returned"
            };
          }

          return {
            ...track,
            downloadStatus: resultForTrack.ok ? "done" : "failed",
            downloadError: resultForTrack.ok ? "" : friendlyDownloadError(resultForTrack.error || "Spotify download failed."),
            downloadMessage: resultForTrack.ok
              ? resultForTrack.importedToLibrary
                ? "Added to library"
                : "Downloaded, not imported"
              : "Failed — retry available",
            downloadedFilePath: resultForTrack.filePath || "",
            importedToLibrary: Boolean(resultForTrack.importedToLibrary),
            librarySongId: resultForTrack.librarySongId || "",
            matchScore: resultForTrack.matchScore,
            providerUrl: resultForTrack.providerUrl || ""
          };
        }));

        setSongs(nextSongs);

        if (settings.downloadAutoAdd && successCount > 0) {
          const exactImportedIds = Array.from(
            new Set<string>(
              Array.isArray(result.spotifyImportedSongIds)
                ? result.spotifyImportedSongIds.map((id: unknown) => String(id || "").trim()).filter(Boolean)
                : []
            )
          );

          const playlistName =
            spotifySourceName ||
            result.spotifySourceName ||
            result.playlistName ||
            result.name ||
            (spotifySourceType === "album" ? "Spotify Album" : "Spotify Playlist");

          if (!exactImportedIds.length) {
            const message = "Spotify import finished, but the backend did not return exact song IDs. Playlist creation skipped to avoid adding random songs.";
            setSpotifyFetchError(message);
            showAppToast(message, "error");
            console.warn("[localtify spotify playlist skipped]", { reason: "missing exact imported song ids", result });
          } else {
            const songsById = new Map(nextSongs.map((song) => [song.id, song]));
            const importedSpotifySongs = exactImportedIds
              .map((id) => songsById.get(id))
              .filter((song): song is Song => Boolean(song));

            if (!importedSpotifySongs.length) {
              const message = "Spotify import finished, but the imported songs were not found after library refresh. Playlist creation skipped.";
              setSpotifyFetchError(message);
              showAppToast(message, "error");
              console.warn("[localtify spotify playlist skipped]", { reason: "imported ids missing after refresh", exactImportedIds });
            } else {
              if (importedSpotifySongs.length !== exactImportedIds.length) {
                console.warn("[localtify spotify playlist partial id match]", {
                  expected: exactImportedIds.length,
                  matched: importedSpotifySongs.length,
                  exactImportedIds
                });
              }

              upsertSpotifyPlaylistFromImport(playlistName, importedSpotifySongs);
            }
          }
        }
        await chooseInitialSong(nextSongs);

        if (successCount > 0) {
          const importedCount = enrichedDownloads.filter((item: any) => item.ok && item.importedToLibrary).length;
          const notImportedCount = enrichedDownloads.filter((item: any) => item.ok && !item.importedToLibrary).length;
          setStatusText(
            failCount > 0
              ? `spotify finished: ${successCount} done, ${failCount} failed`
              : notImportedCount > 0
                ? `spotify finished: ${successCount} downloaded, ${notImportedCount} not imported`
                : `spotify finished: ${importedCount || successCount} added to library`
          );
          showAppToast(
            failCount > 0
              ? `Spotify: ${successCount} done, ${failCount} failed`
              : `Spotify added ${importedCount || successCount} to library`,
            failCount > 0 ? "info" : "success"
          );
          if (settings.downloadAutoAdd && nextSongs.length) changeView("library", "unknown");
        } else {
          setStatusText("spotify download finished — no tracks added");
          setPlayerError("no tracks downloaded. check the queue for errors.");
          showAppToast("Spotify download failed — retry from the queue", "error");
        }

        if (failCount > 0) {
          const firstFailure = enrichedDownloads.find((item: any) => !item.ok);
          setSpotifyFetchError(firstFailure ? friendlyDownloadError(firstFailure.error || "Some Spotify tracks failed.") : "Some Spotify tracks failed. Retry failed items from the queue.");
          console.warn("[localtify spotify partial failures]", enrichedDownloads);
        } else {
          setSpotifyFetchError("");
        }
      }
    } catch (error) {
      const message = friendlyDownloadError((error as Error)?.message || "Spotify download failed.");
      console.error("[localtify spotify download failed]", error);
      setSpotifyFetchError(message);
      setSpotifyTracks((items) => items.map((track: any) => (
        selectedIds.has(track.id)
          ? { ...track, downloadStatus: "failed", downloadError: message, downloadMessage: "Failed — retry available" }
          : track
      )));
      const failedDownloads = selected.map((track) => ({
        ok: false,
        url: (track as any).spotifyUrl || `spotify:track:${track.id}`,
        source: "spotify",
        spotifyTrackId: track.id,
        error: message,
        statusLabel: "Failed — retry available"
      })) as any[];
      setDownloadResults(failedDownloads);
      setDownloadQueue((items) => items.map((item) => !item.recoveryId && selectedIds.has(item.spotifyTrackId || "") ? ({
        ...item,
        status: "failed",
        progress: 100,
        message,
        error: message,
        statusLabel: "Failed — retry available"
      }) : item));
      setStatusText("spotify download failed");
      showAppToast("Spotify download failed — retry from the queue", "error");
    } finally {
      setSpotifyDownloadBusy(false);
      setDownloadBusy(false);
      endDownloadOperation();
    }
  }
  // ------------------------------------------------------------------------

  async function convertLocalMedia() {
    if (!beginDownloadOperation()) return;
    setConvertBusy(true);
    setConvertProgress(0);
    setConvertMessage("choose files to convert...");
    setPlayerError("");
    setStatusText("opening converter...");

    try {
      const result = await window.localitfy.pickAndConvertMedia({
        bitrate: 192
      });

      const conversions = result.conversions || [];
      if (!Array.isArray(result.songs)) throw new Error("Conversion results were incomplete. Reload the application before retrying.");
      const nextSongs = applyLibraryOrder(sanitizeSongList(result.songs || []));

      setSongs(nextSongs);
      setLibraryScanMessage(`library refreshed: ${nextSongs.length} tracks`);
      setDownloadResults(
        enrichDownloadResultsWithLibraryMatches(conversions.map((item) => ({
          ok: item.ok,
          source: "local",
          filename: item.filename,
          filePath: item.filePath,
          error: item.error,
          url: item.sourcePath
        })), nextSongs)
      );

      const successCount = conversions.filter((item) => item.ok).length;
      const failed = conversions.filter(item => !item.ok);
      const failure = failed.find(item => !/cancel/i.test(item.error || ""));
      if (failure) setPlayerError(failure.error || "Conversion failed");
      await chooseInitialSong(nextSongs);

      if (successCount > 0) {
        setConvertProgress(100);
        setConvertMessage(failed.length ? `converted ${successCount}; ${failed.length} failed or cancelled` : "conversion complete");
        setStatusText(
          `converted ${successCount} file${successCount === 1 ? "" : "s"} and imported ${result.changedCount}${failed.length ? `; ${failed.length} failed or cancelled` : ""}`
        );
        if (!failed.length) changeView("library", "unknown");
      } else if (failed.length) {
        setStatusText(failure ? "conversion failed" : "conversion cancelled");
        setConvertMessage(failure?.error || "Conversion cancelled");
      } else {
        setStatusText("nothing converted");
        setConvertMessage("no files converted");
      }
    } catch (error) {
      console.error("[localitfy convert failed]", error);
      setPlayerError((error as Error)?.message || "Conversion failed");
      setConvertMessage("conversion failed");
      setStatusText("conversion failed");
    } finally {
      setConvertBusy(false);
      endDownloadOperation();
    }
  }

  return {
    clearFailedDownloads, clearFinishedDownloads, openDownloadedSongInLibrary, chooseDownloadFolder, cancelCurrentDownload, retryDownload, retrySpotifyTrack, downloadAudioLinks, downloadSpotifyTracks, convertLocalMedia,
    beginDownloadOperation, endDownloadOperation, retryDownloads, cancelDownloadRetries,
    downloadText, setDownloadText,
    downloadBusy, setDownloadBusy,
    downloadResults, setDownloadResults,
    downloadQueue, setDownloadQueue,
    downloadFolderLabel, setDownloadFolderLabel,
    convertBusy, setConvertBusy,
    convertProgress, setConvertProgress,
    convertMessage, setConvertMessage,
    downloadsTab, setDownloadsTab,
    spotifyUrl, setSpotifyUrl,
    spotifyTracks, setSpotifyTracks,
    spotifySourceName, setSpotifySourceName,
    spotifySourceType, setSpotifySourceType,
    spotifyFetchBusy, setSpotifyFetchBusy,
    spotifyFetchError, setSpotifyFetchError,
    spotifySelectedIds, setSpotifySelectedIds,
    spotifyDownloadBusy, setSpotifyDownloadBusy,
    spotifyLoggedIn, setSpotifyLoggedIn,
    spotifyConnectionReady, setSpotifyConnectionReady,
    spotifyNeedsClientId, setSpotifyNeedsClientId,
    spotifyConnectionMode, setSpotifyConnectionMode,
    spotifyRedirectUri, setSpotifyRedirectUri,
    spotifyLoginBusy, setSpotifyLoginBusy,
    handleSpotifyLogin,
    handleSpotifyLogout,
    fetchSpotifyTracks,
    updateSpotifyConnectionState,
    syncDownloadFilesToQueue
  };
}
