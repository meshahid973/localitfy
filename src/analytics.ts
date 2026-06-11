import posthog from "posthog-js";

export type AnalyticsValue = string | number | boolean | null | undefined;
export type AnalyticsProperties = Record<string, AnalyticsValue>;

type InitInput = string | AnalyticsProperties | undefined;

type CaptureOptions = {
  throttleMs?: number;
};

type QueuedEvent = {
  name: string;
  properties: AnalyticsProperties;
};

const INSTALL_ID_KEY = "localtify.analytics.install_id";
const FIRST_SEEN_KEY = "localtify.analytics.first_seen_at";
const SESSION_ID_KEY = "localtify.analytics.session_id";
const LAUNCH_COUNT_KEY = "localtify.analytics.launch_count";
const LAST_ACTIVE_DAY_KEY = "localtify.analytics.last_active_day";
const LAST_APP_VERSION_KEY = "localtify.analytics.last_app_version";
const FIRST_APP_VERSION_KEY = "localtify.analytics.first_app_version";

const DEFAULT_APP_VERSION = "unknown";
const DEFAULT_HOST = "https://us.i.posthog.com";

const MAX_QUEUED_EVENTS = 50;
const MAX_STRING_LENGTH = 180;

let initialized = false;
let appVersion = DEFAULT_APP_VERSION;
let sessionStartedAt = Date.now();
let cachedInstallId = "";
let cachedSessionId = "";
let loadedOnce = false;
let appLaunchTracked = false;

const pendingEvents: QueuedEvent[] = [];
const throttleTimes = new Map<string, number>();

function safeEnv(name: string): string {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    return String(env?.[name] || "").trim();
  } catch {
    return "";
  }
}

function hasWindowStorage(): boolean {
  try {
    return typeof window !== "undefined" && Boolean(window.localStorage);
  } catch {
    return false;
  }
}

function safeStorageGet(key: string): string {
  try {
    if (!hasWindowStorage()) return "";
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function safeStorageSet(key: string, value: string): void {
  try {
    if (!hasWindowStorage()) return;
    window.localStorage.setItem(key, value);
  } catch {
    // Analytics must never break the player.
  }
}

function createId(prefix: string): string {
  const cryptoRef =
    typeof globalThis !== "undefined" && "crypto" in globalThis ? globalThis.crypto : undefined;

  if (cryptoRef && typeof cryptoRef.randomUUID === "function") {
    return `${prefix}_${cryptoRef.randomUUID()}`;
  }

  if (cryptoRef && typeof cryptoRef.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoRef.getRandomValues(bytes);

    const randomHex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${prefix}_${Date.now().toString(36)}-${randomHex}`;
  }

  return `${prefix}_${Date.now().toString(36)}`;
}

function getInstallId(): string {
  if (cachedInstallId) return cachedInstallId;

  const existing = safeStorageGet(INSTALL_ID_KEY);
  if (existing) {
    cachedInstallId = existing;
    return cachedInstallId;
  }

  cachedInstallId = createId("lt_install");
  safeStorageSet(INSTALL_ID_KEY, cachedInstallId);
  return cachedInstallId;
}

function createSessionId(): string {
  cachedSessionId = createId("lt_session");
  safeStorageSet(SESSION_ID_KEY, cachedSessionId);
  return cachedSessionId;
}

function getSessionId(): string {
  if (cachedSessionId) return cachedSessionId;

  const existing = safeStorageGet(SESSION_ID_KEY);
  if (existing) {
    cachedSessionId = existing;
    return cachedSessionId;
  }

  return createSessionId();
}

function getFirstSeenAt(): string {
  const existing = safeStorageGet(FIRST_SEEN_KEY);
  if (existing) return existing;

  const now = new Date().toISOString();
  safeStorageSet(FIRST_SEEN_KEY, now);
  return now;
}

function incrementLaunchCountOnce(): number {
  const previous = Number.parseInt(safeStorageGet(LAUNCH_COUNT_KEY) || "0", 10) || 0;

  if (appLaunchTracked) return previous;

  const next = previous + 1;
  appLaunchTracked = true;
  safeStorageSet(LAUNCH_COUNT_KEY, String(next));
  return next;
}

function getLaunchCount(): number {
  return Number.parseInt(safeStorageGet(LAUNCH_COUNT_KEY) || "0", 10) || 0;
}

function getTodayKey(): string {
  try {
    return new Date().toISOString().slice(0, 10);
  } catch {
    return "unknown";
  }
}

function markDailyActive(): boolean {
  const today = getTodayKey();
  const previous = safeStorageGet(LAST_ACTIVE_DAY_KEY);
  safeStorageSet(LAST_ACTIVE_DAY_KEY, today);
  return previous !== today;
}

function isPlainObject(value: unknown): value is AnalyticsProperties {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown, fallback = "unknown"): string {
  const cleaned = String(value ?? "").replace(/\s+/g, " ").trim();
  return cleaned || fallback;
}

function cleanNumber(value: unknown, fallback = 0): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function cleanBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function cleanEventName(value: unknown): string {
  const name = cleanString(value, "unknown_event")
    .toLowerCase()
    .replace(/[^a-z0-9_.$-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);

  return name || "unknown_event";
}

function cleanScreenName(view: unknown): string {
  return (
    cleanString(view, "home")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 48) || "home"
  );
}

function cleanKey(value: unknown): string {
  return cleanString(value, "")
    .replace(/[^a-zA-Z0-9_.$-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
}

function scrubSensitiveText(value: string): string {
  return value
    .replace(/[a-zA-Z]:\\[^\n\r\t)]+/g, "[path]")
    .replace(/\\\\[^\\\s]+\\[^\n\r\t)]+/g, "[path]")
    .replace(/\/Users\/[^\n\r\t)]+/g, "[path]")
    .replace(/\/home\/[^\n\r\t)]+/g, "[path]")
    .replace(/file:\/\/[^\s)]+/g, "[file]")
    .replace(/https?:\/\/[^\s)]+/g, "[url]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .slice(0, MAX_STRING_LENGTH);
}

function isSensitivePropertyKey(key: string): boolean {
  const normalized = key.toLowerCase();

  const safeExact = new Set([
    "app_name",
    "app_version",
    "app_platform",
    "browser_family",
    "category",
    "control",
    "current_version",
    "device_kind",
    "direction",
    "error_code",
    "error_kind",
    "feature",
    "flow_step",
    "host",
    "import_source",
    "latest_version",
    "library_view",
    "locale",
    "mode",
    "os_name",
    "os_platform",
    "page",
    "reason",
    "repeat_mode",
    "result_type",
    "screen_name",
    "section",
    "source",
    "status",
    "theme_id",
    "update_status",
    "user_agent_family",
    "view",
    "$current_url",
    "$host",
    "$pathname"
  ]);

  if (safeExact.has(normalized)) return false;

  const safeSuffixes = [
    "_count",
    "_total",
    "_seconds",
    "_minutes",
    "_hours",
    "_ms",
    "_bucket",
    "_enabled",
    "_active",
    "_visible",
    "_opened",
    "_closed",
    "_success",
    "_failed",
    "_used",
    "_changed",
    "_selected",
    "_ratio",
    "_percent"
  ];

  if (safeSuffixes.some((suffix) => normalized.endsWith(suffix))) return false;
  if (normalized.startsWith("is_") || normalized.startsWith("has_")) return false;

  const sensitiveParts = [
    "song_title",
    "track_title",
    "artist_name",
    "album_name",
    "filename",
    "file_name",
    "file_path",
    "filepath",
    "path",
    "url",
    "query",
    "lyrics",
    "email",
    "token"
  ];

  if (sensitiveParts.some((part) => normalized.includes(part))) return true;

  return ["title", "artist", "album", "name"].includes(normalized);
}

function sanitizeProperties(properties: AnalyticsProperties = {}): AnalyticsProperties {
  const safe: AnalyticsProperties = {};

  for (const [rawKey, rawValue] of Object.entries(properties)) {
    if (rawValue === undefined) continue;

    const key = cleanKey(rawKey);
    if (!key) continue;

    if (isSensitivePropertyKey(key)) {
      if (typeof rawValue === "number") {
        safe[key] = Number.isFinite(rawValue) ? rawValue : 0;
      } else if (typeof rawValue === "boolean" || rawValue === null) {
        safe[key] = rawValue;
      } else {
        safe[key] = "[redacted]";
      }
      continue;
    }

    if (typeof rawValue === "string") {
      safe[key] = scrubSensitiveText(rawValue);
      continue;
    }

    if (typeof rawValue === "number") {
      safe[key] = Number.isFinite(rawValue) ? rawValue : 0;
      continue;
    }

    if (typeof rawValue === "boolean" || rawValue === null) {
      safe[key] = rawValue;
    }
  }

  return safe;
}


function getLocaleParts(): AnalyticsProperties {
  let locale = "unknown";

  try {
    locale = cleanString(navigator.language || "unknown", "unknown").replace("_", "-").slice(0, 32);
  } catch {
    locale = "unknown";
  }

  const [, regionCode] = locale.split("-");

  return {
    locale_region: cleanString(regionCode, "unknown").toUpperCase().slice(0, 12) // country/region only
  };
}

function bucketCount(value: unknown): string {
  const count = Math.max(0, Math.floor(cleanNumber(value, 0)));

  if (count <= 0) return "0";
  if (count <= 5) return "1-5";
  if (count <= 15) return "6-15";
  if (count <= 50) return "16-50";
  if (count <= 150) return "51-150";
  if (count <= 500) return "151-500";
  if (count <= 1500) return "501-1500";
  return "1500+";
}

function bucketSeconds(value: unknown): string {
  const seconds = Math.max(0, Math.floor(cleanNumber(value, 0)));
  const hours = seconds / 3600;

  if (seconds <= 0) return "0";
  if (hours < 1) return "under_1h";
  if (hours < 5) return "1-5h";
  if (hours < 20) return "5-20h";
  if (hours < 75) return "20-75h";
  if (hours < 250) return "75-250h";
  if (hours < 1000) return "250-1000h";
  return "1000h+";
}

function bucketLaunchCount(value: unknown): string {
  const count = Math.max(0, Math.floor(cleanNumber(value, 0)));

  if (count <= 1) return "first_launch";
  if (count <= 3) return "2-3_launches";
  if (count <= 10) return "4-10_launches";
  if (count <= 30) return "11-30_launches";
  return "31_plus_launches";
}

function bucketDays(value: unknown): string {
  const days = Math.max(0, Math.floor(cleanNumber(value, 0)));

  if (days <= 0) return "new_today";
  if (days <= 2) return "1-2_days";
  if (days <= 7) return "3-7_days";
  if (days <= 30) return "8-30_days";
  if (days <= 90) return "31-90_days";
  return "90_plus_days";
}

function addAudienceBuckets(properties: AnalyticsProperties = {}): AnalyticsProperties {
  const output: AnalyticsProperties = { ...properties };

  const countKeys = [
    "song_count",
    "liked_count",
    "playlist_count",
    "playlist_song_total",
    "queue_count",
    "played_song_count",
    "artist_count",
    "album_count",
    "recent_import_count",
    "download_result_count",
    "cover_count"
  ];

  countKeys.forEach((key) => {
    if (properties[key] !== undefined && output[`${key}_bucket`] === undefined) {
      output[`${key}_bucket`] = bucketCount(properties[key]);
    }
  });

  const durationKeys = ["library_duration_seconds", "playlist_duration_seconds", "session_length_seconds"];
  durationKeys.forEach((key) => {
    if (properties[key] !== undefined && output[`${key}_bucket`] === undefined) {
      output[`${key}_bucket`] = bucketSeconds(properties[key]);
    }
  });

  if (properties.days_since_first_seen !== undefined && output.install_age_bucket === undefined) {
    output.install_age_bucket = bucketDays(properties.days_since_first_seen);
  }

  if (properties.launch_count !== undefined && output.launch_count_bucket === undefined) {
    output.launch_count_bucket = bucketLaunchCount(properties.launch_count);
  }

  return output;
}


function getDeviceProperties(): AnalyticsProperties {
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  const platform = typeof navigator !== "undefined" ? navigator.platform || "unknown" : "unknown";
  const language = typeof navigator !== "undefined" ? navigator.language || "unknown" : "unknown";

  let osName = "unknown";
  if (userAgent.includes("Win")) osName = "windows";
  else if (userAgent.includes("Mac")) osName = "macos";
  else if (userAgent.includes("Linux")) osName = "linux";

  let userAgentFamily = "unknown";
  if (userAgent.includes("Electron")) userAgentFamily = "electron";
  else if (userAgent.includes("Edg")) userAgentFamily = "edge";
  else if (userAgent.includes("Chrome")) userAgentFamily = "chromium";
  else if (userAgent.includes("Firefox")) userAgentFamily = "firefox";
  else if (userAgent.includes("Safari")) userAgentFamily = "safari";

  return {
    app_platform: "electron",
    device_kind: "desktop",
    os_name: osName,
    os_platform: platform,
    user_agent_family: userAgentFamily,
    ...getLocaleParts()
  };
}

function getVersionProperties(): AnalyticsProperties {
  const firstVersion = safeStorageGet(FIRST_APP_VERSION_KEY);
  const previousVersion = safeStorageGet(LAST_APP_VERSION_KEY);

  if (!firstVersion && appVersion !== DEFAULT_APP_VERSION) {
    safeStorageSet(FIRST_APP_VERSION_KEY, appVersion);
  }

  const versionChanged = Boolean(previousVersion && previousVersion !== appVersion);
  if (appVersion !== DEFAULT_APP_VERSION) {
    safeStorageSet(LAST_APP_VERSION_KEY, appVersion);
  }

  return {
    first_app_version: firstVersion || appVersion,
    previous_app_version: previousVersion || null,
    version_changed: versionChanged,
    is_first_run_after_update: versionChanged
  };
}

function baseProperties(extra: AnalyticsProperties = {}): AnalyticsProperties {
  const firstSeenAt = getFirstSeenAt();
  const firstSeenMs = Date.parse(firstSeenAt);
  const sessionAgeSeconds = Math.max(0, Math.round((Date.now() - sessionStartedAt) / 1000));
  const daysSinceFirstSeen = Number.isFinite(firstSeenMs)
    ? Math.max(0, Math.floor((Date.now() - firstSeenMs) / 86_400_000))
    : 0;

  return sanitizeProperties(
    addAudienceBuckets({
      app_name: "localtify",
      app_version: appVersion,
      install_id: getInstallId(),
      session_id: getSessionId(),
      launch_count: getLaunchCount(),
      session_age_seconds: sessionAgeSeconds,
      first_seen_at: firstSeenAt,
      days_since_first_seen: daysSinceFirstSeen,
      launch_count_bucket: bucketLaunchCount(getLaunchCount()),
      install_age_bucket: bucketDays(daysSinceFirstSeen),
      ...getDeviceProperties(),
      ...extra
    })
  );
}

function identifyInstall(properties: AnalyticsProperties = {}): void {
  try {
    const installId = getInstallId();
    const identityProperties = sanitizeProperties({
      app_name: "localtify",
      app_version: appVersion,
      install_id: installId,
      first_seen_at: getFirstSeenAt(),
      ...getDeviceProperties(),
      ...properties
    });

    posthog.identify(installId, identityProperties);

    posthog.register(
      sanitizeProperties({
        app_name: "localtify",
        app_version: appVersion,
        install_id: installId,
        session_id: getSessionId(),
        ...getDeviceProperties()
      })
    );
  } catch {
    // Analytics must never break the player.
  }
}

function pushQueuedEvent(name: string, properties: AnalyticsProperties): void {
  pendingEvents.push({ name, properties });

  if (pendingEvents.length > MAX_QUEUED_EVENTS) {
    pendingEvents.shift();
  }
}

function flushQueuedEvents(): void {
  if (!initialized || !loadedOnce) return;

  while (pendingEvents.length > 0) {
    const event = pendingEvents.shift();
    if (!event) continue;

    try {
      posthog.capture(event.name, baseProperties(event.properties));
    } catch {
      // ignored
    }
  }
}

function isThrottled(key: string, throttleMs = 0): boolean {
  if (!throttleMs) return false;

  const now = Date.now();
  const previous = throttleTimes.get(key) || 0;

  if (now - previous < throttleMs) return true;

  throttleTimes.set(key, now);
  return false;
}

function fireAppPageview(view = "home", source = "unknown", properties: AnalyticsProperties = {}): void {
  if (!initialized) return;

  const screen = cleanScreenName(view);
  const path = `/${screen}`;

  captureLocaltifyEvent(
    "$pageview",
    {
      $current_url: `app://localtify${path}`,
      $host: "localtify",
      $pathname: path,
      screen_name: screen,
      source: cleanString(source, "unknown"),
      ...properties
    },
    { throttleMs: 250 }
  );
}

export function initLocalitfyAnalytics(input?: InitInput): boolean {
  const props = isPlainObject(input) ? input : {};
  appVersion = isPlainObject(input)
    ? cleanString(input.app_version, DEFAULT_APP_VERSION)
    : cleanString(input, DEFAULT_APP_VERSION);

  sessionStartedAt = Date.now();
  appLaunchTracked = false;
  createSessionId();

  const key = safeEnv("VITE_PUBLIC_POSTHOG_KEY");
  const host = safeEnv("VITE_PUBLIC_POSTHOG_HOST") || DEFAULT_HOST;

  if (!key) {
    initialized = false;
    loadedOnce = false;
    return false;
  }

  try {
    if (!initialized) {
      posthog.init(key, {
        api_host: host,
        person_profiles: "identified_only",
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        persistence: "localStorage+cookie",
        loaded: () => {
          loadedOnce = true;
          identifyInstall({ ...props, ...getVersionProperties() });
          fireAppPageview("home", "app_launch", { is_initial_pageview: true });
          flushQueuedEvents();
        }
      } as unknown as Parameters<typeof posthog.init>[1]);

      initialized = true;
    } else {
      loadedOnce = true;
      identifyInstall({ ...props, ...getVersionProperties() });
      fireAppPageview("home", "app_reinit", { is_initial_pageview: true });
      flushQueuedEvents();
    }

    return true;
  } catch {
    initialized = false;
    loadedOnce = false;
    return false;
  }
}

export function identifyLocaltifyInstall(properties: AnalyticsProperties = {}): void {
  identifyInstall(properties);
}

export function captureLocaltifyEvent(
  eventName: string,
  properties: AnalyticsProperties = {},
  options: CaptureOptions = {}
): void {
  if (!initialized) return;

  const name = cleanEventName(eventName);
  if (isThrottled(name, options.throttleMs || 0)) return;

  try {
    if (!loadedOnce) {
      pushQueuedEvent(name, sanitizeProperties(properties));
      return;
    }

    posthog.capture(name, baseProperties(properties));
  } catch {
    // ignored
  }
}

export function trackAppLaunched(properties: AnalyticsProperties = {}): void {
  const launchCount = incrementLaunchCountOnce();
  const firstLaunchToday = markDailyActive();

  captureLocaltifyEvent("app_launched", {
    launch_count: launchCount,
    is_first_launch: launchCount === 1,
    first_launch_today: firstLaunchToday,
    ...getVersionProperties(),
    ...properties
  });
}

export function trackAppActive(
  reasonOrProperties?: string | AnalyticsProperties,
  properties: AnalyticsProperties = {}
): void {
  const extra = isPlainObject(reasonOrProperties)
    ? reasonOrProperties
    : { reason: cleanString(reasonOrProperties, "active"), ...properties };

  captureLocaltifyEvent("app_active", extra, { throttleMs: 30_000 });
}

export function trackAppSessionEnded(properties: AnalyticsProperties = {}): void {
  captureLocaltifyEvent("app_session_ended", {
    session_length_seconds: Math.max(0, Math.round((Date.now() - sessionStartedAt) / 1000)),
    ...properties
  });
}

export function trackAppBackgrounded(properties: AnalyticsProperties = {}): void {
  captureLocaltifyEvent("app_backgrounded", {
    session_age_seconds: Math.max(0, Math.round((Date.now() - sessionStartedAt) / 1000)),
    ...properties
  });
}

export function trackAppForegrounded(properties: AnalyticsProperties = {}): void {
  markDailyActive();
  fireAppPageview(cleanString(properties.current_view, "home"), "foreground", properties);
  captureLocaltifyEvent("app_foregrounded", properties);
}

export function trackAppView(
  viewOrProperties?: string | AnalyticsProperties,
  source = "unknown",
  properties: AnalyticsProperties = {}
): void {
  const screen = isPlainObject(viewOrProperties)
    ? cleanScreenName(viewOrProperties.screen_name || viewOrProperties.view)
    : cleanScreenName(viewOrProperties);

  const extra = isPlainObject(viewOrProperties)
    ? viewOrProperties
    : { screen_name: screen, view: screen, source: cleanString(source, "unknown"), ...properties };

  fireAppPageview(screen, cleanString(extra.source, source), extra);
  captureLocaltifyEvent("app_screen_viewed", extra, { throttleMs: 250 });
}

export function trackNavigationClicked(sectionOrProperties?: string | AnalyticsProperties): void {
  const properties = isPlainObject(sectionOrProperties)
    ? sectionOrProperties
    : { section: cleanScreenName(sectionOrProperties), source: "sidebar" };

  captureLocaltifyEvent("navigation_clicked", properties);
}

export function trackLibrarySnapshot(properties: AnalyticsProperties = {}): void {
  captureLocaltifyEvent("library_snapshot", properties, { throttleMs: 60_000 });
}

export function trackLibraryLoaded(properties: AnalyticsProperties = {}): void {
  captureLocaltifyEvent("library_loaded", properties);
}

export function trackLibrarySizeChanged(songCount: number, albumCount?: number, artistCount?: number): void {
  captureLocaltifyEvent("library_size_changed", {
    song_count: Math.max(0, Math.floor(cleanNumber(songCount))),
    album_count: albumCount != null ? Math.max(0, Math.floor(cleanNumber(albumCount))) : null,
    artist_count: artistCount != null ? Math.max(0, Math.floor(cleanNumber(artistCount))) : null
  });
}

export function trackLibraryViewChanged(
  viewOrProperties?: string | AnalyticsProperties,
  source = "unknown"
): void {
  const properties = isPlainObject(viewOrProperties)
    ? viewOrProperties
    : { library_view: cleanString(viewOrProperties, "unknown"), source: cleanString(source, "unknown") };

  captureLocaltifyEvent("library_view_changed", properties);
}

export function trackLibrarySortChanged(sortOrProperties?: string | AnalyticsProperties): void {
  const properties = isPlainObject(sortOrProperties)
    ? sortOrProperties
    : { mode: cleanString(sortOrProperties, "unknown") };

  captureLocaltifyEvent("library_sort_changed", properties);
}

export function trackLibraryFilterChanged(filterOrProperties?: string | AnalyticsProperties): void {
  const properties = isPlainObject(filterOrProperties)
    ? filterOrProperties
    : { mode: cleanString(filterOrProperties, "unknown") };

  captureLocaltifyEvent("library_filter_changed", properties, { throttleMs: 2_000 });
}

export function trackLibraryScrollDepth(percentOrProperties?: number | AnalyticsProperties): void {
  const properties = isPlainObject(percentOrProperties)
    ? percentOrProperties
    : { scroll_percent: Math.max(0, Math.min(100, Math.round(cleanNumber(percentOrProperties, 0)))) };

  captureLocaltifyEvent("library_scroll_depth", properties, { throttleMs: 10_000 });
}

export function trackPlaybackStarted(properties: AnalyticsProperties = {}): void {
  captureLocaltifyEvent("playback_started", properties);
}

export function trackPlaybackPaused(positionSeconds?: number, properties: AnalyticsProperties = {}): void {
  captureLocaltifyEvent("playback_paused", {
    position_seconds: positionSeconds != null ? Math.max(0, Math.round(cleanNumber(positionSeconds))) : null,
    ...properties
  });
}

export function trackPlaybackSkipped(
  directionOrProperties?: "next" | "prev" | AnalyticsProperties,
  properties: AnalyticsProperties = {}
): void {
  const extra = isPlainObject(directionOrProperties)
    ? directionOrProperties
    : { direction: cleanString(directionOrProperties, "next"), ...properties };

  captureLocaltifyEvent("playback_skipped", extra);
}

export function trackPlaybackCompleted(durationSeconds?: number, properties: AnalyticsProperties = {}): void {
  captureLocaltifyEvent("playback_completed", {
    duration_seconds: durationSeconds != null ? Math.max(0, Math.round(cleanNumber(durationSeconds))) : null,
    ...properties
  });
}

export function trackPlayerControlUsed(controlOrProperties?: string | AnalyticsProperties): void {
  const properties = isPlainObject(controlOrProperties)
    ? controlOrProperties
    : { control: cleanString(controlOrProperties, "unknown") };

  captureLocaltifyEvent("player_control_used", properties, { throttleMs: 100 });
}

export function trackPlayerModeChanged(modeOrProperties?: string | AnalyticsProperties): void {
  const properties = isPlainObject(modeOrProperties)
    ? modeOrProperties
    : { mode: cleanString(modeOrProperties, "unknown") };

  captureLocaltifyEvent("player_mode_changed", properties);
}

export function trackShuffleModeChanged(enabled: boolean): void {
  captureLocaltifyEvent("shuffle_mode_changed", { enabled: cleanBoolean(enabled) });
}

export function trackRepeatModeChanged(mode: "none" | "one" | "all" | string): void {
  captureLocaltifyEvent("repeat_mode_changed", { repeat_mode: cleanString(mode) });
}

export function trackVolumeChanged(volumePercent: number, properties: AnalyticsProperties = {}): void {
  const bucket = Math.max(0, Math.min(100, Math.round(cleanNumber(volumePercent, 50) / 10) * 10));
  captureLocaltifyEvent("volume_changed", { volume_bucket: bucket, ...properties }, { throttleMs: 5_000 });
}

export function trackSeekUsed(properties: AnalyticsProperties = {}): void {
  captureLocaltifyEvent("seek_used", properties, { throttleMs: 2_000 });
}

export function trackQueueModified(actionOrProperties?: string | AnalyticsProperties): void {
  const properties = isPlainObject(actionOrProperties)
    ? actionOrProperties
    : { action: cleanString(actionOrProperties, "unknown") };

  captureLocaltifyEvent("queue_modified", properties);
}

export function trackSongLikedToggled(likedOrProperties?: boolean | AnalyticsProperties): void {
  const properties = isPlainObject(likedOrProperties)
    ? likedOrProperties
    : { is_liked: cleanBoolean(likedOrProperties) };

  captureLocaltifyEvent("song_liked_toggled", properties);
}

export function trackSongActionUsed(actionOrProperties?: string | AnalyticsProperties): void {
  const properties = isPlainObject(actionOrProperties)
    ? actionOrProperties
    : { action: cleanString(actionOrProperties, "unknown") };

  captureLocaltifyEvent("song_action_used", properties);
}

export function trackSongsImported(countOrProperties?: number | AnalyticsProperties, source = "unknown"): void {
  const properties = isPlainObject(countOrProperties)
    ? countOrProperties
    : { count: Math.max(0, Math.floor(cleanNumber(countOrProperties, 0))), source: cleanString(source, "unknown") };

  captureLocaltifyEvent("songs_imported", properties);
}

export function trackImportStarted(sourceOrProperties?: string | AnalyticsProperties): void {
  const properties = isPlainObject(sourceOrProperties)
    ? sourceOrProperties
    : { source: cleanString(sourceOrProperties, "unknown") };

  captureLocaltifyEvent("import_started", properties);
}

export function trackImportStep(stepOrProperties?: string | AnalyticsProperties): void {
  const properties = isPlainObject(stepOrProperties)
    ? stepOrProperties
    : { flow_step: cleanString(stepOrProperties, "unknown") };

  captureLocaltifyEvent("import_step", properties, { throttleMs: 500 });
}

export function trackImportFailed(reasonOrProperties?: string | AnalyticsProperties, source = "unknown"): void {
  const properties = isPlainObject(reasonOrProperties)
    ? reasonOrProperties
    : { reason: cleanString(reasonOrProperties, "unknown"), source: cleanString(source, "unknown") };

  captureLocaltifyEvent("import_failed", properties);
}

export function trackDownloadsOpened(sourceOrProperties?: string | AnalyticsProperties): void {
  const properties = isPlainObject(sourceOrProperties)
    ? sourceOrProperties
    : { source: cleanString(sourceOrProperties, "unknown") };

  captureLocaltifyEvent("downloads_opened", properties);
}

export function trackDownloadStarted(properties: AnalyticsProperties = {}): void {
  captureLocaltifyEvent("download_started", properties);
}

export function trackDownloadCompleted(properties: AnalyticsProperties = {}): void {
  captureLocaltifyEvent("download_completed", properties);
}

export function trackDownloadFailed(reasonOrProperties?: string | AnalyticsProperties): void {
  const properties = isPlainObject(reasonOrProperties)
    ? reasonOrProperties
    : { reason: cleanString(reasonOrProperties, "unknown") };

  captureLocaltifyEvent("download_failed", properties);
}

export function trackSearchPerformed(resultCount?: number, properties: AnalyticsProperties = {}): void {
  captureLocaltifyEvent(
    "search_performed",
    {
      result_count: resultCount != null ? Math.max(0, Math.floor(cleanNumber(resultCount))) : null,
      ...properties
    },
    { throttleMs: 3_000 }
  );
}

export function trackSearchResultSelected(resultTypeOrProperties?: string | AnalyticsProperties): void {
  const properties = isPlainObject(resultTypeOrProperties)
    ? resultTypeOrProperties
    : { result_type: cleanString(resultTypeOrProperties, "unknown") };

  captureLocaltifyEvent("search_result_selected", properties);
}

export function trackPlaylistCreated(properties: AnalyticsProperties = {}): void {
  captureLocaltifyEvent("playlist_created", properties);
}

export function trackPlaylistOpened(properties: AnalyticsProperties = {}): void {
  captureLocaltifyEvent("playlist_opened", properties);
}

export function trackPlaylistModified(actionOrProperties?: string | AnalyticsProperties): void {
  const properties = isPlainObject(actionOrProperties)
    ? actionOrProperties
    : { action: cleanString(actionOrProperties, "unknown") };

  captureLocaltifyEvent("playlist_modified", properties);
}

export function trackSettingsOpened(sourceOrProperties?: string | AnalyticsProperties): void {
  const properties = isPlainObject(sourceOrProperties)
    ? sourceOrProperties
    : { source: cleanString(sourceOrProperties, "unknown") };

  captureLocaltifyEvent("settings_opened", properties);
}

export function trackSettingsAnalytics(properties: AnalyticsProperties = {}): void {
  captureLocaltifyEvent("settings_changed", properties);
}

export function trackSettingChanged(settingOrProperties?: string | AnalyticsProperties, value?: AnalyticsValue): void {
  const properties = isPlainObject(settingOrProperties)
    ? settingOrProperties
    : { setting: cleanString(settingOrProperties, "unknown"), value: value ?? null };

  captureLocaltifyEvent("setting_changed", properties);
}

export function trackThemeChanged(themeOrProperties?: string | AnalyticsProperties, customThemeEnabled = false): void {
  const properties = isPlainObject(themeOrProperties)
    ? themeOrProperties
    : { theme_id: cleanString(themeOrProperties, "unknown"), custom_theme_enabled: cleanBoolean(customThemeEnabled) };

  captureLocaltifyEvent("theme_changed", properties);
}

export function trackThemeEditorOpened(sourceOrProperties?: string | AnalyticsProperties): void {
  const properties = isPlainObject(sourceOrProperties)
    ? sourceOrProperties
    : { source: cleanString(sourceOrProperties, "settings") };

  captureLocaltifyEvent("theme_editor_opened", properties);
}

export function trackThemeEditorChanged(fieldOrProperties?: string | AnalyticsProperties): void {
  const properties = isPlainObject(fieldOrProperties)
    ? fieldOrProperties
    : { field: cleanString(fieldOrProperties, "unknown") };

  captureLocaltifyEvent("theme_editor_changed", properties, { throttleMs: 2_000 });
}

export function trackLanguageChanged(locale: string): void {
  captureLocaltifyEvent("language_changed", { locale: cleanString(locale) });
}

export function trackVisualEffectChanged(effectOrProperties?: string | AnalyticsProperties, enabled = false): void {
  const properties = isPlainObject(effectOrProperties)
    ? effectOrProperties
    : { feature: cleanString(effectOrProperties, "unknown"), enabled: cleanBoolean(enabled) };

  captureLocaltifyEvent("visual_effect_changed", properties);
}

export function trackHotkeyUsed(actionOrProperties?: string | AnalyticsProperties): void {
  const properties = isPlainObject(actionOrProperties)
    ? actionOrProperties
    : { action: cleanString(actionOrProperties, "unknown") };

  captureLocaltifyEvent("hotkey_used", properties, { throttleMs: 300 });
}

export function trackDiscordToggled(enabledOrProperties?: boolean | AnalyticsProperties): void {
  const properties = isPlainObject(enabledOrProperties)
    ? enabledOrProperties
    : { enabled: cleanBoolean(enabledOrProperties) };

  captureLocaltifyEvent("discord_toggled", properties);
}

export function trackDiscordStatus(statusOrProperties?: string | AnalyticsProperties): void {
  const properties = isPlainObject(statusOrProperties)
    ? statusOrProperties
    : { status: cleanString(statusOrProperties, "unknown") };

  captureLocaltifyEvent("discord_status", properties, { throttleMs: 10_000 });
}

export function trackUpdatePopupSeen(
  statusOrProperties?: string | AnalyticsProperties,
  currentVersion?: string,
  latestVersion?: string
): void {
  const properties = isPlainObject(statusOrProperties)
    ? statusOrProperties
    : {
        update_status: cleanString(statusOrProperties, "seen"),
        current_version: cleanString(currentVersion || appVersion, appVersion),
        latest_version: latestVersion ? cleanString(latestVersion) : null
      };

  captureLocaltifyEvent("update_popup_seen", properties);
}

export function trackUpdateInstalled(properties: AnalyticsProperties = {}): void {
  captureLocaltifyEvent("update_installed", properties);
}

export function trackUpdateDismissed(properties: AnalyticsProperties = {}): void {
  captureLocaltifyEvent("update_dismissed", properties);
}

export function trackOnboardingCompleted(sourceOrProperties?: string | AnalyticsProperties, songCount = 0): void {
  const properties = isPlainObject(sourceOrProperties)
    ? sourceOrProperties
    : { source: cleanString(sourceOrProperties, "onboarding"), song_count: Math.max(0, Math.floor(cleanNumber(songCount))) };

  captureLocaltifyEvent("onboarding_completed", properties);
}

export function trackOnboardingSkipped(sourceOrProperties?: string | AnalyticsProperties, songCount = 0): void {
  const properties = isPlainObject(sourceOrProperties)
    ? sourceOrProperties
    : { source: cleanString(sourceOrProperties, "onboarding"), song_count: Math.max(0, Math.floor(cleanNumber(songCount))) };

  captureLocaltifyEvent("onboarding_skipped", properties);
}

export function trackOnboardingStepViewed(stepOrProperties?: string | number | AnalyticsProperties): void {
  const properties = isPlainObject(stepOrProperties)
    ? stepOrProperties
    : { step: typeof stepOrProperties === "number" ? stepOrProperties : cleanString(stepOrProperties, "unknown") };

  captureLocaltifyEvent("onboarding_step_viewed", properties);
}

export function trackCoverStudioOpened(sourceOrProperties?: string | AnalyticsProperties): void {
  const properties = isPlainObject(sourceOrProperties)
    ? sourceOrProperties
    : { source: cleanString(sourceOrProperties, "unknown") };

  captureLocaltifyEvent("cover_studio_opened", properties);
}

export function trackCoverChanged(sourceOrProperties?: string | AnalyticsProperties): void {
  const properties = isPlainObject(sourceOrProperties)
    ? sourceOrProperties
    : { source: cleanString(sourceOrProperties, "unknown") };

  captureLocaltifyEvent("cover_changed", properties);
}

export function trackCoverRandomized(countOrProperties?: number | AnalyticsProperties): void {
  const properties = isPlainObject(countOrProperties)
    ? countOrProperties
    : { count: Math.max(0, Math.floor(cleanNumber(countOrProperties, 0))) };

  captureLocaltifyEvent("cover_randomized", properties);
}

export function trackCoverLoadFailed(reasonOrProperties?: string | AnalyticsProperties): void {
  const properties = isPlainObject(reasonOrProperties)
    ? reasonOrProperties
    : { reason: cleanString(reasonOrProperties, "unknown") };

  captureLocaltifyEvent("cover_load_failed", properties, { throttleMs: 10_000 });
}

export function trackPixelCoverCache(properties: AnalyticsProperties = {}): void {
  captureLocaltifyEvent("pixel_cover_cache", properties, { throttleMs: 5_000 });
}

export function trackModalOpened(modalOrProperties?: string | AnalyticsProperties): void {
  const properties = isPlainObject(modalOrProperties)
    ? modalOrProperties
    : { section: cleanString(modalOrProperties, "unknown") };

  captureLocaltifyEvent("modal_opened", properties);
}

export function trackModalClosed(modalOrProperties?: string | AnalyticsProperties): void {
  const properties = isPlainObject(modalOrProperties)
    ? modalOrProperties
    : { section: cleanString(modalOrProperties, "unknown") };

  captureLocaltifyEvent("modal_closed", properties);
}

export function trackPerformanceMetric(nameOrProperties?: string | AnalyticsProperties, valueMs?: number): void {
  const properties = isPlainObject(nameOrProperties)
    ? nameOrProperties
    : {
        metric: cleanString(nameOrProperties, "unknown"),
        duration_ms: valueMs != null ? Math.max(0, Math.round(cleanNumber(valueMs))) : null
      };

  captureLocaltifyEvent("performance_metric", properties, { throttleMs: 2_000 });
}

export function trackStartupTiming(stageOrProperties?: string | AnalyticsProperties, valueMs?: number): void {
  const properties = isPlainObject(stageOrProperties)
    ? stageOrProperties
    : {
        flow_step: cleanString(stageOrProperties, "unknown"),
        duration_ms: valueMs != null ? Math.max(0, Math.round(cleanNumber(valueMs))) : null
      };

  captureLocaltifyEvent("startup_timing", properties);
}

export function trackError(
  categoryOrProperties?: string | AnalyticsProperties,
  message?: string,
  properties: AnalyticsProperties = {}
): void {
  const extra = isPlainObject(categoryOrProperties)
    ? categoryOrProperties
    : {
        category: cleanString(categoryOrProperties, "unknown"),
        message: scrubSensitiveText(cleanString(message, "unknown")),
        ...properties
      };

  captureLocaltifyEvent("app_error", extra);
}

export function trackCrashRecovery(properties: AnalyticsProperties = {}): void {
  captureLocaltifyEvent("crash_recovery", properties);
}

export function trackFeatureDiscovered(featureOrProperties?: string | AnalyticsProperties, source = "unknown"): void {
  const properties = isPlainObject(featureOrProperties)
    ? featureOrProperties
    : { feature: cleanString(featureOrProperties, "unknown"), source: cleanString(source, "unknown") };

  captureLocaltifyEvent("feature_discovered", properties);
}

export function trackFeatureUsed(featureOrProperties?: string | AnalyticsProperties, properties: AnalyticsProperties = {}): void {
  const extra = isPlainObject(featureOrProperties)
    ? featureOrProperties
    : { feature: cleanString(featureOrProperties, "unknown"), ...properties };

  captureLocaltifyEvent("feature_used", extra);
}


export function trackAudienceSnapshot(properties: AnalyticsProperties = {}): void {
  captureLocaltifyEvent(
    "audience_snapshot",
    addAudienceBuckets({
      snapshot_type: "coarse_usage",
      ...properties
    }),
    { throttleMs: 10 * 60_000 }
  );
}

export function trackMarketingSnapshot(properties: AnalyticsProperties = {}): void {
  captureLocaltifyEvent(
    "marketing_snapshot",
    addAudienceBuckets({
      snapshot_type: "marketing_fit",
      ...properties
    }),
    { throttleMs: 15 * 60_000 }
  );
}

export function trackPlaylistSnapshot(properties: AnalyticsProperties = {}): void {
  captureLocaltifyEvent(
    "playlist_snapshot",
    addAudienceBuckets({
      snapshot_type: "playlists",
      ...properties
    }),
    { throttleMs: 10 * 60_000 }
  );
}

export function trackAcquisitionSource(properties: AnalyticsProperties = {}): void {
  captureLocaltifyEvent(
    "acquisition_source_seen",
    addAudienceBuckets({
      source: "direct_app_launch",
      ...properties
    }),
    { throttleMs: 60 * 60_000 }
  );
}


export function resetLocaltifyAnalyticsIdentity(): void {
  try {
    posthog.reset();
  } catch {
    // ignored
  }

  cachedInstallId = createId("lt_install");
  cachedSessionId = createId("lt_session");
  safeStorageSet(INSTALL_ID_KEY, cachedInstallId);
  safeStorageSet(SESSION_ID_KEY, cachedSessionId);
  safeStorageSet(FIRST_SEEN_KEY, new Date().toISOString());
  safeStorageSet(LAST_ACTIVE_DAY_KEY, "");
  safeStorageSet(LAST_APP_VERSION_KEY, appVersion);
  safeStorageSet(FIRST_APP_VERSION_KEY, appVersion);

  identifyInstall();
}
