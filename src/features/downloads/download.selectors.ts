import type { DownloadQueueItem } from "./download.types";
export function failedDownloadItems(items:DownloadQueueItem[]){return items.filter((item)=>item.status==="failed"||item.status==="cancelled");}
export function activeDownloadItems(items:DownloadQueueItem[]){return items.filter((item)=>["queued","downloading","converting","importing"].includes(item.status));}
export function finishedDownloadItems(items:DownloadQueueItem[]){return items.filter((item)=>item.status==="done");}
export function clearFinishedDownloads(items:DownloadQueueItem[]){return items.filter((item)=>item.status!=="done");}

export function downloadStatusLabel(status: string) {
  if (status === "done") return "done";
  if (status === "failed") return "failed";
  if (status === "cancelled") return "cancelled";
  if (status === "converting") return "converting";
  if (status === "downloading") return "downloading";
  return "queued";
}

export function spotifyTrackStatusLabel(track: { downloadStatus?: string; importedToLibrary?: boolean }, selected: boolean) {
  if (track.downloadStatus === "done") return track.importedToLibrary === false ? "downloaded" : "done";
  if (track.downloadStatus === "failed") return "failed";
  if (track.downloadStatus === "queued") return "queued";
  if (track.downloadStatus === "downloading") return "downloading";
  return selected ? "ready" : "not selected";
}
