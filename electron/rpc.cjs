const RPC = require("discord-rpc");

const CLIENT_ID = "1499896817138012271";

const APP_NAME = "localtify";
const DEFAULT_LOGO_ASSET = "earthglow";

const DEFAULT_DOWNLOAD_URL = "https://github.com/meshahid973/localitfy/releases/latest";
const DEFAULT_SOURCE_URL = "https://github.com/meshahid973/localitfy";

const ACTIVITY_THROTTLE_MS = 900;
const SAME_SONG_REFRESH_MS = 12000;
const BUTTON_FORCE_REFRESH_MS = 30000;
const RECONNECT_DELAY_MS = 6500;
const STARTUP_CLEAR_DELAY_MS = 450;
const CLEAR_BEFORE_SET_DELAY_MS = 180;
const BUTTON_DOUBLE_PUSH_DELAY_MS = 650;

// Discord activity type 2 = LISTENING.
// The discord-rpc setActivity helper drops name/type, so Localtify sends
// a raw SET_ACTIVITY payload below to preserve the music presence header.
const DISCORD_ACTIVITY_TYPE_LISTENING = 2;
const DISCORD_ACTIVITY_NAME = APP_NAME;

/*
  IMPORTANT:
  These must be REAL Discord Developer Portal asset keys.
  I only kept the keys visible from your Discord assets screen so it avoids question mark images.
*/
const PIXEL_ART_ASSETS = [
  "earthglow",
  "mikuu",
  "somegirllooking",
  "starpersonlookup",
  "2cats",
  "2tankpeople",
  "4glasses",
  "animepixell",
  "blackcat",
  "blackcatlaying",
  "callhello",
  "catinspace",
  "catquestion",
  "content",
  "erikaringingyobell",
  "gumball",
  "mikuinfortnite",
  "mitapixel",
  "peaceanime",
  "smallcatwithwand",
  "smallmita",
  "somegirl",
  "spaceearth"
];

const ASSET_ALIASES = {
  animepixel: "animepixell",
  animepixell: "animepixell",

  mikuuu: "mikuu",
  miku: "mikuu",
  mikuu: "mikuu",

  mikuufortnite: "mikuinfortnite",
  mikuuinfortnite: "mikuinfortnite",
  mikuinfortnite: "mikuinfortnite",

  erikaringingbell: "erikaringingyobell",
  erikaringingyobell: "erikaringingyobell",

  starpersonlookupp: "starpersonlookup",
  starpersonlookup: "starpersonlookup",

  spacemeteor: "spaceearth",
  spacemetor: "spaceearth",

  marie: "smallmita",
  mitu: "mitapixel",
  beachhouse: "spaceearth",
  beachhousejpg: "spaceearth"
};

const SAFE_ART_ASSETS = [...new Set(PIXEL_ART_ASSETS.map(cleanAssetKey).filter(Boolean))];

let client = null;
let connectingPromise = null;
let registered = false;

let lastActivitySignature = "";
let lastImportantSignature = "";
let lastSongIdentity = "";
let lastImageKey = "";
let lastButtonSignature = "";
let lastSetAt = 0;
let lastButtonRefreshAt = 0;
let nextReconnectAt = 0;
let lastLoggedSignature = "";
let didStartupClear = false;
let shuttingDown = false;

/*
  Dynamic Discord art system:
  - every song selection gets the next unused Discord asset
  - no repeat until the full list is used
  - going back to an old song still gets a new image
*/
let dynamicDiscordAssetKey = "";
let dynamicDiscordAssetSongIdentity = "";
let dynamicDiscordAssetSession = 0;
let dynamicAssetDeck = [];
let dynamicUsedAssets = new Set();
let lastPayloadSongIdentity = "";
let lastPayloadCurrentTime = 0;
let lastPayloadIsPlaying = false;
let lastDynamicAssetChangeAt = 0;
let lastSelectionSignature = "";

const rpcStatus = {
  connected: false,
  connecting: false,
  enabled: true,
  lastError: "",
  lastAction: "idle",
  lastUpdatedAt: 0,
  lastClearedAt: 0,
  reconnectAt: 0,
  asset: "",
  song: "",
  buttons: false
};

function setStatus(patch = {}) {
  Object.assign(rpcStatus, patch, { reconnectAt: nextReconnectAt || 0 });
}

function getDiscordStatus() {
  return {
    ...rpcStatus,
    hasClient: Boolean(client),
    registered,
    nextReconnectAt,
    usedArtCount: dynamicUsedAssets.size,
    safeArtCount: SAFE_ART_ASSETS.length,
    lastSongIdentity,
    lastImageKey
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasValidClientId() {
  return /^\d{17,22}$/.test(CLIENT_ID);
}

function cleanSpaces(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function lower(text) {
  return cleanSpaces(text).toLowerCase();
}

function limitText(text, maxLength = 128) {
  const value = cleanSpaces(text);
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return number;
}

function safeInteger(value, fallback = 0) {
  return Math.floor(safeNumber(value, fallback));
}

function hashString(text) {
  const value = String(text || APP_NAME);
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function shuffleArray(items, seed = "") {
  const next = [...items];
  let state = hashString(`${seed}|${Date.now()}|${Math.random()}`);

  for (let index = next.length - 1; index > 0; index -= 1) {
    state = Math.imul(state ^ (state >>> 15), 2246822507) >>> 0;
    state = Math.imul(state ^ (state >>> 13), 3266489909) >>> 0;

    const swapIndex = state % (index + 1);
    const temp = next[index];
    next[index] = next[swapIndex];
    next[swapIndex] = temp;
  }

  return next;
}

function normalizeMode(value, fallback) {
  return String(value || fallback || "")
    .trim()
    .replace(/[\s_-]+/g, "")
    .toLowerCase();
}

function normalizeArtMode(value) {
  const mode = normalizeMode(value, "randomPixel");

  if (["album", "albumcover", "cover"].includes(mode)) return "albumCover";
  if (["logo", "default", "localitfy", "localitfylogo"].includes(mode)) return "logo";
  if (["none", "noimage", "textonly"].includes(mode)) return "none";

  return "randomPixel";
}

function normalizeStyle(value) {
  const style = normalizeMode(value, "cute");

  if (style === "cute") return "cute";
  if (style === "detailed") return "detailed";
  if (style === "minimal") return "minimal";
  if (style === "meme" || style === "mememode") return "meme";

  return "clean";
}

function normalizeCleanup(value) {
  const mode = normalizeMode(value, "heavy");

  if (mode === "off" || mode === "none") return "off";
  if (mode === "light") return "light";

  return "heavy";
}

function normalizeSecondLine(value) {
  const mode = normalizeMode(value, "artist");

  if (mode === "album") return "album";
  if (mode === "timeleft" || mode === "time") return "timeLeft";
  if (mode === "playcount" || mode === "plays") return "playCount";
  if (mode === "app" || mode === "appname" || mode === "localitfy") return "appName";

  return "artist";
}

function cleanupTitle(rawTitle, cleanupMode = "heavy") {
  let text = String(rawTitle || "local song");

  if (cleanupMode === "off") {
    return lower(text) || "local song";
  }

  if (cleanupMode === "light") {
    text = text
      .normalize("NFKC")
      .replace(/\.[a-z0-9]{2,5}$/i, " ")
      .replace(/[_]+/g, " ");

    return lower(text) || "local song";
  }

  text = text
    .normalize("NFKC")
    .replace(/\.[a-z0-9]{2,5}$/i, " ")
    .replace(/[_]+/g, " ")
    .replace(/[–—]+/g, " ")
    .replace(/\((\d+)\)/gi, " ")
    .replace(/\[(\d+)\]/gi, " ")
    .replace(/\bfeat\.?\b/gi, " ")
    .replace(/\bfeaturing\b/gi, " ")
    .replace(/\bft\.?\b/gi, " ")
    .replace(/\bslowed\s*(?:and|&)?\s*reverb\b/gi, " ")
    .replace(/\bslowedandreverb\b/gi, " ")
    .replace(/\bslowedreverb\b/gi, " ")
    .replace(/\bultra\b/gi, " ")
    .replace(/\bslowed\b/gi, " ")
    .replace(/\breverb\b/gi, " ")
    .replace(/\bsped\s*up\b/gi, " ")
    .replace(/\bbass\s*boosted\b/gi, " ")
    .replace(/\bextended\b/gi, " ")
    .replace(/\bofficial\b/gi, " ")
    .replace(/\baudio\b/gi, " ")
    .replace(/\bvideo\b/gi, " ")
    .replace(/\blyrics?\b/gi, " ")
    .replace(/\bvisualizer\b/gi, " ")
    .replace(/\bremaster(?:ed)?\b/gi, " ");

  return lower(text) || "local song";
}

function cleanAssetKey(value) {
  let key = cleanSpaces(value);

  if (!key) return "";

  key = key
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    .replace(/\.(png|jpg|jpeg|webp|gif)$/i, "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "")
    .trim();

  return ASSET_ALIASES[key] || key;
}

function rebuildDynamicAssetDeck(seed = "", avoidKey = "") {
  const avoid = cleanAssetKey(avoidKey);
  let pool = SAFE_ART_ASSETS.filter((key) => key && key !== avoid);

  if (!pool.length) {
    pool = SAFE_ART_ASSETS.filter(Boolean);
  }

  dynamicAssetDeck = shuffleArray(pool, `${seed}|deck-${dynamicDiscordAssetSession}`);

  if (dynamicAssetDeck.length > 1 && dynamicAssetDeck[0] === avoid) {
    dynamicAssetDeck.push(dynamicAssetDeck.shift());
  }
}

function pickNextUniqueDiscordAsset(seed = "", avoidKey = "") {
  if (!SAFE_ART_ASSETS.length) return DEFAULT_LOGO_ASSET;

  const avoid = cleanAssetKey(avoidKey);

  if (dynamicUsedAssets.size >= SAFE_ART_ASSETS.length) {
    dynamicUsedAssets = new Set();

    if (avoid) {
      dynamicUsedAssets.add(avoid);
    }

    rebuildDynamicAssetDeck(`${seed}|loop-reset`, avoid);
  }

  let attempts = 0;

  while (attempts < SAFE_ART_ASSETS.length + 3) {
    attempts += 1;

    if (!dynamicAssetDeck.length) {
      rebuildDynamicAssetDeck(`${seed}|rebuild-${attempts}`, avoid);
    }

    const picked = cleanAssetKey(dynamicAssetDeck.shift());

    if (!picked) continue;
    if (picked === avoid && SAFE_ART_ASSETS.length > 1) continue;
    if (dynamicUsedAssets.has(picked) && dynamicUsedAssets.size < SAFE_ART_ASSETS.length) continue;

    dynamicUsedAssets.add(picked);
    return picked;
  }

  const fallbackPool = SAFE_ART_ASSETS.filter((key) => key !== avoid && !dynamicUsedAssets.has(key));
  const fallback = fallbackPool[0] || SAFE_ART_ASSETS.find((key) => key !== avoid) || SAFE_ART_ASSETS[0];

  if (fallback) {
    dynamicUsedAssets.add(fallback);
  }

  return fallback || DEFAULT_LOGO_ASSET;
}

function pickSafeFallback(seed = "", avoidKey = "") {
  return pickNextUniqueDiscordAsset(seed, avoidKey || lastImageKey);
}

function getSongIdentity(payload) {
  return cleanSpaces(
    payload?.songId ||
      payload?.id ||
      `${payload?.title || ""}|${payload?.artist || ""}|${payload?.album || ""}|${payload?.duration || ""}`
  );
}

function getDuration(payload) {
  const duration = safeInteger(payload?.duration, 0);
  return duration > 0 ? duration : 0;
}

function getCurrentTime(payload) {
  const currentTime = safeInteger(payload?.currentTime, 0);
  return currentTime > 0 ? currentTime : 0;
}

function getSelectionSignature(payload = {}) {
  return cleanSpaces(
    payload?.discordSelectionNonce ||
      payload?.selectionNonce ||
      payload?.clickNonce ||
      payload?.playNonce ||
      payload?.startedAt ||
      payload?.selectedAt ||
      `${getSongIdentity(payload)}|${payload?.isPlaying === true ? "playing" : "paused"}|${getCurrentTime(payload) <= 2 ? "fresh" : "same"}`
  );
}

function shouldRollNewDiscordAsset(payload = {}) {
  const now = Date.now();
  const songIdentity = getSongIdentity(payload);
  const currentTime = getCurrentTime(payload);
  const isPlaying = payload?.isPlaying === true;
  const selectionSignature = getSelectionSignature(payload);

  const songChanged = songIdentity && songIdentity !== dynamicDiscordAssetSongIdentity;

  const selectionChanged =
    selectionSignature &&
    selectionSignature !== lastSelectionSignature &&
    songIdentity &&
    songIdentity !== lastPayloadSongIdentity;

  const clickedBackToSong =
    songIdentity &&
    lastPayloadSongIdentity &&
    songIdentity !== lastPayloadSongIdentity;

  const playbackRestarted =
    songIdentity &&
    songIdentity === dynamicDiscordAssetSongIdentity &&
    currentTime <= 2 &&
    lastPayloadCurrentTime > 5;

  const resumedFresh =
    songIdentity &&
    songIdentity === dynamicDiscordAssetSongIdentity &&
    isPlaying &&
    !lastPayloadIsPlaying &&
    currentTime <= 2 &&
    now - lastDynamicAssetChangeAt > 1800;

  const manuallyForced =
    payload?.discordForceNewAsset === true ||
    payload?.discordForceRefresh === true ||
    payload?.newDiscordAsset === true;

  return (
    !dynamicDiscordAssetKey ||
    songChanged ||
    selectionChanged ||
    clickedBackToSong ||
    playbackRestarted ||
    resumedFresh ||
    manuallyForced
  );
}

function getFreshDiscordAsset(payload = {}) {
  const songIdentity = getSongIdentity(payload) || APP_NAME;
  const selectionSignature = getSelectionSignature(payload);

  if (shouldRollNewDiscordAsset(payload)) {
    dynamicDiscordAssetSession += 1;

    const picked = pickNextUniqueDiscordAsset(
      `${songIdentity}|fresh-click-${dynamicDiscordAssetSession}`,
      dynamicDiscordAssetKey || lastImageKey
    );

    dynamicDiscordAssetKey = picked;
    dynamicDiscordAssetSongIdentity = songIdentity;
    lastDynamicAssetChangeAt = Date.now();

    console.log("[localitfy rpc] fresh Discord art selected", {
      song: payload.title || songIdentity,
      image: picked,
      session: dynamicDiscordAssetSession,
      used: `${dynamicUsedAssets.size}/${SAFE_ART_ASSETS.length}`
    });
  }

  lastSelectionSignature = selectionSignature;
  lastPayloadSongIdentity = songIdentity;
  lastPayloadCurrentTime = getCurrentTime(payload);
  lastPayloadIsPlaying = payload?.isPlaying === true;

  return dynamicDiscordAssetKey || pickNextUniqueDiscordAsset(songIdentity, lastImageKey);
}

function resetDynamicDiscordAssetCache() {
  dynamicDiscordAssetKey = "";
  dynamicDiscordAssetSongIdentity = "";
  dynamicDiscordAssetSession = 0;
  dynamicAssetDeck = [];
  dynamicUsedAssets = new Set();
  lastPayloadSongIdentity = "";
  lastPayloadCurrentTime = 0;
  lastPayloadIsPlaying = false;
  lastDynamicAssetChangeAt = 0;
  lastSelectionSignature = "";
}

function resolveDiscordAssetKey(value, seed = "") {
  const key = cleanAssetKey(value);

  if (!key) return "";
  if (key === DEFAULT_LOGO_ASSET) return DEFAULT_LOGO_ASSET;
  if (SAFE_ART_ASSETS.includes(key)) return key;

  const fallback = pickNextUniqueDiscordAsset(seed, lastImageKey);

  console.log("[localitfy rpc] unknown Discord asset key, using random safe fallback", {
    requested: key,
    fallback
  });

  return fallback;
}

function pickFirstPayloadAsset(payload = {}) {
  const possibleValues = [
    payload.discordAssetKey,
    payload.discordAltAssetKey,
    payload.albumAssetKey,
    payload.pixelAssetKey,
    payload.pixelArtAssetKey,
    payload.pixelCoverKey,
    payload.discordCoverKey,
    payload.coverAssetKey,
    payload.coverKey,
    payload.pixelArt,
    payload.pixelCover,
    payload.coverPath,
    payload.cover,
    payload.artwork,
    payload.image
  ];

  const seed = getSongIdentity(payload);

  for (const value of possibleValues) {
    const resolved = resolveDiscordAssetKey(value, seed);
    if (resolved) return resolved;
  }

  return "";
}

function getArtist(payload) {
  const artist = lower(payload?.artist);

  if (!artist || artist === "unknown" || artist === "unknown artist") {
    return "coderpixel :p";
  }

  return artist;
}

function getAlbum(payload) {
  return lower(payload?.album) || "local files";
}

function formatTime(seconds) {
  const safe = Math.max(0, safeInteger(seconds, 0));
  const mins = Math.floor(safe / 60);
  const secs = String(safe % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function getRoundedTimeLeft(payload) {
  const duration = getDuration(payload);
  const currentTime = getCurrentTime(payload);

  if (!duration || currentTime >= duration) {
    return "0:00 left";
  }

  const left = duration - currentTime;
  const rounded = Math.max(0, Math.round(left / 15) * 15);

  return `${formatTime(rounded)} left`;
}

function buildSecondLine(payload, artist) {
  const mode = normalizeSecondLine(payload?.discordSecondLine);
  const cleanArtist = cleanSpaces(artist) || "unknown artist";

  if (payload?.discordPrivacyMode) return "from your library";
  if (mode === "album") return getAlbum(payload);
  if (mode === "timeLeft") return getRoundedTimeLeft(payload);
  if (mode === "playCount") return `played ${Math.max(0, safeInteger(payload?.playCount, 0))} times`;
  if (mode === "appName") return APP_NAME;

  return cleanArtist;
}

function buildActivityText(payload) {
  const style = normalizeStyle(payload?.discordActivityStyle);
  const cleanupMode = normalizeCleanup(payload?.discordTitleCleanup);

  const title = cleanupTitle(payload?.title, cleanupMode);
  const artist = getArtist(payload);
  const album = getAlbum(payload);
  const timeLeft = getRoundedTimeLeft(payload);
  const secondLine = buildSecondLine(payload, artist);
  const importedCount = Math.max(0, safeInteger(payload?.songCount, 0));
  const isPlaying = payload?.isPlaying === true;

  if (payload?.discordPrivacyMode) {
    return {
      details: "Listening to local music",
      state: "from your library"
    };
  }

  if (!payload?.title && !isPlaying) {
    return {
      details: "browsing library",
      state: `${importedCount} song${importedCount === 1 ? "" : "s"} imported`
    };
  }

  const cleanTitle = title || "local song";

  if (!isPlaying && payload?.discordShowPausedIdle !== false) {
    return {
      details: cleanTitle,
      state: `paused • ${timeLeft}`
    };
  }

  if (style === "detailed") {
    return {
      details: cleanTitle,
      state: `${buildSecondLine({ ...payload, discordSecondLine: "artist" }, artist)} • album: ${album}`
    };
  }

  if (style === "minimal") {
    return {
      details: cleanTitle,
      state: artist || "from your library"
    };
  }

  if (style === "meme") {
    return {
      details: cleanTitle,
      state: secondLine
    };
  }

  if (style === "cute") {
    return {
      details: payload?.liked ? `♡ ${cleanTitle}` : cleanTitle,
      state: secondLine
    };
  }

  return {
    details: cleanTitle,
    state: secondLine
  };
}

function pickLargeImageKey(payload) {
  const artMode = normalizeArtMode(payload?.discordArtMode);

  if (artMode === "none") return "";
  if (artMode === "logo") return DEFAULT_LOGO_ASSET;

  /*
    Main behavior:
    randomPixel = every song click / selection gets a new unique Discord art.
    No repeating until the list is finished.
  */
  if (artMode === "randomPixel") {
    return getFreshDiscordAsset(payload);
  }

  /*
    If albumCover mode is selected, still protect it:
    if the chosen key is invalid, it picks a random safe Discord asset.
  */
  if (artMode === "albumCover") {
    const payloadAsset = pickFirstPayloadAsset(payload);
    return payloadAsset || getFreshDiscordAsset(payload);
  }

  return getFreshDiscordAsset(payload);
}

function isSafeHttpUrl(url) {
  const value = cleanSpaces(url);

  if (!value) return false;

  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function safeButton(label, url) {
  const safeLabel = limitText(label, 32);
  const safeUrl = cleanSpaces(url);

  if (!safeLabel || !isSafeHttpUrl(safeUrl)) return null;

  return {
    label: safeLabel,
    url: safeUrl
  };
}

function buildYoutubeSearchUrl(payload) {
  const title = cleanupTitle(payload?.title, normalizeCleanup(payload?.discordTitleCleanup));
  const artist = getArtist(payload);
  const query = [artist, title].map((part) => cleanSpaces(part)).filter(Boolean).join(" ");

  if (!query) return DEFAULT_DOWNLOAD_URL;

  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function buildButtonSets(payload) {
  if (payload?.discordButtons === false) return [[]];

  const songSearchUrl = isSafeHttpUrl(payload?.discordOpenUrl)
    ? cleanSpaces(payload?.discordOpenUrl)
    : buildYoutubeSearchUrl(payload);

  const secondUrl =
    cleanSpaces(payload?.discordGithubUrl) ||
    cleanSpaces(payload?.discordDownloadUrl) ||
    DEFAULT_DOWNLOAD_URL;

  const primaryLabel = cleanSpaces(payload?.discordOpenLabel) || "Search this song on YouTube";
  const secondaryLabel = cleanSpaces(payload?.discordGithubLabel) || "Get localtify";

  const search = safeButton(primaryLabel, songSearchUrl);
  const secondary = safeButton(secondaryLabel, secondUrl);
  const download = safeButton("Download localtify", DEFAULT_DOWNLOAD_URL);
  const source = safeButton("View GitHub", DEFAULT_SOURCE_URL);

  const sets = [];

  if (search && secondary) sets.push([search, secondary]);
  if (search && download) sets.push([search, download]);
  if (search) sets.push([search]);
  if (download && source) sets.push([download, source]);
  if (download) sets.push([download]);

  sets.push([]);

  const seen = new Set();

  return sets.filter((set) => {
    const deduped = [];
    const local = new Set();

    for (const button of set) {
      const key = `${button.label}|${button.url}`;
      if (!local.has(key)) {
        local.add(key);
        deduped.push(button);
      }
    }

    set.splice(0, set.length, ...deduped.slice(0, 2));

    const signature = JSON.stringify(set);
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function attachButtons(activity, buttons) {
  const next = { ...activity };

  if (Array.isArray(buttons) && buttons.length > 0) {
    next.buttons = buttons.slice(0, 2);
  } else {
    delete next.buttons;
  }

  return next;
}

function buildBaseActivity(payload = {}) {
  const text = buildActivityText(payload);
  const largeImageKey = pickLargeImageKey(payload);

  const isPlaying = payload?.isPlaying === true;
  const duration = getDuration(payload);
  const currentTime = getCurrentTime(payload);
  const now = Date.now();

  const activity = {
    name: DISCORD_ACTIVITY_NAME,
    details: limitText(text.details || "Listening to local music", 128),
    instance: false,
    type: DISCORD_ACTIVITY_TYPE_LISTENING,
    activityType: DISCORD_ACTIVITY_TYPE_LISTENING
  };

  const stateText = limitText(text.state || "", 128);
  if (stateText) {
    activity.state = stateText;
  }

  if (largeImageKey) {
    activity.largeImageKey = largeImageKey;
    activity.largeImageText = limitText(payload?.discordAssetLabel || "localtify artwork", 128);
  }

  const smallImageMode = cleanSpaces(payload?.discordSmallImageMode || "player");
  if (smallImageMode !== "none" && DEFAULT_LOGO_ASSET && largeImageKey && largeImageKey !== DEFAULT_LOGO_ASSET) {
    activity.smallImageKey = DEFAULT_LOGO_ASSET;
    activity.smallImageText = isPlaying ? "listening in localtify" : "paused in localtify";
  }

  if (duration > 0 && duration > currentTime) {
    const startTime = now - currentTime * 1000;
    activity.startTimestamp = startTime;
    if (isPlaying) {
      activity.endTimestamp = startTime + duration * 1000;
    }
  }

  return activity;
}

function buildActivityAttempts(payload = {}) {
  const baseActivity = buildBaseActivity(payload);
  const buttonSets = buildButtonSets(payload);

  return buttonSets.map((buttons, index) => ({
    name:
      buttons.length === 2
        ? `two-buttons-${index + 1}`
        : buttons.length === 1
          ? `one-button-${index + 1}`
          : "no-buttons-fallback",
    hasButtons: buttons.length > 0,
    activity: attachButtons(baseActivity, buttons)
  }));
}

function normalizeRpcTimestamp(value) {
  if (value instanceof Date) return Math.round(value.getTime());

  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return undefined;

  return Math.round(number);
}

function buildListeningProtocolActivity(activity = {}) {
  const protocolActivity = {
    name: DISCORD_ACTIVITY_NAME,
    type: DISCORD_ACTIVITY_TYPE_LISTENING,
    details: limitText(activity.details || "Listening to local music", 128),
    instance: activity.instance === true
  };

  const state = limitText(activity.state || "", 128);
  if (state) protocolActivity.state = state;

  const start = normalizeRpcTimestamp(activity.startTimestamp);
  const end = normalizeRpcTimestamp(activity.endTimestamp);
  if (start || end) {
    protocolActivity.timestamps = {};
    if (start) protocolActivity.timestamps.start = start;
    if (end) protocolActivity.timestamps.end = end;
  }

  if (activity.largeImageKey || activity.largeImageText || activity.smallImageKey || activity.smallImageText) {
    protocolActivity.assets = {};
    if (activity.largeImageKey) protocolActivity.assets.large_image = activity.largeImageKey;
    if (activity.largeImageText) protocolActivity.assets.large_text = limitText(activity.largeImageText, 128);
    if (activity.smallImageKey) protocolActivity.assets.small_image = activity.smallImageKey;
    if (activity.smallImageText) protocolActivity.assets.small_text = limitText(activity.smallImageText, 128);
  }

  if (Array.isArray(activity.buttons) && activity.buttons.length > 0) {
    protocolActivity.buttons = activity.buttons
      .slice(0, 2)
      .map((button) => ({
        label: limitText(button?.label || "Open", 32),
        url: cleanSpaces(button?.url || "")
      }))
      .filter((button) => button.label && isSafeHttpUrl(button.url));

    if (protocolActivity.buttons.length === 0) {
      delete protocolActivity.buttons;
    }
  }

  return protocolActivity;
}

async function setListeningActivity(rpcClient, activity) {
  const protocolActivity = buildListeningProtocolActivity(activity);

  if (rpcClient && typeof rpcClient.request === "function") {
    return rpcClient.request("SET_ACTIVITY", {
      pid: process.pid,
      activity: protocolActivity
    });
  }

  if (rpcClient && typeof rpcClient.setActivity === "function") {
    return rpcClient.setActivity({
      ...activity,
      name: DISCORD_ACTIVITY_NAME,
      type: DISCORD_ACTIVITY_TYPE_LISTENING,
      activityType: DISCORD_ACTIVITY_TYPE_LISTENING
    });
  }

  throw new Error("Discord RPC client is not ready");
}

function buildImportantSignature(activity, payload) {
  return JSON.stringify({
    song: getSongIdentity(payload),
    playing: payload?.isPlaying === true,
    activityName: activity.name || DISCORD_ACTIVITY_NAME,
    activityType: DISCORD_ACTIVITY_TYPE_LISTENING,
    details: activity.details,
    state: activity.state,
    largeImageKey: activity.largeImageKey || "",
    smallImageKey: activity.smallImageKey || "",
    buttons: activity.buttons || [],
    artMode: payload?.discordArtMode || "randomPixel",
    privacy: payload?.discordPrivacyMode === true
  });
}

function resetLocalCache() {
  lastActivitySignature = "";
  lastImportantSignature = "";
  lastSongIdentity = "";
  lastImageKey = "";
  lastButtonSignature = "";
  lastSetAt = 0;
  lastButtonRefreshAt = 0;
  lastLoggedSignature = "";
}

function resetClient() {
  client = null;
  connectingPromise = null;
  setStatus({ connected: false, connecting: false, lastAction: "client-reset" });
  resetLocalCache();
}

async function hardClearActivity(targetClient = client, reason = "clear") {
  resetLocalCache();

  if (!targetClient) return true;

  try {
    await targetClient.clearActivity();
    setStatus({ lastAction: `cleared:${reason}`, lastClearedAt: Date.now(), asset: "", song: "", buttons: false });
    console.log(`[localitfy rpc] activity cache cleared (${reason})`);
    return true;
  } catch (error) {
    setStatus({ lastAction: `clear-failed:${reason}`, lastError: error?.message || String(error) });
    console.log(`[localitfy rpc] clear failed (${reason})`, error?.message || error);
    return false;
  }
}

async function destroyClient(reason = "destroy") {
  const oldClient = client;

  resetClient();

  if (!oldClient) return true;

  try {
    await oldClient.clearActivity().catch(() => undefined);
    await sleep(120);

    if (typeof oldClient.destroy === "function") {
      oldClient.destroy();
    } else if (oldClient.transport && typeof oldClient.transport.close === "function") {
      oldClient.transport.close();
    }

    console.log(`[localitfy rpc] client destroyed (${reason})`);
    return true;
  } catch (error) {
    console.log(`[localitfy rpc] destroy failed (${reason})`, error?.message || error);
    return false;
  }
}

async function ensureClient() {
  if (shuttingDown) return null;

  if (!hasValidClientId()) {
    setStatus({ enabled: false, lastAction: "invalid-client-id", lastError: "invalid Discord client id" });
    console.log("[localitfy rpc] invalid Discord client id");
    return null;
  }

  if (client) return client;
  if (connectingPromise) return connectingPromise;

  const now = Date.now();
  if (now < nextReconnectAt) return null;

  connectingPromise = (async () => {
    setStatus({ connecting: true, lastAction: "connecting", lastError: "" });
    try {
      if (!registered) {
        RPC.register(CLIENT_ID);
        registered = true;
      }

      const nextClient = new RPC.Client({ transport: "ipc" });

      nextClient.on("ready", () => {
        setStatus({ connected: true, connecting: false, lastAction: "connected", lastError: "" });
        console.log("[localitfy rpc] connected");
      });

      nextClient.on("disconnected", () => {
        console.log("[localitfy rpc] disconnected");
        nextReconnectAt = Date.now() + RECONNECT_DELAY_MS;
        setStatus({ connected: false, connecting: false, lastAction: "disconnected", reconnectAt: nextReconnectAt });
        resetClient();
      });

      nextClient.on("error", (error) => {
        setStatus({ lastAction: "client-error", lastError: error?.message || String(error) });
        console.log("[localitfy rpc] client error", error?.message || error);
      });

      await nextClient.login({ clientId: CLIENT_ID });

      client = nextClient;
      setStatus({ connected: true, connecting: false, lastAction: "login-ok", lastError: "" });

      if (!didStartupClear) {
        didStartupClear = true;
        await hardClearActivity(nextClient, "startup");
        await sleep(STARTUP_CLEAR_DELAY_MS);
      }

      return nextClient;
    } catch (error) {
      console.log("[localitfy rpc] login failed", error?.message || error);
      nextReconnectAt = Date.now() + RECONNECT_DELAY_MS;
      setStatus({ connected: false, connecting: false, lastAction: "login-failed", lastError: error?.message || String(error), reconnectAt: nextReconnectAt });
      resetClient();
      return null;
    } finally {
      connectingPromise = null;
    }
  })();

  return connectingPromise;
}

async function applyActivityWithRetries(rpcClient, attempts, options = {}) {
  let lastError = null;

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];
    const shouldClear = options.forceClear || index > 0;

    try {
      if (shouldClear) {
        await hardClearActivity(rpcClient, `before-set-${attempt.name}`);
        await sleep(CLEAR_BEFORE_SET_DELAY_MS);
      }

      await setListeningActivity(rpcClient, attempt.activity);

      if (attempt.hasButtons && options.doublePush) {
        await sleep(BUTTON_DOUBLE_PUSH_DELAY_MS);
        await setListeningActivity(rpcClient, attempt.activity);
      }

      return attempt;
    } catch (error) {
      lastError = error;
      console.log(`[localitfy rpc] set failed using ${attempt.name}`, error?.message || error);
      await sleep(240);
    }
  }

  throw lastError || new Error("Discord RPC setActivity failed");
}

async function setDiscordActivity(payload = {}) {
  if (payload?.discordEnabled === false) {
    setStatus({ enabled: false, lastAction: "disabled" });
    await clearDiscordActivity();
    return true;
  }

  setStatus({ enabled: true });

  const rpcClient = await ensureClient();
  if (!rpcClient) {
    setStatus({ lastAction: "waiting-for-discord", connected: false });
    return false;
  }

  const attempts = buildActivityAttempts(payload);
  const primaryActivity = attempts[0]?.activity || buildBaseActivity(payload);

  const activitySignature = JSON.stringify(primaryActivity);
  const importantSignature = buildImportantSignature(primaryActivity, payload);

  const now = Date.now();
  const songIdentity = getSongIdentity(payload);
  const imageKey = primaryActivity.largeImageKey || "";
  const buttonSignature = JSON.stringify(primaryActivity.buttons || []);

  const songChanged = lastSongIdentity !== songIdentity;
  const imageChanged = lastImageKey !== imageKey;
  const buttonsChanged = lastButtonSignature !== buttonSignature;
  const importantChanged = lastImportantSignature !== importantSignature;

  const throttlePassed = now - lastSetAt >= ACTIVITY_THROTTLE_MS;
  const refreshPassed = now - lastSetAt >= SAME_SONG_REFRESH_MS;
  const buttonRefreshPassed = now - lastButtonRefreshAt >= BUTTON_FORCE_REFRESH_MS;

  const hasButtons = Array.isArray(primaryActivity.buttons) && primaryActivity.buttons.length > 0;

  if (
    !songChanged &&
    !imageChanged &&
    !buttonsChanged &&
    !importantChanged &&
    !refreshPassed &&
    !(hasButtons && buttonRefreshPassed)
  ) {
    return true;
  }

  if (
    activitySignature === lastActivitySignature &&
    !refreshPassed &&
    !(hasButtons && buttonRefreshPassed)
  ) {
    return true;
  }

  if (!throttlePassed && !songChanged && !imageChanged && !buttonsChanged && !importantChanged) {
    return true;
  }

  try {
    const needsHardClear =
      songChanged ||
      imageChanged ||
      buttonsChanged ||
      importantChanged ||
      hasButtons ||
      payload?.discordForceRefresh === true;

    const chosenAttempt = await applyActivityWithRetries(rpcClient, attempts, {
      forceClear: needsHardClear,
      doublePush: hasButtons && (buttonsChanged || buttonRefreshPassed || payload?.discordForceRefresh === true)
    });

    const finalActivity = chosenAttempt.activity;

    lastActivitySignature = JSON.stringify(finalActivity);
    lastImportantSignature = buildImportantSignature(finalActivity, payload);
    lastSongIdentity = songIdentity;
    lastImageKey = finalActivity.largeImageKey || "";
    lastButtonSignature = JSON.stringify(finalActivity.buttons || []);
    lastSetAt = now;

    dynamicDiscordAssetKey = lastImageKey || dynamicDiscordAssetKey;
    dynamicDiscordAssetSongIdentity = songIdentity || dynamicDiscordAssetSongIdentity;
    lastPayloadSongIdentity = songIdentity;
    lastPayloadCurrentTime = getCurrentTime(payload);
    lastPayloadIsPlaying = payload?.isPlaying === true;

    if (Array.isArray(finalActivity.buttons) && finalActivity.buttons.length > 0) {
      lastButtonRefreshAt = now;
    }

    const logSignature = [
      songIdentity,
      lastImageKey || "none",
      payload.discordArtMode || "randomPixel",
      chosenAttempt.name,
      lastButtonSignature || "no-buttons"
    ].join("|");

    if (logSignature !== lastLoggedSignature) {
      lastLoggedSignature = logSignature;
      console.log("[localitfy rpc] activity updated", {
        song: payload.title || payload.songId || "unknown",
        mode: payload.discordArtMode || "randomPixel",
        image: lastImageKey || "none",
        strategy: chosenAttempt.name,
        buttons: finalActivity.buttons || [],
        usedArt: `${dynamicUsedAssets.size}/${SAFE_ART_ASSETS.length}`
      });
    }

    return true;
  } catch (error) {
    console.log("[localitfy rpc] set activity failed", error?.message || error);
    nextReconnectAt = Date.now() + RECONNECT_DELAY_MS;
    setStatus({ lastAction: "set-failed", lastError: error?.message || String(error), reconnectAt: nextReconnectAt });
    resetClient();
    return false;
  }
}

async function clearDiscordActivity() {
  await hardClearActivity(client, "manual");
  resetDynamicDiscordAssetCache();
  return true;
}

async function shutdownDiscordActivity(reason = "shutdown") {
  if (shuttingDown) return true;

  shuttingDown = true;

  try {
    await hardClearActivity(client, reason);
    await sleep(160);
    await destroyClient(reason);
    return true;
  } catch (error) {
    console.log("[localitfy rpc] shutdown failed", error?.message || error);
    resetClient();
    return false;
  } finally {
    shuttingDown = false;
  }
}

async function resetDiscordActivityCache() {
  didStartupClear = false;
  await hardClearActivity(client, "cache-reset");
  resetDynamicDiscordAssetCache();
  await sleep(STARTUP_CLEAR_DELAY_MS);
  return true;
}

if (typeof process !== "undefined" && process.once) {
  process.once("beforeExit", () => {
    shutdownDiscordActivity("before-exit").catch(() => undefined);
  });

  process.once("SIGINT", () => {
    shutdownDiscordActivity("sigint").finally(() => process.exit(0));
  });

  process.once("SIGTERM", () => {
    shutdownDiscordActivity("sigterm").finally(() => process.exit(0));
  });
}

module.exports = {
  setDiscordActivity,
  clearDiscordActivity,
  shutdownDiscordActivity,
  resetDiscordActivityCache,
  getDiscordStatus
};