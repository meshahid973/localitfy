import type { Song } from "../library/song.types";
import type { DownloadQueueItem, DownloadResult } from "./download.types";

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

type DownloadSongLookup = {
  spotifyIds: Map<string, Song>;
  filePaths: Map<string, Song>;
};

/** Build the two exact-match indexes once for a batch, preserving first-match order. */
export function buildDownloadSongLookup(librarySongs: readonly Song[]): DownloadSongLookup {
  const spotifyIds = new Map<string, Song>();
  const filePaths = new Map<string, Song>();
  for (const song of librarySongs) {
    const spotifyId = String((song as Song & { sourceTrackId?: string }).sourceTrackId || "").trim();
    const filePath = String(song.filePath || "").trim().toLowerCase();
    if (spotifyId && !spotifyIds.has(spotifyId)) spotifyIds.set(spotifyId, song);
    if (filePath && !filePaths.has(filePath)) filePaths.set(filePath, song);
  }
  return { spotifyIds, filePaths };
}

export function findDownloadedSongMatch(result: DownloadResult, librarySongs: Song[], lookup?: DownloadSongLookup) {
  const filePath = String(result.filePath || "").trim().toLowerCase();
  const filename = String(result.filename || "").trim().toLowerCase();
  const spotifyTrackId = String(result.spotifyTrackId || "").trim();

  if (spotifyTrackId) {
    const exactSpotify = lookup
      ? lookup.spotifyIds.get(spotifyTrackId)
      : librarySongs.find((song) => String((song as Song & { sourceTrackId?: string }).sourceTrackId || "").trim() === spotifyTrackId);
    if (exactSpotify) return exactSpotify;
  }

  if (filePath) {
    const exact = lookup
      ? lookup.filePaths.get(filePath)
      : librarySongs.find((song) => String(song.filePath || "").trim().toLowerCase() === filePath);
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
  // All successful results share one index; failed results never require library work.
  const lookup = results.some((result) => result.ok) ? buildDownloadSongLookup(librarySongs) : undefined;
  return results.map((result) => {
    const match = result.ok ? findDownloadedSongMatch(result, librarySongs, lookup) : null;
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

