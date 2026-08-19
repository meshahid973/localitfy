import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Song } from "../library/song.types";
import { applyLibraryOrder, cleanSongOrderIds } from "../library/library.utils";
import { sanitizeSongList } from "../search";
import type { AppToastKind, View } from "../shell/view.types";
import type { SettingsCategory } from "../settings/settings.types";
import type { CoverMood, RuntimePixelArtAsset } from "./cover.types";
import {
  PIXEL_ART_CACHE_TTL_MS,
  PIXEL_COVER_EXCLUDED_STORAGE_KEY,
  PIXEL_COVER_FAVORITES_STORAGE_KEY,
  buildRuntimePixelArtAssets,
  cleanStringList,
  getCachedRuntimePixelArtAssets,
  getPixelArtAssetKey,
  pixelArtUrl
} from "./pixelArt";
import {
  coverMoodName,
  getPixelAssetMoodTags,
  getSongCoverUsageKeys,
  pixelArtForSong,
  songSignature,
  stableHash
} from "./cover.runtime";
import { readLocalJson, writeLocalJson } from "../../shared/storage/localStorage";

type RuntimeSong = Song & {
  savedCoverPath?: string;
  savedCoverExists?: boolean;
  usesFallbackCover?: boolean;
  missingSavedCover?: boolean;
  coverExists?: boolean;
};

type ShowToast = (message: string, kind?: AppToastKind) => void;

export type UseCoversControllerOptions = {
  songs: Song[];
  songsById: Map<string, Song>;
  filteredSongs: Song[];
  query: string;
  currentSong: Song | null;
  view: View;
  settingsCategory: SettingsCategory;
  replaceSong: (updated: Song | null) => void;
  commitSongs: (songs: Song[]) => void;
  setStatusText: (message: string) => void;
  showAppToast: ShowToast;
  onCoverAssetsChanged?: () => void;
};

export function useCoversController({
  songs,
  songsById,
  filteredSongs,
  query,
  currentSong,
  view,
  settingsCategory,
  replaceSong,
  commitSongs,
  setStatusText,
  showAppToast,
  onCoverAssetsChanged
}: UseCoversControllerOptions) {
  const [pixelArtAssets, setPixelArtAssets] = useState<RuntimePixelArtAsset[]>(() => getCachedRuntimePixelArtAssets());
  const [coverGalleryMood, setCoverGalleryMood] = useState<CoverMood>("all");
  const [coverSelectedSongIds, setCoverSelectedSongIds] = useState<string[]>([]);
  const [favoritePixelCoverKeys, setFavoritePixelCoverKeys] = useState<string[]>(() =>
    cleanStringList(readLocalJson<string[]>(PIXEL_COVER_FAVORITES_STORAGE_KEY, []))
  );
  const [excludedPixelCoverKeys, setExcludedPixelCoverKeys] = useState<string[]>(() =>
    cleanStringList(readLocalJson<string[]>(PIXEL_COVER_EXCLUDED_STORAGE_KEY, []))
  );
  const [pixelArtBusy, setPixelArtBusy] = useState(false);
  const pixelArtCacheRef = useRef<{
    assets: RuntimePixelArtAsset[];
    loadedAt: number;
    pending: Promise<RuntimePixelArtAsset[]> | null;
  }>({
    assets: getCachedRuntimePixelArtAssets(),
    loadedAt: 0,
    pending: null
  });

  const loadPixelArtAssets = useCallback(async (force = false) => {
    const cache = pixelArtCacheRef.current;
    const nowMs = Date.now();

    if (!force && cache.assets.length && nowMs - cache.loadedAt < PIXEL_ART_CACHE_TTL_MS) {
      return cache.assets;
    }

    if (!force && cache.pending) return cache.pending;

    if (!window.localitfy.listPixelArt) {
      cache.assets = getCachedRuntimePixelArtAssets();
      cache.loadedAt = nowMs;
      return cache.assets;
    }

    let pending: Promise<RuntimePixelArtAsset[]>;
    pending = window.localitfy
      .listPixelArt()
      .then((assets) => {
        const runtimeAssets = buildRuntimePixelArtAssets(assets);
        cache.assets = runtimeAssets;
        cache.loadedAt = Date.now();
        return runtimeAssets;
      })
      .catch(() => {
        if (!cache.assets.length) cache.assets = getCachedRuntimePixelArtAssets();
        cache.loadedAt = Date.now();
        return cache.assets;
      })
      .finally(() => {
        if (cache.pending === pending) cache.pending = null;
      });

    cache.pending = pending;
    return pending;
  }, []);

  useEffect(() => {
    writeLocalJson(PIXEL_COVER_FAVORITES_STORAGE_KEY, favoritePixelCoverKeys);
  }, [favoritePixelCoverKeys]);

  useEffect(() => {
    writeLocalJson(PIXEL_COVER_EXCLUDED_STORAGE_KEY, excludedPixelCoverKeys);
  }, [excludedPixelCoverKeys]);

  useEffect(() => {
    const validSongIds = new Set(songs.map((song) => song.id));
    setCoverSelectedSongIds((oldIds) => cleanSongOrderIds(oldIds, validSongIds));
  }, [songs]);

  const pixelArtPool = useMemo(
    () => (pixelArtAssets.length ? pixelArtAssets : getCachedRuntimePixelArtAssets()),
    [pixelArtAssets]
  );

  const pixelArtUsageMap = useMemo(() => {
    const map = new Map<string, number>();
    songs.forEach((song) => {
      getSongCoverUsageKeys(song).forEach((key) => map.set(key, (map.get(key) || 0) + 1));
    });
    return map;
  }, [songs]);

  const favoritePixelCoverKeySet = useMemo(() => new Set(favoritePixelCoverKeys), [favoritePixelCoverKeys]);
  const excludedPixelCoverKeySet = useMemo(() => new Set(excludedPixelCoverKeys), [excludedPixelCoverKeys]);

  const getRuntimePixelArtForSong = useCallback((song?: Song | null, salt = "") => {
    const pool = pixelArtPool.length ? pixelArtPool : getCachedRuntimePixelArtAssets();
    const index = stableHash(`${songSignature(song)}::${salt}`) % Math.max(1, pool.length);
    return pool[index] || pixelArtForSong(song);
  }, [pixelArtPool]);

  const pickBalancedPixelAsset = useCallback((
    song: Song,
    salt = "manual",
    usageOverride?: Map<string, number>,
    poolOverride?: RuntimePixelArtAsset[]
  ): RuntimePixelArtAsset | null => {
    const pool = (poolOverride || pixelArtPool).filter((asset) => {
      if (!(asset.path || asset.url || asset.file)) return false;
      return poolOverride ? true : !excludedPixelCoverKeySet.has(getPixelArtAssetKey(asset));
    });
    if (!pool.length) return null;

    const usage = usageOverride || pixelArtUsageMap;
    const currentKeys = new Set([song.coverPath, song.coverUrl].filter(Boolean) as string[]);
    const randomSalt = `${Date.now()}::${Math.random()}::${salt}`;

    const ranked = pool
      .map((asset, index) => {
        const key = getPixelArtAssetKey(asset);
        const isCurrent = currentKeys.has(asset.path || "") || currentKeys.has(asset.url || "") || currentKeys.has(asset.file || "");
        return {
          asset,
          isCurrent,
          usage: usage.get(key) || 0,
          score: stableHash(`${songSignature(song)}::${randomSalt}::${index}::${asset.file}`)
        };
      })
      .filter((entry) => pool.length <= 1 || !entry.isCurrent)
      .sort((a, b) => a.usage - b.usage || a.score - b.score);

    return ranked[0]?.asset || pool[0] || null;
  }, [excludedPixelCoverKeySet, pixelArtPool, pixelArtUsageMap]);

  const coverToolsActive = view === "covers" || (view === "settings" && (settingsCategory === "covers" || settingsCategory === "advanced"));

  const coverGalleryAssets = useMemo(() => {
    if (!coverToolsActive) return [];
    return pixelArtPool.map((asset) => {
      const key = getPixelArtAssetKey(asset);
      const usage = Math.max(
        pixelArtUsageMap.get(key) || 0,
        asset.url ? pixelArtUsageMap.get(asset.url) || 0 : 0,
        asset.path ? pixelArtUsageMap.get(asset.path) || 0 : 0,
        asset.file ? pixelArtUsageMap.get(asset.file) || 0 : 0
      );
      return {
        asset,
        key,
        tags: getPixelAssetMoodTags(asset),
        usage,
        favorite: favoritePixelCoverKeySet.has(key),
        excluded: excludedPixelCoverKeySet.has(key)
      };
    });
  }, [coverToolsActive, pixelArtPool, pixelArtUsageMap, favoritePixelCoverKeySet, excludedPixelCoverKeySet]);

  const coverMoodCounts = useMemo(() => {
    const counts = new Map<CoverMood, number>();
    coverGalleryAssets.forEach((entry) => {
      if (!entry.excluded) counts.set("all", (counts.get("all") || 0) + 1);
      if (entry.favorite && !entry.excluded) counts.set("favorites", (counts.get("favorites") || 0) + 1);
      entry.tags.forEach((tag) => {
        if (!entry.excluded) counts.set(tag, (counts.get(tag) || 0) + 1);
      });
    });
    counts.set("leastUsed", coverGalleryAssets.filter((entry) => !entry.excluded).length);
    return counts;
  }, [coverGalleryAssets]);

  const filteredCoverGalleryAssets = useMemo(() => {
    const visible = coverGalleryAssets.filter((entry) => {
      if (coverGalleryMood === "favorites") return entry.favorite && !entry.excluded;
      if (coverGalleryMood === "leastUsed" || coverGalleryMood === "all") return !entry.excluded;
      return entry.tags.includes(coverGalleryMood) && !entry.excluded;
    });
    return visible.sort((a, b) => {
      if (coverGalleryMood === "leastUsed") return a.usage - b.usage || a.asset.label.localeCompare(b.asset.label);
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return a.usage - b.usage || a.asset.label.localeCompare(b.asset.label);
    });
  }, [coverGalleryAssets, coverGalleryMood]);

  const selectedCoverSongs = useMemo(
    () => coverSelectedSongIds.map((songId) => songsById.get(songId)).filter((song): song is Song => Boolean(song)),
    [coverSelectedSongIds, songsById]
  );

  const coverPickerSongList = useMemo(() => (query.trim() ? filteredSongs : songs).slice(0, 120), [filteredSongs, query, songs]);

  const missingCoverSongs = useMemo(() => songs.filter((song) => {
    const runtimeSong = song as RuntimeSong;
    const coverPath = String(song.coverPath || runtimeSong.savedCoverPath || "").trim();
    const coverUrl = String(song.coverUrl || song.coverThumbnailUrl || song.thumbnailUrl || "").trim();
    const coverExists = typeof runtimeSong.coverExists === "boolean" ? runtimeSong.coverExists : true;
    const usesFallbackCover = Boolean(runtimeSong.usesFallbackCover || runtimeSong.missingSavedCover);
    return usesFallbackCover || !coverPath || coverExists === false || (!coverUrl && !coverPath);
  }), [songs]);

  const coverStats = useMemo(() => {
    const usable = coverGalleryAssets.filter((entry) => !entry.excluded);
    const used = usable.filter((entry) => entry.usage > 0);
    const least = [...usable].sort((a, b) => a.usage - b.usage || a.asset.label.localeCompare(b.asset.label))[0] || null;
    const most = [...usable].sort((a, b) => b.usage - a.usage || a.asset.label.localeCompare(b.asset.label))[0] || null;
    return {
      total: coverGalleryAssets.length,
      usable: usable.length,
      used: used.length,
      favorites: favoritePixelCoverKeys.length,
      excluded: excludedPixelCoverKeys.length,
      missingSongs: missingCoverSongs.length,
      least,
      most
    };
  }, [coverGalleryAssets, favoritePixelCoverKeys.length, excludedPixelCoverKeys.length, missingCoverSongs.length]);

  async function rescanPixelArtFolder() {
    setPixelArtBusy(true);
    setStatusText("rescanning pixel art folder...");
    showAppToast("rescanning pixel art covers...", "work");
    try {
      const runtimeAssets = await loadPixelArtAssets(true);
      setPixelArtAssets(runtimeAssets);
      onCoverAssetsChanged?.();
      setStatusText(`found ${runtimeAssets.length} pixel art cover${runtimeAssets.length === 1 ? "" : "s"}`);
      showAppToast(`found ${runtimeAssets.length} pixel art cover${runtimeAssets.length === 1 ? "" : "s"}`, "success");
    } catch (error) {
      console.error("[localitfy pixel art rescan error]", error);
      setPixelArtAssets(getCachedRuntimePixelArtAssets());
      setStatusText("pixel art rescan failed, using fallback art");
      showAppToast("pixel art rescan failed safely", "error");
    } finally {
      setPixelArtBusy(false);
    }
  }

  async function applyPixelAssetToSong(song: Song, asset: RuntimePixelArtAsset | null, successMessage = "pixel cover applied", announce = true) {
    try {
      let updated: Song | null = null;
      const publicCoverUrl = asset?.url || (asset?.file ? pixelArtUrl(asset.file) : "");
      if (asset?.path && window.localitfy.setSongCover) {
        updated = await window.localitfy.setSongCover(song.id, asset.path);
      } else if (publicCoverUrl && window.localitfy.patchSong) {
        updated = await window.localitfy.patchSong(song.id, { coverPath: asset?.path || null, coverUrl: publicCoverUrl });
      } else if (window.localitfy.randomizeSongCover) {
        updated = await window.localitfy.randomizeSongCover(song.id);
      }
      if (updated) {
        replaceSong(updated);
        setStatusText(successMessage);
        if (announce) showAppToast(successMessage, "success");
        return updated;
      }
    } catch (error) {
      console.error("[localitfy cover update error]", error);
    }
    setStatusText("cover update failed");
    if (announce) showAppToast("cover update failed", "error");
    return null;
  }

  async function randomizeCoverForSong(song: Song | null) {
    if (!song || pixelArtBusy) return null;
    setPixelArtBusy(true);
    showAppToast("picking a fresh pixel cover...", "work");
    try {
      return await applyPixelAssetToSong(song, pickBalancedPixelAsset(song, "single"), "cover randomized");
    } finally {
      setPixelArtBusy(false);
    }
  }

  async function resetCoverForSong(song: Song | null) {
    if (!song || pixelArtBusy) return null;
    setPixelArtBusy(true);
    setStatusText("resetting cover...");
    showAppToast("resetting cover...", "work");
    const optimistic = { ...song, coverPath: null, coverUrl: null, coverThumbUrl: null, coverThumbnailUrl: null, thumbnailUrl: null } as Song;
    replaceSong(optimistic);
    try {
      const updated = await window.localitfy.patchSong(song.id, { coverPath: null, coverUrl: null });
      if (updated) replaceSong(updated);
      setStatusText("cover reset to default");
      showAppToast("cover reset to default", "success");
      return updated || optimistic;
    } catch (error) {
      console.error("[localitfy reset cover error]", error);
      replaceSong(song);
      setStatusText("cover reset failed");
      showAppToast("cover reset failed", "error");
      return null;
    } finally {
      setPixelArtBusy(false);
    }
  }

  async function randomizeMissingCoversAction() {
    if (pixelArtBusy) return;
    setPixelArtBusy(true);
    setStatusText("randomizing missing covers...");
    showAppToast("randomizing missing covers...", "work");
    try {
      const updatedSongs = await window.localitfy.randomizeMissingSongCovers?.();
      if (Array.isArray(updatedSongs)) commitSongs(applyLibraryOrder(sanitizeSongList(updatedSongs)));
      const changedCount = Array.isArray(updatedSongs) ? missingCoverSongs.length : 0;
      const message = changedCount ? `fixed ${changedCount} missing cover${changedCount === 1 ? "" : "s"}` : "missing cover scan complete";
      setStatusText(message);
      showAppToast(message, changedCount ? "success" : "info");
    } catch (error) {
      console.error("[localitfy missing cover randomize error]", error);
      setStatusText("missing cover fix failed");
      showAppToast("missing cover fix failed", "error");
    } finally {
      setPixelArtBusy(false);
    }
  }

  async function cleanupCoverCacheAction() {
    if (pixelArtBusy) return;
    setPixelArtBusy(true);
    setStatusText("cleaning cover cache...");
    showAppToast("cleaning cover cache...", "work");
    try {
      const result = await window.localitfy.cleanupCoverCache?.();
      const removed = Number(result?.removed || 0);
      const message = removed ? `cleaned ${removed} cached cover thumbnail${removed === 1 ? "" : "s"}` : "cover cache already clean";
      setStatusText(message);
      showAppToast(message, removed ? "success" : "info");
    } catch (error) {
      console.error("[localitfy cover cache cleanup error]", error);
      setStatusText("cover cache cleanup failed");
      showAppToast("cover cache cleanup failed", "error");
    } finally {
      setPixelArtBusy(false);
    }
  }

  async function chooseCoverFromPc(song: Song | null) {
    if (!song || pixelArtBusy) return null;
    setPixelArtBusy(true);
    showAppToast("opening cover picker...", "work");
    try {
      const updated = await window.localitfy.pickSongCover(song.id);
      replaceSong(updated);
      setStatusText(updated ? "cover updated" : "cover unchanged");
      showAppToast(updated ? "cover updated" : "cover unchanged", updated ? "success" : "info");
      return updated;
    } catch (error) {
      console.error("[localitfy pick cover error]", error);
      setStatusText("cover update failed");
      showAppToast("cover update failed", "error");
      return null;
    } finally {
      setPixelArtBusy(false);
    }
  }

  async function randomizeAllCovers() {
    if (!songs.length || pixelArtBusy) return;
    setPixelArtBusy(true);
    setStatusText("randomizing all pixel covers...");
    showAppToast("randomizing pixel covers...", "work");
    try {
      let freshPixelArtPool = pixelArtPool.filter((asset) => !excludedPixelCoverKeySet.has(getPixelArtAssetKey(asset)));
      if (!freshPixelArtPool.length) {
        const runtimeAssets = await loadPixelArtAssets(false);
        freshPixelArtPool = runtimeAssets.filter((asset) => !excludedPixelCoverKeySet.has(getPixelArtAssetKey(asset)));
        setPixelArtAssets(runtimeAssets);
      }
      if (!freshPixelArtPool.length) {
        freshPixelArtPool = getCachedRuntimePixelArtAssets();
        setPixelArtAssets(freshPixelArtPool);
      }
      if (!freshPixelArtPool.length) {
        setStatusText("no pixel art found");
        showAppToast("add images to the pixelart folder first", "error");
        return;
      }
      const nextSongs = [...songs];
      const usage = new Map<string, number>();
      let changedCount = 0;
      for (const song of songs) {
        const asset = pickBalancedPixelAsset(song, `all-${changedCount}`, usage, freshPixelArtPool);
        if (!asset) continue;
        const publicCoverUrl = asset.url || (asset.file ? pixelArtUrl(asset.file) : "");
        let updated: Song | null = null;
        if (asset.path && window.localitfy.setSongCover) updated = await window.localitfy.setSongCover(song.id, asset.path);
        else if (publicCoverUrl && window.localitfy.patchSong) updated = await window.localitfy.patchSong(song.id, { coverPath: asset.path || null, coverUrl: publicCoverUrl });
        else if (window.localitfy.randomizeSongCover) updated = await window.localitfy.randomizeSongCover(song.id);
        const finalSong = updated || { ...song, coverPath: asset.path || null, coverUrl: publicCoverUrl || song.coverUrl };
        const index = nextSongs.findIndex((candidate) => candidate.id === finalSong.id);
        if (index !== -1) nextSongs[index] = finalSong;
        const key = getPixelArtAssetKey(asset);
        usage.set(key, (usage.get(key) || 0) + 1);
        changedCount += 1;
      }
      commitSongs(nextSongs);
      const message = changedCount ? `randomized ${changedCount} cover${changedCount === 1 ? "" : "s"}` : "no covers changed";
      setStatusText(message);
      showAppToast(message, changedCount ? "success" : "info");
    } catch (error) {
      console.error("[localitfy randomize all covers error]", error);
      setStatusText("randomize all covers failed");
      showAppToast("randomize all covers failed", "error");
    } finally {
      setPixelArtBusy(false);
    }
  }

  const togglePixelCoverFavorite = (key: string) => key && setFavoritePixelCoverKeys((oldKeys) => oldKeys.includes(key) ? oldKeys.filter((item) => item !== key) : [...oldKeys, key]);
  const togglePixelCoverExcluded = (key: string) => key && setExcludedPixelCoverKeys((oldKeys) => oldKeys.includes(key) ? oldKeys.filter((item) => item !== key) : [...oldKeys, key]);
  const toggleCoverSongSelection = (songId: string) => setCoverSelectedSongIds((oldIds) => oldIds.includes(songId) ? oldIds.filter((id) => id !== songId) : [...oldIds, songId]);

  function selectCurrentSongForCovers() {
    if (!currentSong) return showAppToast("play or select a song first", "info");
    setCoverSelectedSongIds([currentSong.id]);
    showAppToast("selected current song", "success");
  }

  function selectVisibleSongsForCovers() {
    const nextIds = coverPickerSongList.map((song) => song.id);
    setCoverSelectedSongIds(nextIds);
    showAppToast(nextIds.length ? `selected ${nextIds.length} song${nextIds.length === 1 ? "" : "s"}` : "nothing to select", nextIds.length ? "success" : "info");
  }

  function getPixelArtPoolForMood(mood: CoverMood) {
    return coverGalleryAssets
      .filter((entry) => !entry.excluded && (mood === "all" || mood === "leastUsed" || (mood === "favorites" ? entry.favorite : entry.tags.includes(mood))))
      .sort((a, b) => a.usage - b.usage || a.asset.label.localeCompare(b.asset.label))
      .map((entry) => entry.asset);
  }

  async function applyPixelAssetToSongs(targetSongs: Song[], asset: RuntimePixelArtAsset | null, finalMessage: string) {
    if (!targetSongs.length || !asset || pixelArtBusy) return;
    setPixelArtBusy(true);
    setStatusText(finalMessage);
    showAppToast(finalMessage, "work");
    try {
      let changedCount = 0;
      for (const song of targetSongs) if (await applyPixelAssetToSong(song, asset, finalMessage, false)) changedCount += 1;
      const message = changedCount ? `updated ${changedCount} cover${changedCount === 1 ? "" : "s"}` : "no covers changed";
      setStatusText(message);
      showAppToast(message, changedCount ? "success" : "info");
    } finally {
      setPixelArtBusy(false);
    }
  }

  async function applyCoverAssetToSelection(asset: RuntimePixelArtAsset) {
    const targetSongs = selectedCoverSongs.length ? selectedCoverSongs : currentSong ? [currentSong] : [];
    if (!targetSongs.length) return showAppToast("select a song first", "info");
    await applyPixelAssetToSongs(targetSongs, asset, `applying ${asset.label}`);
  }

  async function randomizeSelectedCovers(mood: CoverMood = coverGalleryMood) {
    const targetSongs = selectedCoverSongs.length ? selectedCoverSongs : currentSong ? [currentSong] : [];
    if (!targetSongs.length) return showAppToast("select songs first", "info");
    const sourcePool = getPixelArtPoolForMood(mood);
    if (!sourcePool.length) return showAppToast(`no ${coverMoodName(mood)} covers ready`, "error");
    setPixelArtBusy(true);
    setStatusText(`randomizing ${targetSongs.length} selected cover${targetSongs.length === 1 ? "" : "s"}...`);
    showAppToast(`randomizing ${coverMoodName(mood)} covers...`, "work");
    try {
      const usage = new Map<string, number>(pixelArtUsageMap);
      const nextSongs = [...songs];
      let changedCount = 0;
      for (const song of targetSongs) {
        const asset = pickBalancedPixelAsset(song, `${mood}-${changedCount}`, usage, sourcePool);
        if (!asset) continue;
        const publicCoverUrl = asset.url || (asset.file ? pixelArtUrl(asset.file) : "");
        let updated: Song | null = null;
        if (asset.path && window.localitfy.setSongCover) updated = await window.localitfy.setSongCover(song.id, asset.path);
        else if (publicCoverUrl && window.localitfy.patchSong) updated = await window.localitfy.patchSong(song.id, { coverPath: asset.path || null, coverUrl: publicCoverUrl });
        else if (window.localitfy.randomizeSongCover) updated = await window.localitfy.randomizeSongCover(song.id);
        const finalSong = updated || { ...song, coverPath: asset.path || null, coverUrl: publicCoverUrl || song.coverUrl };
        const index = nextSongs.findIndex((candidate) => candidate.id === finalSong.id);
        if (index !== -1) nextSongs[index] = finalSong;
        const key = getPixelArtAssetKey(asset);
        usage.set(key, (usage.get(key) || 0) + 1);
        if (asset.url) usage.set(asset.url, (usage.get(asset.url) || 0) + 1);
        if (asset.path) usage.set(asset.path, (usage.get(asset.path) || 0) + 1);
        changedCount += 1;
      }
      commitSongs(nextSongs);
      const message = changedCount ? `randomized ${changedCount} selected cover${changedCount === 1 ? "" : "s"}` : "no covers changed";
      setStatusText(message);
      showAppToast(message, changedCount ? "success" : "info");
    } catch (error) {
      console.error("[localitfy selected cover randomize error]", error);
      setStatusText("selected cover randomize failed");
      showAppToast("selected cover randomize failed", "error");
    } finally {
      setPixelArtBusy(false);
    }
  }

  return {
    pixelArtAssets,
    setPixelArtAssets,
    pixelArtBusy,
    pixelArtPool,
    loadPixelArtAssets,
    getRuntimePixelArtForSong,
    coverGalleryMood,
    setCoverGalleryMood,
    coverSelectedSongIds,
    setCoverSelectedSongIds: setCoverSelectedSongIds as Dispatch<SetStateAction<string[]>>,
    favoritePixelCoverKeys,
    excludedPixelCoverKeys,
    coverMoodCounts,
    filteredCoverGalleryAssets,
    selectedCoverSongs,
    coverPickerSongList,
    missingCoverSongs,
    coverStats,
    rescanPixelArtFolder,
    randomizeCoverForSong,
    resetCoverForSong,
    randomizeMissingCoversAction,
    cleanupCoverCacheAction,
    chooseCoverFromPc,
    randomizeAllCovers,
    togglePixelCoverFavorite,
    togglePixelCoverExcluded,
    toggleCoverSongSelection,
    selectCurrentSongForCovers,
    selectVisibleSongsForCovers,
    applyCoverAssetToSelection,
    randomizeSelectedCovers
  };
}
