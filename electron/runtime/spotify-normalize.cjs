function safeImageExtensionFromUrlOrType(rawUrl = "", contentType = "") {
  const cleanType = String(contentType || "").toLowerCase();
  const cleanUrl = String(rawUrl || "").toLowerCase();
  if (cleanType.includes("png") || cleanUrl.includes(".png")) return ".png";
  if (cleanType.includes("webp") || cleanUrl.includes(".webp")) return ".webp";
  if (cleanType.includes("gif") || cleanUrl.includes(".gif")) return ".gif";
  return ".jpg";
}

function bestSpotifyImage(images = []) {
  if (!Array.isArray(images) || !images.length) return "";
  const sorted = images.filter((image) => image?.url).slice().sort((a, b) => Number(b?.width || 0) - Number(a?.width || 0));
  return String(sorted[0]?.url || "");
}

function parseSpotifyUrl(rawUrl) {
  const raw = String(rawUrl || "").trim();
  if (!raw) return null;
  const uriMatch = raw.match(/^spotify:(playlist|album|track):([A-Za-z0-9]+)$/i);
  if (uriMatch) return { type: uriMatch[1].toLowerCase(), id: uriMatch[2] };
  const urlMatch = raw.match(/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(?:embed\/)?(playlist|album|track)\/([A-Za-z0-9]+)/i);
  if (urlMatch) return { type: urlMatch[1].toLowerCase(), id: urlMatch[2] };
  return null;
}

function shapeSpotifyTrack(track, fallbackAlbumName = "", fallbackCoverUrl = "") {
  if (!track?.name) return null;
  const artists = Array.isArray(track.artists) ? track.artists.map((artist) => artist?.name).filter(Boolean).join(", ") : "";
  const coverUrl = bestSpotifyImage(track.album?.images) || bestSpotifyImage(track.images) || String(track.coverUrl || track.spotifyCoverUrl || track.albumCoverUrl || fallbackCoverUrl || "");
  return {
    id: String(track.id || `${track.name}-${artists}-${track.duration_ms || 0}`),
    title: String(track.name || "unknown track"),
    name: String(track.name || "unknown track"),
    artist: artists,
    artists,
    albumName: String(track.album?.name || fallbackAlbumName || ""),
    coverUrl,
    albumCoverUrl: coverUrl,
    spotifyCoverUrl: coverUrl,
    duration: Math.round(Number(track.duration_ms || 0) / 1000),
    durationMs: Number(track.duration_ms || 0),
    spotifyUrl: track.external_urls?.spotify || (track.id ? `https://open.spotify.com/track/${track.id}` : ""),
    isrc: String(track.external_ids?.isrc || track.isrc || "")
  };
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function uniqSpotifyIds(ids = []) {
  const seen = new Set();
  const out = [];
  for (const rawId of ids) {
    const id = String(rawId || "").trim();
    if (!/^[A-Za-z0-9]{18,24}$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}


module.exports = {
  safeImageExtensionFromUrlOrType,
  bestSpotifyImage,
  parseSpotifyUrl,
  shapeSpotifyTrack,
  decodeHtmlEntities,
  uniqSpotifyIds
};
