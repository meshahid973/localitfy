import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { observeArtwork, getResolvedRemoteArtwork, invalidateResolvedRemoteArtwork, resolveRemoteArtwork } from "../covers/thumbnailResource";
import { Disc3, UserRound } from "lucide-react";
import type { DiscoverArtwork } from "./discover.types";
const cache = new Map<string, {at:number; value:DiscoverArtwork}>();
type ArtworkJob = () => Promise<void>;
const waiting: ArtworkJob[] = [];
let running = 0;
function pumpArtwork() {
  while (running < 4 && waiting.length) {
    const job = waiting.shift()!;
    running++;
    void job().catch(() => undefined).finally(() => { running--; pumpArtwork(); });
  }
}
function enqueueArtwork(job: ArtworkJob) {
  if (waiting.length >= 128) return undefined;
  waiting.push(job);
  pumpArtwork();
  return () => {
    const index = waiting.indexOf(job);
    if (index < 0) return false;
    waiting.splice(index, 1);
    return true;
  };
}
function cachedArtwork(key: string) {
  const hit = cache.get(key);
  if (!hit || Date.now() - hit.at >= 86400000) {
    cache.delete(key);
    return undefined;
  }
  cache.delete(key);
  cache.set(key, hit);
  return hit.value;
}
const normalizeKey = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
const artworkKey = (title: string, artist: string, person = false, providerId = "", album = "", durationMs = 0) =>
  JSON.stringify([person ? "artist" : "recording", normalizeKey(title), normalizeKey(artist), providerId, normalizeKey(album), durationMs]);
export function getCachedDiscoverArtwork(title: string, artist: string) {
  const key = artworkKey(title, artist);
  return cachedArtwork(key + ":fallback") || cachedArtwork(key);
}
const audioDbCover = /^https:\/\/(?:www\.|r2\.)?theaudiodb\.com\/images\/media\/album\/thumb\/[a-z0-9_-]+\.(?:jpg|jpeg|png)(?:\/(?:small|medium))?$/i;
const youtubeCover = /^https:\/\/(?:lh[0-9]+\.googleusercontent\.com|yt3\.ggpht\.com|yt3\.googleusercontent\.com)\/[A-Za-z0-9_-]+=w256-h256-l90-rj$|^https:\/\/i\.ytimg\.com\/vi\/[A-Za-z0-9_-]{11}\/(?:hqdefault|mqdefault|default|sddefault|maxresdefault)\.jpg$/;
const deezerCover = /^https:\/\/(?:e-cdns-images|cdns-images|cdn-images)\.dzcdn\.net\/images\/(?:cover|artist)\/[a-f0-9]{32}\/250x250-000000-80-0-0\.jpg$/i;
const fanartCover = /^https:\/\/assets\.fanart\.tv\/fanart\/music\/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}\/(?:albumcover|artistthumb)\/[-a-z0-9_.%]+\.(?:jpg|jpeg|png)\/preview$/i;
export const isDisplayOnlyCover = (value?: string) => Boolean(value && (deezerCover.test(value) || fanartCover.test(value)));
const safeCover = (value?: string) => value && (deezerCover.test(value) || fanartCover.test(value) || youtubeCover.test(value) || audioDbCover.test(value) || /^https:\/\/coverartarchive\.org\/(release|release-group)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/front-250$/i.test(value) || (/^https:\/\/(?:lastfm\.freetls\.fastly\.net|lastfm-img2\.akamaized\.net)\/i\/u\/(?:[0-9]+x[0-9]+|[0-9]+s)\/[a-f0-9]{32}\.(?:png|jpe?g|webp)$/i.test(value) && !/2a96cbd8b46e442fc41c2b86b821562f|4128a6eb29f94943c9d206c08e625904/i.test(value))) ? value : undefined;
export function DiscoverCover({ title, artist, artwork, lookup = false, person = false, providerId = "" }: {
  title: string; artist: string; artwork?: DiscoverArtwork & { album?: string }; lookup?: boolean; person?: boolean; providerId?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    return observeArtwork(ref.current, value => setNear(value));
  }, []);
  const album = providerId ? artwork?.album || "" : "";
  const durationMs = providerId ? artwork?.durationMs || 0 : 0;
  const key = artworkKey(title, artist, person, providerId, album, durationMs);
  const [resolved, setResolved] = useState<{ key: string; value: DiscoverArtwork; fallback: boolean }>();
  const [loaded, setLoaded] = useState<{key:string; url:string}>();
  const [local, setLocal] = useState<{source:string; url:string}>();
  const [badLocal, setBadLocal] = useState("");
  const [failure, setFailure] = useState<{key:string; urls:string[]}>({key:"",urls:[]});
  const cover = resolved?.key === key ? resolved.value : cachedArtwork(key + ":fallback") || cachedArtwork(key);
  const failed = failure.key === key ? failure.urls : [];
  const directUrls = [artwork?.coverUrl, artwork?.fallbackCoverUrl, ...(artwork?.coverAlternatives ?? []).slice(0,6)].map(safeCover).filter(Boolean);
  const resolvedUrls = [safeCover(cover?.coverUrl), safeCover(cover?.fallbackCoverUrl), ...(cover?.coverAlternatives ?? []).slice(0,6).map(safeCover)];
  const candidates = failed.length ? [...resolvedUrls, ...directUrls] : [...directUrls, ...resolvedUrls];
  const src = candidates.find(url => url && !failed.includes(url));
  const needsLookup = lookup && (!directUrls.length || failed.length > 0);
  // The cache returns a display URL only; the provider URL remains the lookup/download identity.
  const remembered = src ? getResolvedRemoteArtwork(src) : undefined;
  const eligibleLocal = Boolean(src && !isDisplayOnlyCover(src) && window.localitfy?.resolveRemoteArtwork);
  const pendingLocal = Boolean(near && eligibleLocal && remembered === undefined && local?.source !== src);
  useEffect(() => {
    if (!near || !src || isDisplayOnlyCover(src) || !window.localitfy?.resolveRemoteArtwork) return;
    let active = true;
    void resolveRemoteArtwork(src).then(url => {
      if (active) setLocal({source: src, url});
    });
    return () => { active = false; };
  }, [src, near]);
  const localCandidate = eligibleLocal ? (remembered ?? (local?.source === src ? local.url : "")) : "";
  const localSrc = localCandidate !== badLocal ? localCandidate : "";
  const displaySrc = pendingLocal ? "" : localSrc || src;
  const imageReady = Boolean(displaySrc && loaded?.key === key && loaded.url === displaySrc);
  const imageRef = useRef<HTMLImageElement>(null);
  useLayoutEffect(() => {
    if (displaySrc && imageRef.current?.complete && imageRef.current.naturalWidth > 0) setLoaded({key,url:displaySrc});
  }, [key, displaySrc]);
  const rejectLocal = () => { if (src) invalidateResolvedRemoteArtwork(src); setBadLocal(localSrc); };
  const exhausted = Boolean(resolved?.key === key && (resolved.fallback || (!src && failed.length > 0)));
  const requestKey = exhausted ? key + ":fallback" : key;
  useEffect(() => {
    if (!near || !src || !displaySrc || imageReady) return;
    const timer = window.setTimeout(() => {
      if (localSrc) { invalidateResolvedRemoteArtwork(src); setBadLocal(localSrc); }
      else setFailure(current => ({key,urls:[...new Set([...(current.key === key ? current.urls : []),src])]}));
    }, 6500);
    return () => window.clearTimeout(timer);
  }, [src, displaySrc, localSrc, key, imageReady, near]);
  useEffect(() => {
    if (!needsLookup || (!person && !artist) || !title || !near) return;
    let live = true;
    let cancelQueued: (() => boolean) | undefined;
    let retryTimer: number | undefined;
    let attempts = 0;
    const start = () => {
      if (!live) return;
      const cached = cachedArtwork(requestKey);
      if (cached) { setResolved({ key, value: cached, fallback: exhausted }); return; }
      cancelQueued = enqueueArtwork(async () => {
        if (!live) return;
        let value = cachedArtwork(requestKey);
        if (!value) {
          attempts++;
          const answer = await window.localitfy.getDiscoveries({ artwork: { title, artist, kind: person ? "artist" : "recording", fallback: exhausted, providerId, album, durationMs } }).catch(() => null);
          if (answer?.status !== "artwork") {
            if (live && attempts < 3 && answer?.status !== "off") retryTimer = window.setTimeout(start, attempts * 900);
            return;
          }
          value = answer;
          if (!value.coverUrl && !value.fallbackCoverUrl && !value.coverAlternatives?.length) return;
          cache.set(requestKey, { at: Date.now(), value });
          const oldest = cache.keys().next().value;
          if (cache.size > 512 && oldest !== undefined) cache.delete(oldest);
        }
        if (live) setResolved({ key, value, fallback: exhausted });
      });
      if (!cancelQueued && live && ++attempts < 3) retryTimer = window.setTimeout(start, attempts * 900);
    };
    start();
    return () => { live = false; cancelQueued?.(); if (retryTimer !== undefined) window.clearTimeout(retryTimer); };
  }, [key, title, artist, needsLookup, near, person, exhausted, requestKey, providerId, album, durationMs]);
  return <span ref={ref} className="discoverCover" aria-hidden="true">
    {!imageReady ? (person ? <UserRound size={24} /> : <Disc3 size={24} />) : null}
    {(near || imageReady) && src && displaySrc ? <img key={displaySrc} ref={imageRef} src={displaySrc} alt="" loading="eager" decoding="async" fetchPriority="auto" referrerPolicy="no-referrer" data-ready={imageReady}
      onLoad={() => setLoaded({key,url:displaySrc})}
      onError={() => { if (localSrc) rejectLocal(); else setFailure(current => ({key,urls:[...new Set([...(current.key === key ? current.urls : []),src])]})); }} /> : null}
  </span>;
}
