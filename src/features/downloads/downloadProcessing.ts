import type { Song } from "../library/song.types";
import type { DownloadQueueItem, DownloadResult, DownloadRetryItem, DownloadProgress } from "./download.types";

export function mergeDownloadProgress(current: DownloadQueueItem[], payload: DownloadProgress): DownloadQueueItem[] {
  const id = payload.id || payload.recoveryId || payload.url;
  if (!id) return current;
  const sameRequest = (item: DownloadQueueItem) => Boolean(payload.url && item.url === payload.url || payload.spotifyTrackId && item.spotifyTrackId === payload.spotifyTrackId);
  let index = current.findIndex(item => item.id === id || Boolean(payload.recoveryId && item.recoveryId === payload.recoveryId));
  if (index < 0) index = current.findIndex(item => !item.recoveryId && sameRequest(item));
  const previous = index >= 0 ? current[index] : undefined;
  const rawProgress = Number(payload.progress ?? payload.percent ?? 0);
  const progress = Number.isFinite(rawProgress) ? Math.max(0, Math.min(100, rawProgress)) : previous?.progress || 0;
  const status = payload.status || (progress >= 100 ? "done" : "downloading");
  const merged: DownloadQueueItem = {
    ...previous, id, recoveryId: payload.recoveryId || previous?.recoveryId,
    source: payload.source || previous?.source, spotifyTrackId: payload.spotifyTrackId || previous?.spotifyTrackId,
    url: previous?.source === "spotify" ? previous.url : payload.url || previous?.url || "",
    title: payload.file || payload.filename || previous?.title || "download",
    status, progress, message: payload.message || "working...", speed: payload.speed, eta: payload.eta,
    filePath: payload.filePath || previous?.filePath,
    filename: payload.filename || previous?.filename,
    importedToLibrary: payload.importedToLibrary ?? previous?.importedToLibrary,
    librarySongId: payload.librarySongId ?? previous?.librarySongId,
    error: ["failed", "cancelled", "interrupted"].includes(status) ? payload.error || previous?.error : undefined,
    statusLabel: payload.statusLabel || (status === previous?.status ? previous.statusLabel : undefined)
  };
  const placeholder = (item: DownloadQueueItem, position: number) => position !== index && Boolean(merged.recoveryId) && !item.recoveryId && sameRequest(item);
  const hasPlaceholder = current.some(placeholder);
  if (previous && !hasPlaceholder && Math.abs(previous.progress - progress) < 0.75 &&
      previous.status === merged.status && previous.message === merged.message && previous.title === merged.title &&
      previous.speed === merged.speed && previous.eta === merged.eta && previous.filename === merged.filename &&
      previous.error === merged.error && previous.recoveryId === merged.recoveryId && previous.source === merged.source && previous.spotifyTrackId === merged.spotifyTrackId &&
      previous.filePath === merged.filePath && previous.importedToLibrary === merged.importedToLibrary && previous.librarySongId === merged.librarySongId) return current;
  const next = current.map((item, position) => position === index ? merged : item).filter((item, position) => !placeholder(item, position));
  if (index < 0) next.push(merged);
  return next;
}

export function deduplicateDownloadRetries(items: readonly DownloadRetryItem[]) {
  const key = (item: DownloadRetryItem) => item.source === "local" ? "local:choose-files" : item.spotifyTrackId ? `spotify:${item.spotifyTrackId}` : parseDownloadUrls(item.url || "")[0] || "";
  const saved = new Set(items.filter(item => item.recoveryId).map(key));
  const seen = new Set<string>();
  return items.filter(item => {
    if (!item.url && item.source !== "local") return false;
    const identity = item.recoveryId ? `job:${item.recoveryId}` : `request:${key(item)}`;
    if (seen.has(identity) || !item.recoveryId && saved.has(key(item))) return false;
    seen.add(identity);
    return true;
  });
}

export async function retryDownloadsInOrder(items: readonly DownloadRetryItem[], retry: (item: DownloadRetryItem) => Promise<unknown>, signal: AbortSignal) {
  for (const item of deduplicateDownloadRetries(items)) {
    if (signal.aborted) return;
    await retry(item);
  }
}

export function parseDownloadUrls(text: string) {
  const urls = text.split(/\r?\n|,/).map(url => url.trim()).filter(Boolean);
  return [...new Set(urls.map(url => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) return url;
      const host = parsed.hostname.toLowerCase();
      const id = host === "youtu.be" ? /^\/([a-zA-Z0-9_-]{11})\/?$/.exec(parsed.pathname)?.[1] : ["youtube.com","www.youtube.com","m.youtube.com","music.youtube.com"].includes(host) && parsed.pathname === "/watch" ? parsed.searchParams.get("v") : null;
      return id && /^[\w-]{11}$/.test(id) ? `https://www.youtube.com/watch?v=${id}` : url;
    } catch { return url; }
  }))];
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

function downloadPathKey(value: string | undefined) {
  const text = String(value || "").trim();
  return /^[a-z]:[\\/]|^\\\\/i.test(text) ? text.replace(/\\/g, "/").toLowerCase() : text;
}

type DownloadSongLookup = {
  spotifyIds: Map<string, Song | null>;
  songIds: Map<string, Song>;
  filePaths: Map<string, Song>;
  basenames: Map<string, Song | null>;
};

/** Index exact files and uniquely identified recordings once per batch. */
export function buildDownloadSongLookup(librarySongs: readonly Song[]): DownloadSongLookup {
  const spotifyIds = new Map<string, Song | null>();
  const songIds = new Map<string, Song>();
  const filePaths = new Map<string, Song>();
  const basenames = new Map<string, Song | null>();
  for (const song of librarySongs) {
    const spotifyId = String((song as Song & { sourceTrackId?: string }).sourceTrackId || "").trim();
    const filePath = downloadPathKey(song.filePath);
    if (song.id) songIds.set(song.id, song);
    if (spotifyId) spotifyIds.set(spotifyId, spotifyIds.has(spotifyId) ? null : song);
    if (filePath && !filePaths.has(filePath)) filePaths.set(filePath, song);
    const name = filePath.split(/[\\/]/).pop();
    if (name) basenames.set(name, basenames.has(name) ? null : song);
  }
  return { spotifyIds, songIds, filePaths, basenames };
}

export function findDownloadedSongMatch(result: DownloadResult, librarySongs: Song[], lookup?: DownloadSongLookup) {
  const filePath = downloadPathKey(result.filePath);
  const filename = String(result.filename || "").trim();
  const spotifyTrackId = String(result.spotifyTrackId || "").trim();

  // Explicit downloaded file identity must win over another format of the same recording.
  const committedId = String(result.librarySongId || "").trim();
  const committed = committedId ? (lookup ? lookup.songIds.get(committedId) : librarySongs.find(song=>song.id===committedId)) : undefined;
  if (filePath) {
    if (committed && downloadPathKey(committed.filePath) === filePath) return committed;
    return (lookup ? lookup.filePaths.get(filePath) : librarySongs.find(song=>downloadPathKey(song.filePath)===filePath)) || null;
  }
  if (committed && (!spotifyTrackId || String(committed.sourceTrackId || "").trim()===spotifyTrackId)) return committed;
  if (spotifyTrackId) {
    if (lookup) return lookup.spotifyIds.get(spotifyTrackId) || null;
    const matches=librarySongs.filter(song=>String(song.sourceTrackId||"").trim()===spotifyTrackId);
    return matches.length===1 ? matches[0] : null;
  }

  if (filename) {
    if (lookup) return lookup.basenames.get(filename) || null;
    const matches = librarySongs.filter(song => downloadPathKey(song.filePath).split(/[\\/]/).pop() === filename);
    return matches.length === 1 ? matches[0] : null;
  }

  return null;
}

export function enrichDownloadResultsWithLibraryMatches(results: DownloadResult[], librarySongs: Song[]) {
  // All successful results share one index; failed results never require library work.
  const lookup = results.some((result) => result.ok) ? buildDownloadSongLookup(librarySongs) : undefined;
  return results.map((result) => {
    const match = result.ok ? findDownloadedSongMatch(result, librarySongs, lookup) : null;
    const importedToLibrary = Boolean(match);
    const cleanedError = result.ok ? "" : result.source === "local"
      ? String(result.error || "Conversion failed").slice(0, 300)
      : friendlyDownloadError(result.error || result.url || "Download failed.");

    return {
      ...result,
      importedToLibrary,
      librarySongId: match?.id || "",
      error: result.ok ? undefined : cleanedError || result.error,
      statusLabel: result.ok
        ? importedToLibrary
          ? "Added to library"
          : "Downloaded, not imported"
        : result.status === "interrupted" ? "Interrupted — resume available" : "Failed — retry available"
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


/** Merge already enriched results into the durable queue in a single indexed pass. */
export function reconcileDownloadResults(current: DownloadQueueItem[], results: DownloadResult[]): DownloadQueueItem[] {
  if (!results.length) return current;
  const next = [...current];
  const byJob = new Map<string,number>();
  const bySpotify = new Map<string,number|null>(), byUrl = new Map<string,number|null>();
  const byPath = new Map<string,number|null>();
  const remember = (map:Map<string,number|null>,key:string|undefined,index:number) => {
    if (!key) return;
    map.set(key, map.has(key) && map.get(key)!==index ? null : index);
  };
  current.forEach((item,index)=>{
    if(item.recoveryId) { if(!byJob.has(item.recoveryId)) byJob.set(item.recoveryId,index); }
    else { remember(bySpotify,item.spotifyTrackId,index); remember(byUrl,item.url,index); remember(byPath,downloadPathKey(item.filePath),index); }
  });
  for (const result of results) {
    const recordingId = String(result.spotifyTrackId || "").trim();
    const durable = result.recoveryId ? byJob.get(result.recoveryId) : undefined;
    const placeholder = recordingId ? bySpotify.get(recordingId) : byUrl.get(result.url || "") ?? byPath.get(downloadPathKey(result.filePath));
    let index = durable ?? (typeof placeholder === "number" && !next[placeholder].recoveryId ? placeholder : undefined);
    if(index===undefined && !result.recoveryId) continue;
    if(index===undefined) index=next.length;
    const previous = next[index];
    const status = result.status || (result.ok ? "done" : "failed");
    const error = result.ok ? "" : friendlyDownloadError(result.error || "Download failed.");
    next[index] = {
      ...previous,
      id: result.recoveryId || previous?.id || result.url || "",
      recoveryId: result.recoveryId || previous?.recoveryId,
      url: previous?.url || result.url || result.spotifyUrl || "",
      source: result.source || previous?.source,
      status,
      progress: status === "cancelled" || status === "interrupted" ? previous?.progress ?? 0 : 100,
      message: result.ok ? result.importedToLibrary ? "Added to library" : "Downloaded, but not imported" : error,
      filePath: result.filePath || previous?.filePath,
      filename: result.filename || previous?.filename,
      error,
      importedToLibrary: result.importedToLibrary ?? previous?.importedToLibrary,
      librarySongId: result.librarySongId ?? previous?.librarySongId,
      statusLabel: result.statusLabel,
      spotifyTrackId: result.spotifyTrackId || previous?.spotifyTrackId,
      spotifyUrl: result.spotifyUrl || previous?.spotifyUrl,
      providerUrl: result.providerUrl || previous?.providerUrl,
      matchScore: result.matchScore ?? previous?.matchScore,
      title: result.filename || previous?.title || result.url || "download"
    };
    if(next[index].recoveryId) byJob.set(next[index].recoveryId!,index);
  }
  return next;
}
