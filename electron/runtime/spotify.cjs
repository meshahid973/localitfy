const http = require("node:http");
const https = require("node:https");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");

function createSpotifyRuntime({ app, BrowserWindow, getMainWindow, fileExists }) {
  if (!app || !BrowserWindow || typeof getMainWindow !== "function" || typeof fileExists !== "function") {
    throw new TypeError("Spotify runtime requires app, BrowserWindow, getMainWindow, and fileExists");
  }

  const browserUserAgent = process.platform === "win32"
    ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    : "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
  const redirectPort = Number(process.env.SPOTIFY_REDIRECT_PORT || 43877);
  const redirectUri = String(process.env.SPOTIFY_REDIRECT_URI || `http://127.0.0.1:${redirectPort}/spotify/callback`);
  const clientId = String(
    process.env.SPOTIFY_CLIENT_ID ||
    process.env.VITE_SPOTIFY_CLIENT_ID ||
    process.env.VITE_PUBLIC_SPOTIFY_CLIENT_ID ||
    "586c22791eb74d73b1c83db88f1d4c52"
  ).trim();

  let token = null;
  let tokenExpiry = 0;

  function oauthFile() {
    return path.join(app.getPath("userData"), "spotify-oauth.json");
  }

  function base64UrlEncode(value) {
    return Buffer.from(value).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function makeCodeVerifier() {
    return base64UrlEncode(crypto.randomBytes(48));
  }

  function makeCodeChallenge(verifier) {
    return base64UrlEncode(crypto.createHash("sha256").update(verifier).digest());
  }

  function readOAuthToken() {
    try {
      const filePath = oauthFile();
      if (!fs.existsSync(filePath)) return null;
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (!parsed || typeof parsed !== "object") return null;
      return {
        accessToken: typeof parsed.accessToken === "string" ? parsed.accessToken : "",
        refreshToken: typeof parsed.refreshToken === "string" ? parsed.refreshToken : "",
        expiresAt: Number(parsed.expiresAt || 0)
      };
    } catch {
      return null;
    }
  }

  function writeOAuthToken(nextToken) {
    try {
      const filePath = oauthFile();
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(nextToken, null, 2), "utf-8");
    } catch (error) {
      console.log("[localitfy spotify token save error]", error?.message || error);
    }
  }

  function clearOAuthToken() {
    token = null;
    tokenExpiry = 0;
    try { fs.unlinkSync(oauthFile()); } catch {}
  }

  function saveOAuthResponse(data = {}, previous = {}) {
    const expiresIn = Number(data.expires_in || 3600);
    const next = {
      accessToken: String(data.access_token || previous.accessToken || ""),
      refreshToken: String(data.refresh_token || previous.refreshToken || ""),
      expiresAt: Date.now() + Math.max(60, expiresIn - 90) * 1000
    };
    if (!next.accessToken) throw new Error("Spotify did not return an access token.");
    writeOAuthToken(next);
    token = next.accessToken;
    tokenExpiry = next.expiresAt;
    return next;
  }

  function httpGet(urlString, extraHeaders = {}, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
      let parsed;
      try { parsed = new URL(urlString); } catch { return reject(new Error(`Invalid Spotify URL: ${urlString}`)); }
      const req = https.request({
        hostname: parsed.hostname,
        port: 443,
        path: parsed.pathname + parsed.search,
        method: "GET",
        timeout: 15000,
        headers: {
          "User-Agent": browserUserAgent,
          "Accept": "application/json, text/html, */*",
          "Accept-Language": "en-US,en;q=0.9",
          "Origin": "https://open.spotify.com",
          "Referer": "https://open.spotify.com/",
          "App-Platform": "WebPlayer",
          ...extraHeaders
        }
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && maxRedirects > 0) {
          res.resume();
          resolve(httpGet(new URL(res.headers.location, urlString).toString(), extraHeaders, maxRedirects - 1));
          return;
        }
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => resolve({ status: res.statusCode, body }));
      });
      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("Spotify request timed out")); });
      req.end();
    });
  }

  function httpPostForm(urlString, formData = {}) {
    return new Promise((resolve, reject) => {
      let parsed;
      try { parsed = new URL(urlString); } catch { return reject(new Error(`Invalid Spotify URL: ${urlString}`)); }
      const body = new URLSearchParams(formData).toString();
      const req = https.request({
        hostname: parsed.hostname,
        port: 443,
        path: parsed.pathname + parsed.search,
        method: "POST",
        timeout: 15000,
        headers: {
          "User-Agent": browserUserAgent,
          "Accept": "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body)
        }
      }, (res) => {
        let responseBody = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { responseBody += chunk; });
        res.on("end", () => resolve({ status: res.statusCode, body: responseBody }));
      });
      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("Spotify request timed out")); });
      req.write(body);
      req.end();
    });
  }

  async function tokenRequest(formData) {
    const res = await httpPostForm("https://accounts.spotify.com/api/token", formData);
    let data = {};
    try { data = JSON.parse(res.body || "{}"); } catch {}
    if (res.status !== 200) {
      const detail = data?.error_description || data?.error || res.body?.slice?.(0, 160) || "";
      throw new Error(`Spotify OAuth returned HTTP ${res.status}${detail ? ` — ${detail}` : ""}`);
    }
    return data;
  }

  async function exchangeAuthorizationCode(code, codeVerifier) {
    const data = await tokenRequest({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: codeVerifier
    });
    return saveOAuthResponse(data);
  }

  async function refreshAccessToken(previous = readOAuthToken()) {
    if (!previous?.refreshToken) throw new Error("Spotify is not connected. Press Connect Spotify first.");
    const data = await tokenRequest({
      grant_type: "refresh_token",
      refresh_token: previous.refreshToken,
      client_id: clientId
    });
    return saveOAuthResponse(data, previous);
  }

  async function getAccessToken() {
    if (!clientId) throw new Error("Spotify OAuth is unavailable, but public fallback can still fetch public Spotify links.");
    const now = Date.now();
    const saved = readOAuthToken();
    if (token && now < tokenExpiry - 30_000) return token;
    if (saved?.accessToken && saved.expiresAt && now < saved.expiresAt - 30_000) {
      token = saved.accessToken;
      tokenExpiry = saved.expiresAt;
      return saved.accessToken;
    }
    if (saved?.refreshToken) return (await refreshAccessToken(saved)).accessToken;
    throw new Error("Spotify is not connected. Press Connect Spotify first.");
  }

  function createCallbackWaiter(expectedState) {
    let server = null;
    let timer = null;
    let settled = false;
    let finish = null;
    const promise = new Promise((resolve, reject) => {
      finish = (error, value) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        timer = null;
        try { if (server) server.close(); } catch {}
        server = null;
        if (error) reject(error); else resolve(value);
      };
      server = http.createServer((req, res) => {
        try {
          const requestUrl = new URL(req.url || "/", redirectUri);
          if (requestUrl.pathname !== "/spotify/callback") {
            res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
            res.end("not found");
            return;
          }
          const error = requestUrl.searchParams.get("error");
          if (error) {
            res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
            res.end("<html><body style='font-family:sans-serif;background:#08070f;color:white'><h2>Spotify login cancelled.</h2><p>You can close this window.</p></body></html>");
            finish(new Error(`Spotify login cancelled: ${error}`));
            return;
          }
          const state = requestUrl.searchParams.get("state") || "";
          const code = requestUrl.searchParams.get("code") || "";
          if (!code) {
            res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
            res.end("missing spotify code");
            finish(new Error("Spotify did not return a login code."));
            return;
          }
          if (state !== expectedState) {
            res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
            res.end("spotify state mismatch");
            finish(new Error("Spotify login state mismatch. Try again."));
            return;
          }
          res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
          res.end("<html><body style='font-family:sans-serif;background:#08070f;color:white'><h2>Spotify connected to localtify.</h2><p>You can close this window now.</p></body></html>");
          finish(null, { code });
        } catch (error) {
          if (typeof finish === "function") finish(error);
        }
      });
      server.once("error", (error) => {
        if (typeof finish === "function") finish(new Error(`Spotify callback server failed: ${error?.message || error}`));
      });
      timer = setTimeout(() => {
        if (typeof finish === "function") finish(new Error("Spotify login timed out."));
      }, 5 * 60 * 1000);
      server.listen(redirectPort, "127.0.0.1");
    });
    return {
      promise,
      cancel: (reason = "Spotify login cancelled.") => {
        if (!settled && typeof finish === "function") finish(new Error(reason));
      }
    };
  }

  async function login() {
    if (!clientId) {
      return {
        ok: true,
        ready: true,
        loggedIn: false,
        publicOnly: true,
        fallbackAvailable: true,
        mode: "public-fallback",
        needsClientId: false,
        redirectUri,
        error: "Spotify OAuth is unavailable, but public playlist/album/track import is ready."
      };
    }

    const codeVerifier = makeCodeVerifier();
    const codeChallenge = makeCodeChallenge(codeVerifier);
    const state = base64UrlEncode(crypto.randomBytes(18));
    const authUrl = new URL("https://accounts.spotify.com/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("show_dialog", "false");

    const waiter = createCallbackWaiter(state);
    let loginWindow = null;
    try {
      loginWindow = new BrowserWindow({
        width: 540,
        height: 720,
        title: "Connect Spotify — localtify",
        parent: getMainWindow() || undefined,
        modal: false,
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true
        }
      });
      loginWindow.setMenu(null);
      loginWindow.loadURL(authUrl.toString());
      loginWindow.on("closed", () => waiter.cancel("Spotify login cancelled."));
      const { code } = await waiter.promise;
      await exchangeAuthorizationCode(code, codeVerifier);
      try { if (loginWindow && !loginWindow.isDestroyed()) loginWindow.close(); } catch {}
      return {
        ok: true,
        ready: true,
        loggedIn: true,
        publicOnly: true,
        mode: "oauth-pkce",
        redirectUri,
        message: "Spotify connected. Public playlists, albums, and tracks can be imported."
      };
    } catch (error) {
      const message = error?.message || "Spotify login failed.";
      return {
        ok: false,
        ready: Boolean(clientId),
        loggedIn: false,
        cancelled: /cancel/i.test(message),
        publicOnly: true,
        mode: "oauth-pkce",
        redirectUri,
        error: message
      };
    } finally {
      waiter.cancel();
      try { if (loginWindow && !loginWindow.isDestroyed()) loginWindow.close(); } catch {}
    }
  }

  async function apiGet(endpoint) {
    const url = endpoint.startsWith("https://") ? endpoint : `https://api.spotify.com/v1${endpoint}`;
    const fetchOnce = async () => httpGet(url, {
      Authorization: `Bearer ${await getAccessToken()}`,
      Accept: "application/json"
    });
    let res = await fetchOnce();
    if (res.status === 401) {
      token = null;
      tokenExpiry = 0;
      await refreshAccessToken();
      res = await fetchOnce();
    }
    if (res.status === 403 || res.status === 404) {
      throw new Error("Spotify could not read this link. Make sure the playlist is public, then copy the link again.");
    }
    if (res.status === 429) throw new Error("Spotify rate-limited this request. Wait a little and try again.");
    if (res.status !== 200) throw new Error(`Spotify API returned HTTP ${res.status}.`);
    try { return JSON.parse(res.body); } catch { throw new Error("Could not parse Spotify API response."); }
  }

  function parseUrl(rawUrl) {
    const raw = String(rawUrl || "").trim();
    if (!raw) return null;
    const uriMatch = raw.match(/^spotify:(playlist|album|track):([A-Za-z0-9]+)$/i);
    if (uriMatch) return { type: uriMatch[1].toLowerCase(), id: uriMatch[2] };
    const urlMatch = raw.match(/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(?:embed\/)?(playlist|album|track)\/([A-Za-z0-9]+)/i);
    if (urlMatch) return { type: urlMatch[1].toLowerCase(), id: urlMatch[2] };
    return null;
  }

  function bestImage(images = []) {
    if (!Array.isArray(images) || !images.length) return "";
    const sorted = images.filter((image) => image?.url).slice().sort((a, b) => Number(b?.width || 0) - Number(a?.width || 0));
    return String(sorted[0]?.url || "");
  }

  function shapeTrack(track, fallbackAlbumName = "", fallbackCoverUrl = "") {
    if (!track?.name) return null;
    const artists = Array.isArray(track.artists)
      ? track.artists.map((artist) => artist?.name).filter(Boolean).join(", ")
      : "";
    const coverUrl = bestImage(track.album?.images) || bestImage(track.images) || String(track.coverUrl || track.spotifyCoverUrl || track.albumCoverUrl || fallbackCoverUrl || "");
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

  function uniqIds(ids = []) {
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

  async function fetchOembed(spotifyUrl) {
    const res = await httpGet(`https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`, { Accept: "application/json" });
    if (res.status !== 200) return null;
    try { return JSON.parse(res.body || "{}"); } catch { return null; }
  }

  async function fetchPublicTrack(trackId) {
    const trackUrl = `https://open.spotify.com/track/${trackId}`;
    try {
      const apiTrack = await apiGet(`/tracks/${trackId}`);
      const shaped = shapeTrack(apiTrack);
      if (shaped?.name) return shaped;
    } catch {}

    let title = "";
    let artist = "";
    let coverUrl = "";
    try {
      const oembed = await fetchOembed(trackUrl);
      const rawTitle = decodeHtmlEntities(oembed?.title || "").trim();
      coverUrl = String(oembed?.thumbnail_url || oembed?.thumbnailUrl || "");
      if (rawTitle) {
        const dashIndex = rawTitle.indexOf(" - ");
        title = dashIndex >= 0 ? rawTitle.slice(0, dashIndex).trim() : rawTitle;
        artist = dashIndex >= 0 ? rawTitle.slice(dashIndex + 3).trim() : "";
      }
    } catch {}

    try {
      const htmlRes = await httpGet(trackUrl, { Accept: "text/html" });
      if (htmlRes.status === 200) {
        const html = htmlRes.body || "";
        if (!title) {
          const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || html.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (titleMatch?.[1]) {
            const raw = decodeHtmlEntities(titleMatch[1]).replace(/\s*\|\s*Spotify\s*$/i, "").trim();
            const dashIndex = raw.indexOf(" - ");
            title = dashIndex >= 0 ? raw.slice(0, dashIndex).trim() : raw;
            if (!artist && dashIndex >= 0) artist = raw.slice(dashIndex + 3).trim();
          }
        }
        if (!coverUrl) {
          const imageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
          coverUrl = decodeHtmlEntities(imageMatch?.[1] || "").trim();
        }
        if (!artist) {
          const descriptionMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
          const desc = decodeHtmlEntities(descriptionMatch?.[1] || "").trim();
          if (desc) artist = desc.split("·")[0].trim();
        }
      }
    } catch {}

    title = title || `Spotify track ${trackId}`;
    return {
      id: trackId,
      title,
      name: title,
      artist,
      artists: artist,
      albumName: "",
      coverUrl,
      albumCoverUrl: coverUrl,
      spotifyCoverUrl: coverUrl,
      duration: 0,
      durationMs: 0,
      spotifyUrl: trackUrl
    };
  }

  async function fetchPublicPlaylist(playlistId) {
    const playlistUrl = `https://open.spotify.com/playlist/${playlistId}`;
    let playlistName = "Spotify Playlist";
    const ids = [];
    try {
      const oembed = await fetchOembed(playlistUrl);
      const rawName = decodeHtmlEntities(oembed?.title || "").trim();
      if (rawName) playlistName = rawName.replace(/\s*\|\s*Spotify\s*$/i, "").trim() || playlistName;
    } catch {}

    const urlsToTry = [playlistUrl, `https://open.spotify.com/embed/playlist/${playlistId}`, `https://open.spotify.com/playlist/${playlistId}?nd=1`];
    for (const url of urlsToTry) {
      try {
        const res = await httpGet(url, { Accept: "text/html" });
        if (res.status !== 200) continue;
        const html = res.body || "";
        const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (ogTitle?.[1]) {
          const raw = decodeHtmlEntities(ogTitle[1]).replace(/\s*\|\s*Spotify\s*$/i, "").trim();
          if (raw && !/^spotify$/i.test(raw)) playlistName = raw;
        }
        for (const match of html.matchAll(/spotify:track:([A-Za-z0-9]+)/g)) ids.push(match[1]);
        for (const match of html.matchAll(/open\.spotify\.com\/track\/([A-Za-z0-9]+)/g)) ids.push(match[1]);
        for (const match of html.matchAll(/\/track\/([A-Za-z0-9]{18,24})/g)) ids.push(match[1]);
        for (const match of html.matchAll(/"uri"\s*:\s*"spotify:track:([A-Za-z0-9]+)"/g)) ids.push(match[1]);
        if (ids.length) break;
      } catch (error) {
        console.log("[localitfy spotify fallback page error]", error?.message || error);
      }
    }

    const trackIds = uniqIds(ids);
    if (!trackIds.length) {
      throw new Error("Spotify could not expose tracks for this playlist. Make sure it is public on your profile, not only shareable by link, then try again.");
    }
    const tracks = [];
    const limitedIds = trackIds.slice(0, 250);
    for (let index = 0; index < limitedIds.length; index += 8) {
      const shaped = await Promise.all(limitedIds.slice(index, index + 8).map((trackId) => fetchPublicTrack(trackId).catch(() => null)));
      for (const track of shaped) if (track?.name) tracks.push(track);
    }
    return { name: playlistName, playlistName, type: "playlist", publicOnly: true, fallback: true, tracks };
  }

  async function fetchPublicAlbum(albumId) {
    const albumUrl = `https://open.spotify.com/album/${albumId}`;
    let albumName = "Spotify Album";
    const ids = [];
    try {
      const oembed = await fetchOembed(albumUrl);
      const rawName = decodeHtmlEntities(oembed?.title || "").trim();
      if (rawName) albumName = rawName.replace(/\s*\|\s*Spotify\s*$/i, "").trim() || albumName;
    } catch {}
    try {
      const res = await httpGet(`https://open.spotify.com/embed/album/${albumId}`, { Accept: "text/html" });
      if (res.status === 200) {
        const html = res.body || "";
        for (const match of html.matchAll(/spotify:track:([A-Za-z0-9]+)/g)) ids.push(match[1]);
        for (const match of html.matchAll(/open\.spotify\.com\/track\/([A-Za-z0-9]+)/g)) ids.push(match[1]);
        for (const match of html.matchAll(/\/track\/([A-Za-z0-9]{18,24})/g)) ids.push(match[1]);
      }
    } catch {}
    const trackIds = uniqIds(ids);
    if (!trackIds.length) throw new Error("Spotify could not expose tracks for this album. Try connecting again or use the track links directly.");
    const tracks = [];
    for (let index = 0; index < trackIds.length; index += 8) {
      const shaped = await Promise.all(trackIds.slice(index, index + 8).map((trackId) => fetchPublicTrack(trackId).catch(() => null)));
      for (const track of shaped) if (track?.name) tracks.push({ ...track, albumName });
    }
    return { name: albumName, playlistName: albumName, type: "album", publicOnly: true, fallback: true, tracks };
  }

  async function fetchPublicFallback(rawUrl, reason = "") {
    const parsed = parseUrl(rawUrl);
    if (!parsed) throw new Error("Paste a valid Spotify playlist, album, or track link.");
    console.log("[localitfy spotify] using public fallback", { type: parsed.type, reason });
    if (parsed.type === "track") {
      const track = await fetchPublicTrack(parsed.id);
      return { name: track.title, playlistName: track.title, type: "track", publicOnly: true, fallback: true, tracks: [track] };
    }
    if (parsed.type === "album") return fetchPublicAlbum(parsed.id);
    if (parsed.type === "playlist") return fetchPublicPlaylist(parsed.id);
    throw new Error(`Unsupported Spotify link type: ${parsed.type}`);
  }

  async function fetchTracksFromUrl(rawUrl) {
    const parsed = parseUrl(rawUrl);
    if (!parsed) throw new Error("Paste a valid Spotify playlist, album, or track link.");
    if (!clientId) return fetchPublicFallback(rawUrl, "spotify client id unavailable");
    const { type, id } = parsed;
    try {
      if (type === "track") {
        const track = await apiGet(`/tracks/${id}`);
        const shaped = shapeTrack(track);
        return { name: shaped?.title || "Spotify Track", playlistName: shaped?.title || "Spotify Track", type: "track", publicOnly: true, tracks: shaped ? [shaped] : [] };
      }
      if (type === "album") {
        const album = await apiGet(`/albums/${id}`);
        const tracks = [];
        let next = `/albums/${id}/tracks?limit=50&offset=0`;
        while (next) {
          const page = await apiGet(next);
          for (const track of page.items || []) {
            const shaped = shapeTrack(track, album.name || "", bestImage(album.images));
            if (shaped) tracks.push(shaped);
          }
          next = page.next || null;
        }
        return { name: album.name || "Spotify Album", playlistName: album.name || "Spotify Album", type: "album", publicOnly: true, tracks };
      }
      if (type === "playlist") {
        const info = await apiGet(`/playlists/${id}?fields=name,public,owner(display_name)`);
        if (info && info.public === false) {
          throw new Error("This playlist is link-shareable but not public to the Spotify API. Add it to your public profile, or try the fallback fetch again.");
        }
        const tracks = [];
        let offset = 0;
        while (true) {
          const page = await apiGet(`/playlists/${id}/tracks?limit=100&offset=${offset}&fields=items(track(id,name,artists,album(name,images(url,width,height)),duration_ms,is_local,external_urls,external_ids(isrc))),next`);
          const items = page.items || [];
          for (const item of items) {
            const track = item?.track;
            if (!track?.name || track.is_local) continue;
            const shaped = shapeTrack(track);
            if (shaped) tracks.push(shaped);
          }
          if (!page.next || items.length < 100) break;
          offset += 100;
        }
        return { name: info.name || "Spotify Playlist", playlistName: info.name || "Spotify Playlist", type: "playlist", publicOnly: true, tracks };
      }
      throw new Error(`Unsupported Spotify link type: ${type}`);
    } catch (error) {
      const message = error?.message || String(error || "");
      const canFallback = /could not read this link|public profile|private|403|404|not expose|spotify api returned http|spotify is not connected|oauth is unavailable|client id/i.test(message);
      if (!canFallback) throw error;
      return fetchPublicFallback(rawUrl, message);
    }
  }

  function safeImageExtension(rawUrl = "", contentType = "") {
    const cleanType = String(contentType || "").toLowerCase();
    const cleanUrl = String(rawUrl || "").toLowerCase();
    if (cleanType.includes("png") || cleanUrl.includes(".png")) return ".png";
    if (cleanType.includes("webp") || cleanUrl.includes(".webp")) return ".webp";
    if (cleanType.includes("gif") || cleanUrl.includes(".gif")) return ".gif";
    return ".jpg";
  }

  function coverCacheDirectory() {
    const target = path.join(app.getPath("userData"), "spotify-covers");
    try { fs.mkdirSync(target, { recursive: true }); } catch {}
    return target;
  }

  function downloadHttpsBuffer(urlString, maxBytes = 8 * 1024 * 1024, redirectLimit = 4) {
    return new Promise((resolve, reject) => {
      let parsed;
      try { parsed = new URL(String(urlString || "")); } catch { return reject(new Error("invalid cover url")); }
      if (parsed.protocol !== "https:") return reject(new Error("cover url must be https"));
      const req = https.request({
        hostname: parsed.hostname,
        port: 443,
        path: parsed.pathname + parsed.search,
        method: "GET",
        timeout: 15000,
        headers: {
          "User-Agent": browserUserAgent,
          "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          "Referer": "https://open.spotify.com/"
        }
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectLimit > 0) {
          res.resume();
          const nextUrl = new URL(res.headers.location, urlString).toString();
          downloadHttpsBuffer(nextUrl, maxBytes, redirectLimit - 1).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`cover returned HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        let total = 0;
        res.on("data", (chunk) => {
          total += chunk.length;
          if (total > maxBytes) {
            req.destroy(new Error("cover image too large"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve({ buffer: Buffer.concat(chunks), contentType: String(res.headers["content-type"] || "") }));
      });
      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("cover download timed out")); });
      req.end();
    });
  }

  async function cacheCoverImage(coverUrl, stableKey = "") {
    const cleanUrl = String(coverUrl || "").trim();
    if (!cleanUrl || !/^https:\/\/i\.scdn\.co\//i.test(cleanUrl)) return "";
    try {
      const hash = crypto.createHash("sha1").update(`${stableKey}::${cleanUrl}`).digest("hex").slice(0, 22);
      const cacheDir = coverCacheDirectory();
      for (const ext of [".jpg", ".png", ".webp", ".gif"]) {
        const existing = path.join(cacheDir, `${hash}${ext}`);
        if (fileExists(existing)) return existing;
      }
      const image = await downloadHttpsBuffer(cleanUrl);
      const ext = safeImageExtension(cleanUrl, image.contentType);
      const targetPath = path.join(cacheDir, `${hash}${ext}`);
      await fs.promises.writeFile(targetPath, image.buffer);
      return targetPath;
    } catch (error) {
      console.log("[localitfy spotify cover cache error]", error?.message || error);
      return "";
    }
  }

  function status() {
    const saved = readOAuthToken();
    return {
      ok: true,
      ready: true,
      loggedIn: Boolean(saved?.refreshToken),
      publicOnly: true,
      fallbackAvailable: true,
      mode: clientId ? "oauth-pkce" : "public-fallback",
      needsClientId: false,
      redirectUri,
      error: ""
    };
  }

  function retiredCookieLoginResponse(message) {
    return {
      ok: false,
      ready: true,
      loggedIn: Boolean(readOAuthToken()?.refreshToken),
      publicOnly: true,
      fallbackAvailable: true,
      mode: clientId ? "oauth-pkce" : "public-fallback",
      needsClientId: false,
      redirectUri,
      error: message
    };
  }

  return Object.freeze({
    clientId,
    redirectUri,
    readOAuthToken,
    clearOAuthToken,
    login,
    fetchTracksFromUrl,
    cacheCoverImage,
    status,
    retiredCookieLoginResponse
  });
}

module.exports = { createSpotifyRuntime };
