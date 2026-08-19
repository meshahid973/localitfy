from pathlib import Path

root = Path(__file__).resolve().parents[2]


def read(relative):
    return (root / relative).read_text(encoding="utf-8-sig")


def write(relative, text):
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


app = read("src/App.tsx")

start_anchor = "  const discordSettingsRef = useRef(settings);\n"
end_anchor = "\n\n  useEffect(() => {\n    if (sleepTimerRef.current !== null) {"
a = app.find(start_anchor)
if a >= 0:
    b = app.find(end_anchor, a)
    if b < 0:
        raise SystemExit("Discord runtime end anchor missing")
    replacement = '''  useDiscordActivityRuntime({\n    ready,\n    settings,\n    currentSong,\n    isPlaying,\n    songsCount: songs.length,\n    songIndexById,\n    mostPlayed,\n    pixelArtRevision: pixelArtAssets.length,\n    isAppBackgrounded,\n    audioRef,\n    songRef,\n    timeRef,\n    durationRef,\n    playingRef,\n    getRuntimePixelArtForSong,\n    getLiveDiscordAssetKey\n  });\n'''
    app = app[:a] + replacement + app[b:]

app = app.replace('  const discordLastPayloadKeyRef = useRef<string>("");\n', '')

import_anchor = 'import { useLibraryController } from "./features/library";\n'
if 'useDiscordActivityRuntime' not in app[: app.find('function MainModeApp')]:
    app = app.replace(import_anchor, import_anchor + 'import { useDiscordActivityRuntime } from "./features/discord/useDiscordActivityRuntime";\n', 1)

# These imports were owned solely by the extracted Discord effect.
app = app.replace('  LOCALITFY_SOURCE_URL,\n', '')
app = app.replace('  buildDiscordSongSearchUrl,\n', '')
write("src/App.tsx", app)

write(
    "src/features/discord/useDiscordActivityRuntime.ts",
    '''import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";\nimport type { Song } from "../library/song.types";\nimport type { Settings } from "../settings/settings.types";\nimport type { DiscordArtMode } from "./discord.types";\nimport { DISCORD_ASSET_KEYS, LOCALITFY_DOWNLOAD_URL, LOCALITFY_SOURCE_URL } from "./discord.constants";\nimport { buildDiscordSongSearchUrl } from "./discord.utils";\nimport { pixelArtUrl } from "../covers/pixelArt";\n\ntype RpcPixel = { discordKey: string; label: string; file: string; url?: string };\n\ntype UseDiscordActivityRuntimeOptions = {\n  ready: boolean;\n  settings: Settings;\n  currentSong: Song | null;\n  isPlaying: boolean;\n  songsCount: number;\n  songIndexById: Map<string, number>;\n  mostPlayed: Song | null;\n  pixelArtRevision: number;\n  isAppBackgrounded: boolean;\n  audioRef: RefObject<HTMLAudioElement | null>;\n  songRef: MutableRefObject<Song | null>;\n  timeRef: MutableRefObject<number>;\n  durationRef: MutableRefObject<number>;\n  playingRef: MutableRefObject<boolean>;\n  getRuntimePixelArtForSong: (song: Song | null, purpose: string) => RpcPixel;\n  getLiveDiscordAssetKey: (song: Song | null, songIndex: number, mode: DiscordArtMode) => string | undefined;\n};\n\nexport function useDiscordActivityRuntime({\n  ready, settings, currentSong, isPlaying, songsCount, songIndexById, mostPlayed, pixelArtRevision,\n  isAppBackgrounded, audioRef, songRef, timeRef, durationRef, playingRef,\n  getRuntimePixelArtForSong, getLiveDiscordAssetKey\n}: UseDiscordActivityRuntimeOptions) {\n  const settingsRef = useRef(settings);\n  const lastPayloadKeyRef = useRef(\"\");\n\n  useEffect(() => {\n    settingsRef.current = settings;\n  }, [settings]);\n\n  useEffect(() => {\n    if (!ready) return;\n\n    if (!settings.discordEnabled) {\n      lastPayloadKeyRef.current = \"\";\n      window.localitfy.clearDiscordActivity().catch(() => undefined);\n      return;\n    }\n\n    let alive = true;\n\n    const sendActivity = () => {\n      if (!alive) return;\n\n      const audio = audioRef.current;\n      const song = songRef.current;\n      const latestSettings = settingsRef.current;\n      const safeCurrentTime = Number.isFinite(audio?.currentTime)\n        ? Math.floor(audio?.currentTime || 0)\n        : Math.floor(timeRef.current || 0);\n      const safeDuration = Number.isFinite(audio?.duration)\n        ? Math.floor(audio?.duration || 0)\n        : Math.floor(durationRef.current || song?.duration || 0);\n\n      const pixel = getRuntimePixelArtForSong(song, \"rpc-preview\");\n      const backupPixel = getRuntimePixelArtForSong(song, \"rpc-backup\");\n      const songIndex = song ? songIndexById.get(song.id) ?? -1 : -1;\n      const chosenAsset = getLiveDiscordAssetKey(song, songIndex, latestSettings.discordArtMode);\n      const searchUrl = buildDiscordSongSearchUrl(song?.title || \"\", song?.artist || \"\");\n      const hasSong = Boolean(song?.title);\n      const primaryLabel = latestSettings.discordPrivacyMode || !hasSong\n        ? \"Download localtify\"\n        : \"Search this song on YouTube\";\n      const primaryUrl = latestSettings.discordPrivacyMode || !hasSong ? LOCALITFY_DOWNLOAD_URL : searchUrl;\n\n      const payloadKey = [\n        song?.id || \"idle\", song?.title || \"\", song?.artist || \"\", song?.album || \"\",\n        song?.playCount || 0, song?.liked ? \"liked\" : \"plain\", playingRef.current ? \"playing\" : \"paused\",\n        safeDuration, Math.floor(safeCurrentTime / 15), songsCount, mostPlayed?.id || \"\",\n        latestSettings.discordEnabled, latestSettings.discordShowPausedIdle, latestSettings.discordPrivacyMode,\n        latestSettings.discordButtons, latestSettings.discordArtMode, latestSettings.discordActivityStyle,\n        latestSettings.discordTitleCleanup, latestSettings.discordSecondLine, chosenAsset\n      ].join(\"|\");\n\n      if (payloadKey === lastPayloadKeyRef.current) return;\n      lastPayloadKeyRef.current = payloadKey;\n\n      const send = window.localitfy.updateDiscordActivity || window.localitfy.setDiscordActivity;\n      if (!send) return;\n\n      send({\n        isPlaying: playingRef.current,\n        songId: song?.id || \"\",\n        title: song?.title || \"\",\n        artist: song?.artist || \"\",\n        album: song?.album || \"\",\n        playCount: song?.playCount || 0,\n        liked: song?.liked || false,\n        currentTime: safeCurrentTime,\n        duration: safeDuration,\n        songCount: songsCount,\n        mostPlayedTitle: mostPlayed?.title || \"\",\n        discordEnabled: latestSettings.discordEnabled,\n        discordShowPausedIdle: latestSettings.discordShowPausedIdle,\n        discordPrivacyMode: latestSettings.discordPrivacyMode,\n        discordButtons: latestSettings.discordButtons,\n        discordArtMode: latestSettings.discordArtMode,\n        discordActivityStyle: latestSettings.discordActivityStyle,\n        discordTitleCleanup: latestSettings.discordTitleCleanup,\n        discordSecondLine: latestSettings.discordSecondLine,\n        discordAssetKey: chosenAsset,\n        discordAltAssetKey: backupPixel.discordKey,\n        discordAssetLabel: pixel.label,\n        discordAssetPreview: pixel.url || pixelArtUrl(pixel.file),\n        discordFallbackAssets: [...DISCORD_ASSET_KEYS],\n        discordOpenUrl: primaryUrl,\n        discordGithubUrl: LOCALITFY_SOURCE_URL,\n        discordOpenLabel: primaryLabel,\n        discordGithubLabel: \"Get localtify\",\n        discordButtonLabels: [primaryLabel, \"Get localtify\"],\n        discordButtonRetry: true,\n        discordActivityName: \"localtify\",\n        discordActivityType: \"listening\",\n        discordSmallImageMode: \"player\"\n      }).catch(() => {\n        if (lastPayloadKeyRef.current === payloadKey) lastPayloadKeyRef.current = \"\";\n      });\n    };\n\n    sendActivity();\n    const refreshEveryMs = isAppBackgrounded ? 45000 : 15000;\n    const timer = window.setInterval(sendActivity, refreshEveryMs);\n    return () => {\n      alive = false;\n      window.clearInterval(timer);\n    };\n  }, [\n    ready, currentSong?.id, currentSong?.title, currentSong?.artist, currentSong?.album, currentSong?.playCount,\n    currentSong?.liked, isPlaying, songsCount, songIndexById, mostPlayed?.id, settings.discordEnabled,\n    settings.discordShowPausedIdle, settings.discordPrivacyMode, settings.discordButtons, settings.discordArtMode,\n    settings.discordActivityStyle, settings.discordTitleCleanup, settings.discordSecondLine, pixelArtRevision,\n    isAppBackgrounded, audioRef, songRef, timeRef, durationRef, playingRef, getRuntimePixelArtForSong, getLiveDiscordAssetKey\n  ]);\n}\n''',
)

write(
    "tests/phase4/discord-runtime-ownership.test.mjs",
    '''import assert from "node:assert/strict";\nimport fs from "node:fs";\nimport path from "node:path";\nimport test from "node:test";\nimport { fileURLToPath } from "node:url";\n\nconst root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");\nconst read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");\n\ntest("Discord activity runtime is feature-owned", () => {\n  const app = read("src/App.tsx");\n  const runtime = read("src/features/discord/useDiscordActivityRuntime.ts");\n  assert.match(app, /useDiscordActivityRuntime\\(\\{/);\n  assert.doesNotMatch(app, /const discordSettingsRef/);\n  assert.doesNotMatch(app, /const sendDiscordActivity/);\n  assert.match(runtime, /lastPayloadKeyRef/);\n  assert.match(runtime, /LOCALITFY_SOURCE_URL/);\n});\n''',
)

print("Phase 4B checkpoint 3 applied")
