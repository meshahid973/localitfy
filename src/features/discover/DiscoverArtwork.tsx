import { useEffect, useRef, useState } from "react";
import { Disc3, UserRound } from "lucide-react";
import type { DiscoverArtwork } from "./discover.types";
const cache = new Map<string, {at:number; value:DiscoverArtwork}>();
type ArtworkJob = () => Promise<void>;
const waiting: ArtworkJob[] = [];
let running = 0;
function pumpArtwork() {
  while (running < 2 && waiting.length) {
    const job = waiting.shift()!;
    running++;
    void job().catch(() => undefined).finally(() => { running--; pumpArtwork(); });
  }
}
function enqueueArtwork(job: ArtworkJob) {
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
  if (!hit || Date.now() - hit.at >= (hit.value.coverUrl || hit.value.fallbackCoverUrl ? 86400000 : 600000)) {
    cache.delete(key);
    return undefined;
  }
  cache.delete(key);
  cache.set(key, hit);
  return hit.value;
}
export function getCachedDiscoverArtwork(title: string, artist: string) {
  return cachedArtwork(JSON.stringify([title, artist]));
}
const audioDbCover = /^https:\/\/(?:www\.|r2\.)?theaudiodb\.com\/images\/media\/album\/thumb\/[a-z0-9_-]+\.(?:jpg|jpeg|png)(?:\/(?:small|medium))?$/i;
const youtubeCover = /^https:\/\/(?:lh[0-9]+\.googleusercontent\.com|yt3\.ggpht\.com|yt3\.googleusercontent\.com)\/[A-Za-z0-9_-]+=w256-h256-l90-rj$|^https:\/\/i\.ytimg\.com\/vi\/[A-Za-z0-9_-]{11}\/(?:hqdefault|mqdefault|default|sddefault|maxresdefault)\.jpg$/;
const safeCover = (value?: string) => value && (youtubeCover.test(value) || audioDbCover.test(value) || /^https:\/\/coverartarchive\.org\/(release|release-group)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/front-250$/i.test(value) || (/^https:\/\/(?:lastfm\.freetls\.fastly\.net|lastfm-img2\.akamaized\.net)\/i\/u\/(?:[0-9]+x[0-9]+|[0-9]+s)\/[a-f0-9]{32}\.(?:png|jpe?g|webp)$/i.test(value) && !/2a96cbd8b46e442fc41c2b86b821562f|4128a6eb29f94943c9d206c08e625904/i.test(value))) ? value : undefined;
export function DiscoverCover({ title, artist, artwork, lookup = false, person = false }: {
  title: string; artist: string; artwork?: DiscoverArtwork; lookup?: boolean; person?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    if (typeof IntersectionObserver === "undefined") { setNear(true); return; }
    const observer = new IntersectionObserver(entries => { if(entries.some(entry=>entry.isIntersecting)){setNear(true);observer.disconnect();} },{rootMargin:"240px"});
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const key = JSON.stringify([title, artist]);
  const [resolved, setResolved] = useState<{ key: string; value: DiscoverArtwork }>();
  const [loaded, setLoaded] = useState<{key:string; url:string}>();
  const [failure, setFailure] = useState<{key:string; urls:string[]}>({key:"",urls:[]});
  const cover = resolved?.key === key ? resolved.value : undefined;
  const failed = failure.key === key ? failure.urls : [];
  const directUrls = [artwork?.coverUrl, artwork?.fallbackCoverUrl, ...(artwork?.coverAlternatives ?? []).slice(0,6)].map(safeCover).filter(Boolean);
  const resolvedUrls = [safeCover(cover?.coverUrl), safeCover(cover?.fallbackCoverUrl), ...(cover?.coverAlternatives ?? []).slice(0,6).map(safeCover)];
  const src = [...(failed.length ? resolvedUrls : []), ...directUrls, ...resolvedUrls].find(url => url && !failed.includes(url));
  const needsLookup = lookup && (!directUrls.length || failed.length > 0);
  const imageReady = Boolean(src && loaded?.key === key && loaded.url === src);
  useEffect(() => {
    if (!near || !src || imageReady) return;
    const timer = window.setTimeout(() => setFailure(current => ({key,urls:[...new Set([...(current.key === key ? current.urls : []),src])]})), 6500);
    return () => window.clearTimeout(timer);
  }, [src, key, imageReady, near]);
  useEffect(() => {
    if (!needsLookup || !artist || !title || !ref.current) return;
    let live = true, requested = false;
    let cancelQueued: (() => boolean) | undefined;
    const start = () => {
      if (requested || !live) return;
      const cached = cachedArtwork(key);
      if (cached) {
        requested = true;
        setResolved({ key, value: cached });
        return;
      }
      requested = true;
      cancelQueued = enqueueArtwork(async () => {
        if (!live) return;
        let value = cachedArtwork(key);
        if (!value) {
          const answer = await window.localitfy.getDiscoveries({ artwork: { title, artist } }).catch(() => null);
          if (answer?.status !== "artwork") { requested = false; return; }
          value = answer;
          cache.set(key, { at: Date.now(), value });
          const oldest = cache.keys().next().value;
          if (cache.size > 512 && oldest !== undefined) cache.delete(oldest);
        }
        if (live) setResolved({ key, value });
      });
    };
    const stop = () => {
      if (cancelQueued?.()) { requested = false; cancelQueued = undefined; }
    };
    if (typeof IntersectionObserver === "undefined") {
      start();
      return () => { live = false; stop(); };
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) start();
      else stop();
    }, { rootMargin: "240px" });
    observer.observe(ref.current);
    return () => { live = false; observer.disconnect(); stop(); };
  }, [key, title, artist, needsLookup]);
  return <span ref={ref} className="discoverCover" aria-hidden="true">
    {!imageReady ? (person ? <UserRound size={24} /> : <Disc3 size={24} />) : null}
    {near && src ? <img key={src} src={src} alt="" loading="eager" decoding="async" fetchPriority="low" referrerPolicy="no-referrer" data-ready={imageReady}
      onLoad={() => setLoaded({key,url:src})}
      onError={() => setFailure(current => ({key,urls:[...(current.key === key ? current.urls : []),src]}))} /> : null}
  </span>;
}
