import type { Song } from "../library/song.types";
import type { Settings } from "../settings/settings.types";
import { formatTime } from "../../shared/utils/format";
import { discordArtist, prettyMeta, previewTitle } from "../search/search.utils";

export type DiscordPreview = { badge: string; details: string; state: string };

export function buildDiscordPreview({ settings, song, isPlaying, currentTime, currentDuration, totalSongs, mostPlayed }: {
  settings: Settings;
  song: Song | null;
  isPlaying: boolean;
  currentTime: number;
  currentDuration: number;
  totalSongs: number;
  mostPlayed: Song | null;
}): DiscordPreview {
  const title = previewTitle(song?.title || "local song", settings.discordTitleCleanup, 7);
  const artist = discordArtist(song?.artist || "");
  const album = prettyMeta(song?.album || "local files");
  const timeLeft = `${formatTime(Math.max(0, (currentDuration || song?.duration || 0) - currentTime))} left`;

  if (settings.discordPrivacyMode) {
    return { badge: isPlaying ? "PLAYING" : "IDLE", details: "Listening to local music", state: "localtify" };
  }
  if (!song) {
    return { badge: "IDLE", details: "browsing localtify", state: `${totalSongs} song${totalSongs === 1 ? "" : "s"} imported` };
  }

  let moodTitle = title;
  if (song.liked) moodTitle = `♥ ${title}`;
  else if (mostPlayed && mostPlayed.id === song.id) moodTitle = `on repeat · ${title}`;
  else if ((song.playCount || 0) <= 0) moodTitle = `discovering · ${title}`;

  const getSecondLine = () => {
    if (settings.discordSecondLine === "album") return album;
    if (settings.discordSecondLine === "timeLeft") return timeLeft;
    if (settings.discordSecondLine === "playCount") return `played ${song.playCount || 0} times`;
    if (settings.discordSecondLine === "appName") return "localtify";
    return artist;
  };

  if (!isPlaying && settings.discordShowPausedIdle) return { badge: "PAUSED", details: `paused · ${title}`, state: timeLeft };
  if (settings.discordActivityStyle === "cute") return { badge: "PLAYING", details: `vibing to ${moodTitle} ♡`, state: `${getSecondLine()} · localtify` };
  if (settings.discordActivityStyle === "detailed") return { badge: "PLAYING", details: moodTitle, state: `${artist} · ${album} · ${timeLeft}` };
  if (settings.discordActivityStyle === "minimal") return { badge: "PLAYING", details: moodTitle, state: "localtify" };
  if (settings.discordActivityStyle === "meme") return { badge: "PLAYING", details: `currently emotionally damaged by ${title}`, state: getSecondLine() };
  return { badge: "PLAYING", details: `♪ ${moodTitle}`, state: getSecondLine() };
}
