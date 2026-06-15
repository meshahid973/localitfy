export type DownloadPageMascotState = "empty" | "info" | "loading" | "happy" | "warning" | "error" | "question" | "danger";
export type DownloadPageTone = "info" | "success" | "warning" | "error";

type QueueItem = {
  status?: string;
  error?: string;
  message?: string;
  url?: string;
  importedToLibrary?: boolean;
  [key: string]: any;
};

type ResultItem = {
  ok?: boolean;
  error?: string;
  url?: string;
  filename?: string;
  importedToLibrary?: boolean;
  [key: string]: any;
};

export type DownloadPageStateInput = {
  downloadBusy?: boolean;
  spotifyDownloadBusy?: boolean;
  convertBusy?: boolean;
  downloadQueue?: QueueItem[];
  downloadResults?: ResultItem[];
  spotifyFetchError?: string;
};

export type DownloadPageState = {
  mascotState: DownloadPageMascotState;
  tone: DownloadPageTone;
  title: string;
  message: string;
  hasFailed: boolean;
  hasFinished: boolean;
  hasBadLink: boolean;
  canRetryFailed: boolean;
  canClearFinished: boolean;
  firstError: string;
  downloadWorking: boolean;
  failedQueueItems: QueueItem[];
  finishedQueueItems: QueueItem[];
  failedResults: ResultItem[];
  finishedResults: ResultItem[];
};

const WORKING_STATUSES = new Set(["queued", "working", "downloading", "fetching", "converting", "importing"]);
const FAILED_STATUSES = new Set(["failed", "cancelled", "error"]);
const FINISHED_STATUSES = new Set(["done", "complete", "completed", "success"]);

function statusOf(item: QueueItem) {
  return String(item?.status || "").toLowerCase();
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

export function getDownloadPageState(input: DownloadPageStateInput): DownloadPageState {
  const queue = Array.isArray(input.downloadQueue) ? input.downloadQueue : [];
  const results = Array.isArray(input.downloadResults) ? input.downloadResults : [];
  const failedQueueItems = queue.filter((item) => FAILED_STATUSES.has(statusOf(item)));
  const finishedQueueItems = queue.filter((item) => FINISHED_STATUSES.has(statusOf(item)));
  const failedResults = results.filter((item) => item && item.ok === false);
  const finishedResults = results.filter((item) => item && item.ok !== false);
  const badLinkText = String(input.spotifyFetchError || "").trim();

  const downloadWorking =
    Boolean(input.downloadBusy || input.spotifyDownloadBusy || input.convertBusy) ||
    queue.some((item) => WORKING_STATUSES.has(statusOf(item)));

  const firstError = firstText(
    failedQueueItems[0]?.error,
    failedQueueItems[0]?.message,
    failedResults[0]?.error,
    badLinkText
  );

  const base = {
    hasFailed: failedQueueItems.length > 0 || failedResults.length > 0,
    hasFinished: finishedQueueItems.length > 0 || finishedResults.length > 0,
    hasBadLink: Boolean(badLinkText),
    canRetryFailed: failedQueueItems.length > 0 || failedResults.length > 0,
    canClearFinished: finishedQueueItems.length > 0,
    firstError,
    downloadWorking,
    failedQueueItems,
    finishedQueueItems,
    failedResults,
    finishedResults
  };

  if (downloadWorking) {
    return {
      ...base,
      mascotState: "loading",
      tone: "info",
      title: "working on your downloads",
      message: "Keep this open while Localtify downloads, converts, and imports. Progress and errors stay visible here."
    };
  }

  if (badLinkText) {
    return {
      ...base,
      mascotState: "question",
      tone: "warning",
      title: "that link needs checking",
      message: "The Spotify or YouTube link could not be fetched. Copy the error or try a cleaner public link."
    };
  }

  if (failedQueueItems.length || failedResults.length) {
    return {
      ...base,
      mascotState: "error",
      tone: "error",
      title: "download needs attention",
      message: "Something failed safely. Retry failed items, copy the error, or open the downloads folder to inspect files."
    };
  }

  if (finishedQueueItems.length || finishedResults.length) {
    return {
      ...base,
      mascotState: "happy",
      tone: "success",
      title: "download finished",
      message: "Nice, the latest finished files are ready below. Open them in your library or clear finished items."
    };
  }

  return {
    ...base,
    mascotState: "info",
    tone: "info",
    title: "need help downloading?",
    message: "Paste a YouTube link, fetch Spotify tracks, or convert local files. Nothing touches the database until something is imported."
  };
}
