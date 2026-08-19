export type AutoUpdateEvent = {
  type: "checking" | "available" | "not-available" | "downloading" | "downloaded" | "error" | "dev" | "backup";
  version?: string;
  currentVersion?: string;
  percent?: number;
  message?: string;
  error?: string;
  silent?: boolean;
  backupPath?: string;
  libraryBackedUp?: boolean;
  releaseNotes?: string;
  downloadedBytes?: number;
  totalBytes?: number;
  sizeBytes?: number;
  speedBytesPerSecond?: number;
  nagStage?: 0 | 1 | 2 | 3;
};

export type UpdatePromptState = {
  visible: boolean;
  status: "idle" | "checking" | "available" | "downloading" | "downloaded" | "latest" | "error" | "dev";
  version: string;
  percent: number;
  message: string;
  error: string;
  backupPath?: string;
  libraryBackedUp?: boolean;
  releaseNotes?: string;
  downloadedBytes?: number;
  totalBytes?: number;
  sizeBytes?: number;
  speedBytesPerSecond?: number;
  nagStage?: 0 | 1 | 2 | 3;
};
