export type AnalysisModel = { id: string; name: string; revision: string; source: string; license: string; licenseUrl: string; bytes: number; dimensions: number; sampleRate: number };
export type ModelDownload = { state: "not-installed" | "downloading" | "ready" | "error"; downloadedBytes: number; totalBytes: number; error: string };

export type AnalysisStatus = {
  supported: boolean;
  enabled: boolean;
  historyEnabled: boolean;
  model: AnalysisModel;
  download: ModelDownload;
  /** Optional text encoder used to match playlist prompts to saved audio profiles. */
  promptModel: AnalysisModel & { download: ModelDownload };
  paused: boolean;
  running: boolean;
  scanning: boolean;
  queued: number;
  currentSongId: string | null;
  completed: number;
  failed: number;
  analyzed: number;
  failures: number;
  onBattery: boolean;
  allowOnBattery: boolean;
  error: string;
};

export type SimilarSongsResult = {
  seedId: string;
  status: "ready" | "seed-unavailable" | "seed-missing" | "seed-unanalyzed" | "seed-stale" | "no-history";
  matches: Array<{ songId: string; score: number; playedTogether?: boolean }>;
  compared: number;
  /** Seed songs with usable audio profiles (more than one for playlists, liked songs and recent listening). */
  seedCount: number;
};

export type DailyMix = { id: string; name: string; songIds: string[] };
export type DailyMixesResult = {
  day: string; edition: number; generatedAt: number; eligible: number; mixes: DailyMix[];
};

/** `scores` pairs a song ID with how closely its sound matches the prompt, relative to the rest of the library. */
export type PromptSoundResult = { status: "ready" | "model-missing" | "no-profiles"; scores: Array<[string, number]> };
