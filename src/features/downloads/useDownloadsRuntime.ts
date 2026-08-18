import { useCallback, useEffect, useState } from "react";
import type { Song } from "../library/song.types";
import type { DownloadQueueItem, DownloadResult, SpotifyTrack } from "./download.types";

export type DownloadsTab = "youtube" | "spotify";

export type DownloadsRuntimeOptions = {
  ready: boolean;
  songs: Song[];
  setStatusText: (message: string) => void;
  setPlayerError: (message: string) => void;
};

export function parseDownloadUrls(text: string) {
  return text
    .split(/\r?\n|,/)
    .map((url) => url.trim())
    .filter(Boolean);
}

export function makeQueuedDownloads(urls: string[]): DownloadQueueItem[] {
  return urls.map((url, index) => ({
    id: `${Date.now()}-${index}`,
    url,
    title: `download ${index + 1}`,
    source: "youtube",
    status: "queued",
    progress: 0,
    message: "Queued..."
  }));
}

export function friendlyDownloadError(error: unknown, fallback = "Download failed. Try again or check the link.") {
  const raw = String(error || "").trim();
  const lowerMessage = raw.toLowerCase();

  if (!raw) return fallback;
  if (/invalid url|unsupported url|not a url|url/i.test(lowerMessage) && /invalid|unsupported|malformed|empty/.test(lowerMessage)) {
    return "Invalid URL. Paste a normal YouTube/Spotify link and retry.";
  }
  if (/yt-dlp|ytdlp|youtube-dl|no such file|not installed|spawn/.test(lowerMessage)) {
    return "yt-dlp could not run. Check the bundled downloader setup, then retry.";
  }
  if (/eacces|eperm|permission|access denied|forbidden|403|folder|directory|write|readonly|read-only/.test(lowerMessage)) {
    return "Permission or folder error. Choose a writable downloads folder and retry.";
  }
  if (/private|unavailable|not available|members-only|login|required|age restricted|sign in/.test(lowerMessage)) {
    return "This source looks private or unavailable. Try a public link.";
  }
  if (/copyright|blocked|restricted|region|geo/.test(lowerMessage)) {
    return "This source is blocked or region restricted.";
  }
  if (/network|timeout|timed out|socket|econn|dns|connection|internet|fetch failed/.test(lowerMessage)) {
    return "Network problem while downloading. Check your connection and retry.";
  }
  if (/rate|429|too many|captcha|bot/.test(lowerMessage)) {
    return "The source rate-limited or blocked the request. Wait a bit, then retry.";
  }
  if (/ffmpeg|convert|conversion/.test(lowerMessage)) {
    return "Downloaded, but conversion failed. Check FFmpeg/download setup.";
  }
  if (/no audio|audio only|format|no formats|requested format|unable to extract|extractor/.test(lowerMessage)) {
    return "No usable audio was found for this link.";
  }

  return raw.length > 170 ? `${raw.slice(0, 167)}...` : raw;
}

export function findDownloadedSongMatch(result: DownloadResult, librarySongs: Song[]) {
  const filePath = String(result.filePath || "").trim().toLowerCase();
  const filename = String(result.filename || "").trim().toLowerCase();
  const spotifyTrackId = String(result.spotifyTrackId || "").trim();

  if (spotifyTrackId) {
    const exactSpotify = librarySongs.find((song) => String((song as Song & { sourceTrackId?: string }).sourceTrackId || "").trim() === spotifyTrackId);
    if (exactSpotify) return exactSpotify;
  }

  if (filePath) {
    const exact = librarySongs.find((song) => String(song.filePath || "").trim().toLowerCase() === filePath);
    if (exact) return exact;
  }

  if (filename) {
    return librarySongs.find((song) => {
      const songPath = String(song.filePath || "").trim().toLowerCase();
      return songPath.endsWith(filename);
    }) || null;
  }

  return null;
}

export function enrichDownloadResultsWithLibraryMatches(results: DownloadResult[], librarySongs: Song[]) {
  return results.map((result) => {
    const match = result.ok ? findDownloadedSongMatch(result, librarySongs) : null;
    const importedToLibrary = Boolean(match);
    const cleanedError = result.ok ? "" : friendlyDownloadError(result.error || result.url || "Download failed.");

    return {
      ...result,
      importedToLibrary,
      librarySongId: match?.id || "",
      error: cleanedError || result.error,
      statusLabel: result.ok
        ? importedToLibrary
          ? "Added to library"
          : "Downloaded, not imported"
        : "Failed — retry available"
    } satisfies DownloadResult;
  });
}

export function formatSpotifyPrivatePlaylistMessage(rawMessage = "", hint = "") {
  const message = String(rawMessage || "Failed to fetch Spotify tracks.").trim();
  const cleanHint = String(hint || "").trim();
  const looksPrivate = /private|public|profile|could not read|could not expose|404|403|blocked/i.test(`${message} ${cleanHint}`);

  if (!looksPrivate) return cleanHint ? `${message}\n\nTip: ${cleanHint}` : message;

  return [
    "Spotify could not read this playlist.",
    "Make sure it is public on your Spotify profile, not only shareable by link.",
    "Open Spotify → playlist menu → add to profile / make public, then paste the link again."
  ].join("\n");
}

export function useDownloadsRuntime({ ready, songs, setStatusText, setPlayerError }: DownloadsRuntimeOptions) {
  const [downloadText, setDownloadText] = useState("");
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [downloadResults, setDownloadResults] = useState<DownloadResult[]>([]);
  const [downloadQueue, setDownloadQueue] = useState<DownloadQueueItem[]>([]);
  const [downloadFolderLabel, setDownloadFolderLabel] = useState("");

  const [convertBusy, setConvertBusy] = useState(false);
  const [convertProgress, setConvertProgress] = useState(0);
  const [convertMessage, setConvertMessage] = useState("");

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
  const [spotifyShowCookieInput, setSpotifyShowCookieInput] = useState(false);
  const [spotifyCookieDraft, setSpotifyCookieDraft] = useState("");

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
        setSpotifyFetchError("Spotify login is not wired in preload/main yet.");
        setStatusText("spotify login unavailable");
        return;
      }

      const res = await bridge.spotifyLogin();
      const state = updateSpotifyConnectionState(res || {});

      if (!res?.ok && !state.loggedIn && !state.fallbackAvailable) {
        const message = res?.needsClientId
          ? "Spotify public import fallback is not available in this build. Replace electron/main.cjs with the v315 Spotify public fallback file."
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

  async function handleSpotifySetCookie(sp_dc: string) {
    const value = sp_dc.trim();
    if (!value) return;

    setSpotifyLoginBusy(true);
    setSpotifyFetchError("");

    try {
      const bridge = (window.localitfy as any);
      if (!bridge?.spotifySetCookie) {
        setSpotifyFetchError("Spotify cookie login is not wired in preload/main yet.");
        return;
      }

      const res = await bridge.spotifySetCookie(value);
      updateSpotifyConnectionState(res || { ready: true, loggedIn: Boolean(res?.ok) });
      if (res?.ok) {
        setSpotifyShowCookieInput(false);
        setSpotifyCookieDraft("");
        setStatusText("connected to spotify");
      } else {
        setSpotifyFetchError(res?.error || "Invalid sp_dc cookie.");
      }
    } catch (error) {
      setSpotifyFetchError(String((error as Error)?.message || "Cookie save failed."));
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
    setSpotifyShowCookieInput(false);
    setSpotifyCookieDraft("");
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
          const message = "Spotify public import is not ready in this build. Replace electron/main.cjs with the v315 Spotify public fallback file.";
          setSpotifyFetchError(message);
          setStatusText("spotify setup needed");
          return;
        }
      }

      const spotifyFetchBridge = bridge?.spotifyFetch || bridge?.spotifyFetchTracks;
      if (!spotifyFetchBridge) {
        setSpotifyFetchError("Spotify fetch is not wired in preload/main yet.");
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
        const index = next.findIndex((item) =>
          (resultSpotifyTrackId && String(item.spotifyTrackId || "").trim() === resultSpotifyTrackId) ||
          item.url === result.url ||
          (result.filename && item.filename === result.filename) ||
          (result.filePath && item.filePath === result.filePath)
        );

        if (index === -1) return;

        next[index] = {
          ...next[index],
          status: result.ok ? "done" : "failed",
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

  return {
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
    spotifyShowCookieInput, setSpotifyShowCookieInput,
    spotifyCookieDraft, setSpotifyCookieDraft,
    handleSpotifyLogin,
    handleSpotifySetCookie,
    handleSpotifyLogout,
    fetchSpotifyTracks,
    updateSpotifyConnectionState,
    syncDownloadFilesToQueue
  };
}
