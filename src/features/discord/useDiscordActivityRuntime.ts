import { useEffect, useRef } from "react";
import type { DiscordArtMode, Settings, Song } from "../../localtifyTypes";
import type { RuntimePixelArtAsset } from "../covers/cover.types";
import { pixelArtUrl } from "../covers/pixelArt";
import { DISCORD_ASSET_KEYS, LOCALITFY_DOWNLOAD_URL, LOCALITFY_SOURCE_URL } from "./discord.constants";
import { buildDiscordSongSearchUrl } from "./discord.utils";

type CurrentRef<T> = { current: T };

type DiscordActivityRuntimeOptions = {
  ready: boolean;
  settings: Settings;
  currentSong: Song | null;
  isPlaying: boolean;
  songCount: number;
  songIndexById: ReadonlyMap<string, number>;
  mostPlayedId: string;
  mostPlayedTitle: string;
  pixelArtVersion: number;
  isAppBackgrounded: boolean;
  audioRef: CurrentRef<HTMLAudioElement | null>;
  songRef: CurrentRef<Song | null>;
  timeRef: CurrentRef<number>;
  durationRef: CurrentRef<number>;
  playingRef: CurrentRef<boolean>;
  getRuntimePixelArtForSong: (song: Song | null, seed: string) => RuntimePixelArtAsset;
  getLiveDiscordAssetKey: (song: Song | null, songIndex: number, mode: DiscordArtMode) => string | undefined;
};

export function useDiscordActivityRuntime(options: DiscordActivityRuntimeOptions) {
  const {
    ready, settings, currentSong, isPlaying, songCount, songIndexById, mostPlayedId, mostPlayedTitle,
    pixelArtVersion, isAppBackgrounded, audioRef, songRef, timeRef, durationRef, playingRef,
    getRuntimePixelArtForSong, getLiveDiscordAssetKey
  } = options;

  const settingsRef = useRef(settings);
  const lastPayloadKeyRef = useRef("");

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (!ready) return;

    if (!settings.discordEnabled) {
      lastPayloadKeyRef.current = "";
      window.localitfy.clearDiscordActivity().catch(() => undefined);
      return;
    }

    let alive = true;

    const sendActivity = () => {
      if (!alive) return;

      const audio = audioRef.current;
      const song = songRef.current;
      const latestSettings = settingsRef.current;
      const safeCurrentTime = Number.isFinite(audio?.currentTime)
        ? Math.floor(audio?.currentTime || 0)
        : Math.floor(timeRef.current || 0);
      const safeDuration = Number.isFinite(audio?.duration)
        ? Math.floor(audio?.duration || 0)
        : Math.floor(durationRef.current || song?.duration || 0);

      const pixel = getRuntimePixelArtForSong(song, "rpc-preview");
      const backupPixel = getRuntimePixelArtForSong(song, "rpc-backup");
      const songIndex = song ? songIndexById.get(song.id) ?? -1 : -1;
      const chosenDiscordAsset = getLiveDiscordAssetKey(song, songIndex, latestSettings.discordArtMode);
      const songSearchUrl = buildDiscordSongSearchUrl(song?.title || "", song?.artist || "");
      const hasSong = Boolean(song?.title);
      const primaryLabel = latestSettings.discordPrivacyMode || !hasSong
        ? "Download localtify"
        : "Search this song on YouTube";
      const primaryUrl = latestSettings.discordPrivacyMode || !hasSong
        ? LOCALITFY_DOWNLOAD_URL
        : songSearchUrl;

      const payloadKey = [
        song?.id || "idle", song?.title || "", song?.artist || "", song?.album || "",
        song?.playCount || 0, song?.liked ? "liked" : "plain",
        playingRef.current ? "playing" : "paused", safeDuration, Math.floor(safeCurrentTime / 15),
        songCount, mostPlayedId, latestSettings.discordEnabled, latestSettings.discordShowPausedIdle,
        latestSettings.discordPrivacyMode, latestSettings.discordButtons, latestSettings.discordArtMode,
        latestSettings.discordActivityStyle, latestSettings.discordTitleCleanup, latestSettings.discordSecondLine,
        chosenDiscordAsset
      ].join("|");

      if (payloadKey === lastPayloadKeyRef.current) return;
      lastPayloadKeyRef.current = payloadKey;

      const sendDiscordActivity = window.localitfy.updateDiscordActivity || window.localitfy.setDiscordActivity;
      if (!sendDiscordActivity) return;

      sendDiscordActivity({
        isPlaying: playingRef.current,
        songId: song?.id || "",
        title: song?.title || "",
        artist: song?.artist || "",
        album: song?.album || "",
        playCount: song?.playCount || 0,
        liked: song?.liked || false,
        currentTime: safeCurrentTime,
        duration: safeDuration,
        songCount,
        mostPlayedTitle,
        discordEnabled: latestSettings.discordEnabled,
        discordShowPausedIdle: latestSettings.discordShowPausedIdle,
        discordPrivacyMode: latestSettings.discordPrivacyMode,
        discordButtons: latestSettings.discordButtons,
        discordArtMode: latestSettings.discordArtMode,
        discordActivityStyle: latestSettings.discordActivityStyle,
        discordTitleCleanup: latestSettings.discordTitleCleanup,
        discordSecondLine: latestSettings.discordSecondLine,
        discordAssetKey: chosenDiscordAsset,
        discordAltAssetKey: backupPixel.discordKey,
        discordAssetLabel: pixel.label,
        discordAssetPreview: pixel.url || pixelArtUrl(pixel.file),
        discordFallbackAssets: [...DISCORD_ASSET_KEYS],
        discordOpenUrl: primaryUrl,
        discordGithubUrl: LOCALITFY_SOURCE_URL,
        discordOpenLabel: primaryLabel,
        discordGithubLabel: "Get localtify",
        discordButtonLabels: [primaryLabel, "Get localtify"],
        discordButtonRetry: true,
        discordActivityName: "localtify",
        discordActivityType: "listening",
        discordSmallImageMode: "player"
      }).catch(() => {
        if (lastPayloadKeyRef.current === payloadKey) lastPayloadKeyRef.current = "";
      });
    };

    sendActivity();
    const refreshEveryMs = isAppBackgrounded ? 45_000 : 15_000;
    const timer = window.setInterval(sendActivity, refreshEveryMs);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [
    ready, currentSong?.id, currentSong?.title, currentSong?.artist, currentSong?.album,
    currentSong?.playCount, currentSong?.liked, isPlaying, songCount, songIndexById, mostPlayedId,
    settings.discordEnabled, settings.discordShowPausedIdle, settings.discordPrivacyMode, settings.discordButtons,
    settings.discordArtMode, settings.discordActivityStyle, settings.discordTitleCleanup, settings.discordSecondLine,
    pixelArtVersion, isAppBackgrounded
  ]);
}
