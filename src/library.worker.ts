// localtify 0.3.8 V365 — background library analytics worker.
// Heavy library reductions live here so the renderer can keep scrolling/playback smooth.

type LocaltifyWorkerSong = {
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
  playCount?: number;
  dateAdded?: string;
  fileExists?: boolean;
};

type LocaltifyWorkerPlaylist = {
  songIds?: string[];
};

type LocaltifyWorkerPayload = {
  type: "compute-analytics-snapshot";
  requestId: number;
  activeView: string;
  songs?: LocaltifyWorkerSong[];
  likedCount?: number;
  playlists?: LocaltifyWorkerPlaylist[];
  settings?: Record<string, any>;
  isShuffle?: boolean;
  repeatMode?: string;
  downloadResultCount?: number;
};

function computeAnalyticsSnapshot(payload: LocaltifyWorkerPayload) {
  const songs = Array.isArray(payload.songs) ? payload.songs : [];
  const playlists = Array.isArray(payload.playlists) ? payload.playlists : [];
  const settings = payload.settings || {};
  const songCount = songs.length;
  const likedCount = Number(payload.likedCount || 0);
  const playlistCount = playlists.length;
  const recentImportCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const yearStart = new Date(now.getFullYear(), 0, 1).getTime();

  let playlistSongTotal = 0;
  let totalLibrarySeconds = 0;
  let totalListenedSeconds = 0;
  let totalPlays = 0;
  let playedSongCount = 0;
  let recentImportWeekCount = 0;
  let missingFileCount = 0;
  let monthImportCount = 0;
  let yearImportCount = 0;
  let monthImportSeconds = 0;
  let yearImportSeconds = 0;
  let longestSongDuration = 0;
  let longestSongTitle = "";

  const artists = new Set<string>();
  const albums = new Set<string>();
  const monthArtists = new Set<string>();
  const yearArtists = new Set<string>();
  const yearAlbums = new Set<string>();

  for (const playlist of playlists) {
    playlistSongTotal += Array.isArray(playlist.songIds) ? playlist.songIds.length : 0;
  }

  for (const song of songs) {
    const duration = Math.max(0, Number(song.duration) || 0);
    const playCount = Math.max(0, Number(song.playCount) || 0);
    const addedAt = Date.parse(String(song.dateAdded || ""));
    const artist = String(song.artist || "").trim().toLowerCase();
    const album = String(song.album || "").trim().toLowerCase();

    totalLibrarySeconds += duration;
    totalListenedSeconds += duration * playCount;
    totalPlays += playCount;

    if (playCount > 0) playedSongCount += 1;
    if (song.fileExists === false) missingFileCount += 1;

    if (artist && artist !== "unknown artist") artists.add(artist);
    if (album && album !== "unknown album") albums.add(album);

    if (duration > longestSongDuration) {
      longestSongDuration = duration;
      longestSongTitle = String(song.title || "").trim();
    }

    if (Number.isFinite(addedAt)) {
      if (addedAt >= recentImportCutoff) recentImportWeekCount += 1;

      if (addedAt >= monthStart) {
        monthImportCount += 1;
        monthImportSeconds += duration;
        if (artist && artist !== "unknown artist") monthArtists.add(artist);
      }

      if (addedAt >= yearStart) {
        yearImportCount += 1;
        yearImportSeconds += duration;
        if (artist && artist !== "unknown artist") yearArtists.add(artist);
        if (album && album !== "unknown album") yearAlbums.add(album);
      }
    }
  }

  const averageSongSeconds = songCount ? Math.round(totalLibrarySeconds / songCount) : 0;
  const neverPlayedCount = Math.max(0, songCount - playedSongCount);
  const likedPercent = songCount ? Math.round((likedCount / songCount) * 100) : 0;
  const playedPercent = songCount ? Math.round((playedSongCount / songCount) * 100) : 0;
  const averagePlaysPerSong = songCount ? Math.round((totalPlays / songCount) * 10) / 10 : 0;
  const libraryHealthPercent = songCount
    ? Math.max(0, Math.round(((songCount - missingFileCount) / songCount) * 100))
    : 0;

  let userStage = "new_no_library";
  if (songCount > 0 && songCount < 15) userStage = "small_library";
  else if (songCount >= 15 && songCount < 75) userStage = "building_library";
  else if (songCount >= 75) userStage = "power_library";

  let audienceSegment = "new_local_music_user";
  if (playlistCount > 0 && settings.discordEnabled) audienceSegment = "playlist_social_listener";
  else if (settings.discordEnabled) audienceSegment = "discord_presence_listener";
  else if (settings.customThemeEnabled || settings.coverColorSyncMode !== "off") audienceSegment = "visual_customizer";
  else if (playlistCount > 0) audienceSegment = "playlist_builder";
  else if (songCount >= 75) audienceSegment = "large_library_listener";
  else if (songCount > 0) audienceSegment = "casual_local_listener";

  let primaryAdAngle = "local_music_no_account";
  if (settings.discordEnabled) primaryAdAngle = "discord_rich_presence";
  else if (settings.customThemeEnabled || settings.coverColorSyncMode !== "off") primaryAdAngle = "custom_themes_and_covers";
  else if (playlistCount > 0) primaryAdAngle = "premium_playlists";
  else if (songCount >= 75) primaryAdAngle = "large_library_player";

  return {
    active_view: payload.activeView,
    user_stage: userStage,
    audience_segment: audienceSegment,
    primary_ad_angle: primaryAdAngle,
    song_count: songCount,
    liked_count: likedCount,
    playlist_count: playlistCount,
    playlist_song_total: playlistSongTotal,
    total_plays: totalPlays,
    total_listened_seconds: Math.round(totalListenedSeconds),
    library_duration_seconds: Math.round(totalLibrarySeconds),
    total_library_seconds: Math.round(totalLibrarySeconds),
    average_song_seconds: averageSongSeconds,
    average_plays_per_song: averagePlaysPerSong,
    played_song_count: playedSongCount,
    never_played_count: neverPlayedCount,
    recent_import_count: recentImportWeekCount,
    recent_import_week_count: recentImportWeekCount,
    missing_file_count: missingFileCount,
    library_health_percent: libraryHealthPercent,
    liked_percent: likedPercent,
    played_percent: playedPercent,
    month_import_count: monthImportCount,
    month_import_seconds: Math.round(monthImportSeconds),
    month_artist_count: monthArtists.size,
    year_import_count: yearImportCount,
    year_import_seconds: Math.round(yearImportSeconds),
    year_artist_count: yearArtists.size,
    year_album_count: yearAlbums.size,
    longest_song_duration: Math.round(longestSongDuration),
    longest_song_title: longestSongTitle,
    artist_count: artists.size,
    album_count: albums.size,
    has_library: songCount > 0,
    has_liked_songs: likedCount > 0,
    has_playlists: playlistCount > 0,
    has_played_music: playedSongCount > 0,
    discord_enabled: Boolean(settings.discordEnabled),
    discord_privacy_mode: Boolean(settings.discordPrivacyMode),
    discord_buttons_enabled: Boolean(settings.discordButtons),
    discord_art_mode: String(settings.discordArtMode || "albumCover"),
    discord_activity_style: String(settings.discordActivityStyle || "normal"),
    start_with_windows_enabled: Boolean(settings.startWithWindows),
    minimize_to_tray_enabled: Boolean(settings.minimizeToTray),
    custom_theme_enabled: Boolean(settings.customThemeEnabled),
    theme_id: settings.customThemeEnabled ? "custom" : String(settings.theme || "default"),
    cover_color_sync_mode: String(settings.coverColorSyncMode || "normal"),
    compact_player_enabled: Boolean(settings.compactPlayer),
    simple_mode_enabled: Boolean(settings.simpleMode),
    reduced_motion_enabled: Boolean(settings.reducedMotion),
    crossfade_enabled: Boolean(settings.crossfadeEnabled),
    gapless_enabled: Boolean(settings.gaplessPlayback),
    volume_normalization_enabled: Boolean(settings.volumeNormalization),
    per_song_volume_memory_enabled: Boolean(settings.perSongVolumeMemory),
    playback_speed_changed: Number(settings.playbackSpeed || 1) !== 1,
    shuffle_enabled: Boolean(payload.isShuffle),
    repeat_mode: String(payload.repeatMode || "off"),
    download_result_count: Number(payload.downloadResultCount || 0)
  };
}

self.onmessage = (event: MessageEvent<LocaltifyWorkerPayload>) => {
  const payload = event.data;

  if (!payload || payload.type !== "compute-analytics-snapshot") return;

  try {
    self.postMessage({
      type: "analytics-snapshot",
      requestId: payload.requestId,
      snapshot: computeAnalyticsSnapshot(payload)
    });
  } catch (error) {
    self.postMessage({
      type: "analytics-snapshot",
      requestId: payload.requestId,
      snapshot: computeAnalyticsSnapshot({
        ...payload,
        songs: [],
        playlists: []
      }),
      error: error instanceof Error ? error.message : "worker failed"
    });
  }
};

export {};
