export type QueueHistoryItem = {
  id: string;
  songId: string;
  title: string;
  artist: string;
  playedAt: number;
};

export type RepeatMode = "off" | "one" | "all";
