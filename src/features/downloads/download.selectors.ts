import type { DownloadQueueItem } from "./download.types";
export function failedDownloadItems(items:DownloadQueueItem[]){return items.filter((item)=>item.status==="failed"||item.status==="cancelled");}
export function activeDownloadItems(items:DownloadQueueItem[]){return items.filter((item)=>["queued","downloading","converting","importing"].includes(item.status));}
export function finishedDownloadItems(items:DownloadQueueItem[]){return items.filter((item)=>item.status==="done");}
export function clearFinishedDownloads(items:DownloadQueueItem[]){return items.filter((item)=>item.status!=="done");}
