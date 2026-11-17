import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Song } from "../library/song.types";
import { Cover } from "./Cover";
import { getSongAmbientSource } from "./cover.ambient";
import "./artwork-backdrop.css";

export const ArtworkAmbientContext = createContext(true);
const FADE_MS = 360;
type Layer = { key: string; song: Song };

function CrossfadeArtwork({ song }: { song: Song }) {
  const key = getSongAmbientSource(song) || song.id;
  const [displayed, setDisplayed] = useState<Layer | null>(null);
  const [outgoing, setOutgoing] = useState<Layer | null>(null);
  const pending = displayed?.key !== key;
  const incomingRef = useRef<HTMLDivElement>(null);

  // Keep the last decoded cover until the next one loads. Never retain
  // more than two mounted images, even during rapid track changes.
  useEffect(() => {
    if (!outgoing) return;
    const timer = window.setTimeout(() => setOutgoing(null), FADE_MS + 40);
    return () => window.clearTimeout(timer);
  }, [outgoing]);

  useEffect(() => {
    if (!pending) return;
    const incoming = incomingRef.current?.querySelector("img");
    // A → B → A may reuse the already-loaded outgoing element.
    const delay = incoming?.complete && incoming.naturalWidth > 0 ? 0 : 2000;
    const timer = window.setTimeout(() => {
      setOutgoing(displayed);
      setDisplayed({ key, song });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [key, pending, displayed, song]);

  function reveal() {
    if (!pending) return;
    setOutgoing(displayed);
    setDisplayed({ key, song });
  }

  const layers = pending ? [displayed, { key, song }] : [outgoing, displayed];
  return (
    <div className="artworkBackdrop" aria-hidden="true">
      {layers.map((layer) => layer ? (
        <div key={layer.key} className="artworkBackdropLayer"
          data-visible={layer.key !== key || !pending ? "true" : "false"}
          ref={layer.key === key ? incomingRef : undefined}
          onLoadCapture={layer.key === key ? reveal : undefined}>
          <Cover song={layer.song} className="artworkBackdropCover" priority="high" preferThumbnail />
        </div>
      ) : null)}
    </div>
  );
}

export function ArtworkBackdrop({ song }: { song: Song | null }) {
  const enabled = useContext(ArtworkAmbientContext);
  if (!song || !enabled) return null;
  return <CrossfadeArtwork song={song} />;
}
