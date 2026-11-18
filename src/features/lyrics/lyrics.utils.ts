import type { LyricsLine } from "./lyrics.types";

/** Index of the last line that has started by `time` (seconds), or -1 before the first line. */
export function activeLyricIndex(lines: readonly Pick<LyricsLine, "time">[], time: number): number {
  let low = 0;
  let high = lines.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (lines[middle].time <= time) { found = middle; low = middle + 1; }
    else high = middle - 1;
  }
  return found;
}

/** Resync at least four times per second, but wake precisely near a lyric transition. */
export function nextLyricCheckDelay(lines: readonly LyricsLine[], index: number, time: number, rate: number): number {
  const words = lines[index]?.words;
  const nextWord = words?.[activeLyricIndex(words, time) + 1]?.time;
  const next = Math.min(lines[index + 1]?.time ?? Infinity, nextWord ?? Infinity);
  if (!Number.isFinite(next) || !Number.isFinite(time) || !Number.isFinite(rate) || rate <= 0) return 250;
  return Math.max(16, Math.min(250, Math.ceil((next - time) * 1000 / rate)));
}

/** Keep CJK text intact; do not infer translations or romanize from guesses. */
export function lyricLanguage(text: string): string | undefined {
  return /[\u3040-\u30ff]/u.test(text) ? "ja" : undefined;
}
