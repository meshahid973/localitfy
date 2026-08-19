import { useEffect, useRef, useState } from "react";
import { HtmlAudioEngine } from "./engine/htmlAudioEngine";
import type { PlayerController } from "./engine/playerController";
import type { PlaybackUrlCacheEntry, PlaybackUrlResult, Song } from "../library/song.types";
import type { QueueHistoryItem, RepeatMode } from "./player.types";
import { QUEUE_HISTORY_STORAGE_KEY, QUEUE_STORAGE_KEY, REPEAT_PLAYLIST_STORAGE_KEY } from "../library/library.constants";
import { readLocalJson, writeLocalJson } from "../../shared/storage/localStorage";

export type UsePlayerRuntimeOptions = {
  defaultVolume: number;
};

export function usePlayerRuntime({ defaultVolume }: UsePlayerRuntimeOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playerEngineRef = useRef<HtmlAudioEngine | null>(null);
  const playerControllerRef = useRef<PlayerController | null>(null);
  const crossfadeIntervalRef = useRef<number | null>(null);
  const crossfadeAutoStartedRef = useRef(false);
  const crossfadeAutoTargetRef = useRef("");
  const crossfadeMainPauseGuardRef = useRef(false);
  const crossfadeLastStartAtRef = useRef(0);
  const crossfadeHandoffClearTimerRef = useRef<number | null>(null);
  const crossfadeHandoffRef = useRef<{ songId: string; url: string; time: number; volume: number } | null>(null);
  const fadeIntervalRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const progressLoopTimeoutRef = useRef<number | null>(null);
  const backgroundAudioRepairTimerRef = useRef<number | null>(null);
  const playerResizeFrameRef = useRef<number | null>(null);
  const pendingPlayRef = useRef(false);
  const countPlayRef = useRef(false);
  const playCountSongIdRef = useRef("");
  const playCountListenedRef = useRef(0);
  const playCountLastTimeRef = useRef(0);
  const sleepTimerRef = useRef<number | null>(null);
  const positionSaveRef = useRef(0);
  const nextAudioRef = useRef<HTMLAudioElement | null>(null);
  const playbackUrlCacheRef = useRef<Map<string, PlaybackUrlCacheEntry>>(new Map());
  const playbackUrlPendingRef = useRef<Map<string, Promise<PlaybackUrlResult>>>(new Map());
  const lastQueueHistoryRef = useRef("");
  const songRef = useRef<Song | null>(null);
  const timeRef = useRef(0);
  const durationRef = useRef(0);
  const playingRef = useRef(false);
  const volumeRef = useRef(defaultVolume);
  const lastNonZeroVolumeRef = useRef(defaultVolume);
  const beatFrameRef = useRef<number | null>(null);
  const beatFrameTimerRef = useRef<number | null>(null);
  const beatAudioContextRef = useRef<AudioContext | null>(null);
  const beatAnalyserRef = useRef<AnalyserNode | null>(null);
  const beatSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioEffectDryGainRef = useRef<GainNode | null>(null);
  const audioEffectWetGainRef = useRef<GainNode | null>(null);
  const audioEffectDelayRef = useRef<DelayNode | null>(null);
  const audioEffectFeedbackGainRef = useRef<GainNode | null>(null);
  const audioEffectFilterRef = useRef<BiquadFilterNode | null>(null);
  const beatDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const beatSmoothRef = useRef({ bass: 0, mid: 0, energy: 0, phase: 0 });
  const beatReactiveTargetCacheRef = useRef<{ nodes: HTMLElement[]; refreshedAt: number; songId: string }>({ nodes: [], refreshedAt: 0, songId: "" });
  const beatLastPaintSignatureRef = useRef("");
  const progressDomSignatureRef = useRef("");

  const [isVolumeDragging, setIsVolumeDragging] = useState(false);
  const [volumeDraft, setVolumeDraft] = useState(() => Math.round(defaultVolume * 100));
  const volumeDraftRef = useRef(Math.round(defaultVolume * 100));
  const volumeDraftFrameRef = useRef<number | null>(null);
  const liveVolumeFrameRef = useRef<number | null>(null);
  const liveVolumePendingPercentRef = useRef(Math.round(defaultVolume * 100));
  const fadeFrameRef = useRef<number | null>(null);
  const [currentId, setCurrentId] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("all");
  const [currentTime, setCurrentTime] = useState(0);
  const [currentDuration, setCurrentDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekDraftPercent, setSeekDraftPercent] = useState(0);
  const seekDraftPercentRef = useRef(0);
  const isSeekingRef = useRef(false);
  const seekDraftFrameRef = useRef(0);
  const progressInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const progressTimeLabelRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const progressDurationLabelRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const lastProgressUiPaintRef = useRef(0);
  const lastProgressStatePaintRef = useRef(0);
  const [statusText, setStatusText] = useState("ready to play");
  const [playerError, setPlayerError] = useState("");
  const [crossfadePreviewSongId, setCrossfadePreviewSongId] = useState("");
  const [nowPlayingTransitionKey, setNowPlayingTransitionKey] = useState("empty:0");
  const [playQueue, setPlayQueue] = useState<string[]>(() => readLocalJson<string[]>(QUEUE_STORAGE_KEY, []));
  const [queueHistory, setQueueHistory] = useState<QueueHistoryItem[]>(() => readLocalJson<QueueHistoryItem[]>(QUEUE_HISTORY_STORAGE_KEY, []));
  const [repeatPlaylist, setRepeatPlaylist] = useState(() => readLocalJson<boolean>(REPEAT_PLAYLIST_STORAGE_KEY, false));
  const [queueDropHot, setQueueDropHot] = useState(false);
  const queueDropHotRef = useRef(false);

  useEffect(() => { writeLocalJson(QUEUE_STORAGE_KEY, playQueue); }, [playQueue]);
  useEffect(() => { writeLocalJson(QUEUE_HISTORY_STORAGE_KEY, queueHistory); }, [queueHistory]);
  useEffect(() => { writeLocalJson(REPEAT_PLAYLIST_STORAGE_KEY, repeatPlaylist); }, [repeatPlaylist]);
  useEffect(() => { queueDropHotRef.current = queueDropHot; }, [queueDropHot]);

  return {
    audioRef, playerEngineRef, playerControllerRef,
    crossfadeIntervalRef, crossfadeAutoStartedRef, crossfadeAutoTargetRef, crossfadeMainPauseGuardRef,
    crossfadeLastStartAtRef, crossfadeHandoffClearTimerRef, crossfadeHandoffRef,
    fadeIntervalRef, animationFrameRef, progressLoopTimeoutRef, backgroundAudioRepairTimerRef,
    playerResizeFrameRef, pendingPlayRef, countPlayRef, playCountSongIdRef, playCountListenedRef,
    playCountLastTimeRef, sleepTimerRef, positionSaveRef, nextAudioRef, playbackUrlCacheRef,
    playbackUrlPendingRef, lastQueueHistoryRef, songRef, timeRef, durationRef, playingRef,
    volumeRef, lastNonZeroVolumeRef, beatFrameRef, beatFrameTimerRef, beatAudioContextRef,
    beatAnalyserRef, beatSourceRef, audioEffectDryGainRef, audioEffectWetGainRef,
    audioEffectDelayRef, audioEffectFeedbackGainRef, audioEffectFilterRef, beatDataRef,
    beatSmoothRef, beatReactiveTargetCacheRef, beatLastPaintSignatureRef, progressDomSignatureRef,
    isVolumeDragging, setIsVolumeDragging, volumeDraft, setVolumeDraft, volumeDraftRef,
    volumeDraftFrameRef, liveVolumeFrameRef, liveVolumePendingPercentRef, fadeFrameRef,
    currentId, setCurrentId, isPlaying, setIsPlaying, isShuffle, setIsShuffle,
    repeatMode, setRepeatMode, currentTime, setCurrentTime, currentDuration, setCurrentDuration,
    isSeeking, setIsSeeking, seekDraftPercent, setSeekDraftPercent, seekDraftPercentRef,
    isSeekingRef, seekDraftFrameRef, progressInputRefs, progressTimeLabelRefs,
    progressDurationLabelRefs, lastProgressUiPaintRef, lastProgressStatePaintRef,
    statusText, setStatusText, playerError, setPlayerError,
    crossfadePreviewSongId, setCrossfadePreviewSongId,
    nowPlayingTransitionKey, setNowPlayingTransitionKey,
    playQueue, setPlayQueue, queueHistory, setQueueHistory, repeatPlaylist, setRepeatPlaylist,
    queueDropHot, setQueueDropHot, queueDropHotRef
  };
}
