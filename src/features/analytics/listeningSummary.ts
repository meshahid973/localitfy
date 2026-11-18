export type ListeningSummary = {
  generatedAt: number;
  days: number;
  totalMs: number;
  sessions: number;
  byDay: Array<{ day: string; ms: number }>;
  bySong: Array<{ id: string; ms: number }>;
};
