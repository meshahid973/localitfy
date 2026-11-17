import { useEffect, useRef, useState } from "react";
import { Disc3, UserRound } from "lucide-react";
import type { DiscoverArtwork } from "./discover.types";
let queue = Promise.resolve();
const cache = new Map<string, {at:number; value:DiscoverArtwork}>();
const safeCover = (value?: string) => value && /^https:\/\/coverartarchive\.org\/(release|release-group)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/front-250$/i.test(value) ? value : undefined;
export function DiscoverCover({ title, artist, artwork, lookup = false, person = false }: {
  title: string; artist: string; artwork?: DiscoverArtwork; lookup?: boolean; person?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const key = JSON.stringify([title, artist]);
  const [resolved, setResolved] = useState<{ key: string; value: DiscoverArtwork }>();
  const [failed, setFailed] = useState<string[]>([]);
  const cover = artwork?.coverUrl ? artwork : resolved?.key === key ? resolved.value : undefined;
  const src = [safeCover(cover?.coverUrl), safeCover(cover?.fallbackCoverUrl)].find(url => url && !failed.includes(url));
  useEffect(() => {
    if (!lookup || artwork?.coverUrl || !artist || !title || !ref.current) return;
    let live = true, requested = false;
    const start = () => {
      if (requested) return;
      requested = true;
      queue = queue.catch(() => undefined).then(async () => {
        if (!live) return;
        const hit = cache.get(key);
        let value = hit && Date.now()-hit.at<86400000 ? hit.value : undefined;
        if (!value) {
          const answer = await window.localitfy.getDiscoveries({ artwork: { title, artist } }).catch(() => null);
          if (answer?.status !== "artwork") return;
          value = answer;
          cache.set(key, {at:Date.now(),value});
          const oldest = cache.keys().next().value;
          if (cache.size > 512 && oldest !== undefined) cache.delete(oldest);
        }
        if (live) setResolved({ key, value });
      });
    };
    if (typeof IntersectionObserver === "undefined") { start(); return () => { live = false; }; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); start(); }
    }, { rootMargin: "80px" });
    observer.observe(ref.current);
    return () => { live = false; observer.disconnect(); };
  }, [key, title, artist, lookup, artwork?.coverUrl]);
  return <span ref={ref} className="discoverCover" aria-hidden="true">
    {src ? <img key={src} src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"
      onError={() => setFailed(current => [...current, src])} /> : person ? <UserRound size={24} /> : <Disc3 size={24} />}
  </span>;
}
