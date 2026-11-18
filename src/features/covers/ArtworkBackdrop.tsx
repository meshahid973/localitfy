import { createContext, useContext, useEffect, useState } from "react";
import type { Song } from "../library/song.types";
import { decodeArtwork, getSongAmbientSource } from "./cover.ambient";
import "./artwork-backdrop.css";

export const ArtworkAmbientContext = createContext(true);
const FADE_MS = 360;
type Frame = { current: string; previous: string };

function CrossfadeArtwork({ source }: { source: string }) {
  const [frame, setFrame] = useState<Frame>({ current: "", previous: "" });
  useEffect(() => {
    if (!source) { setFrame({ current: "", previous: "" }); return; }
    const controller = new AbortController();
    void decodeArtwork(source, controller.signal).then(ready => {
      if (controller.signal.aborted) return;
      setFrame(old => !ready ? { current: "", previous: "" } :
        old.current === source ? old : { current: source, previous: old.current });
    });
    return () => controller.abort();
  }, [source]);

  useEffect(() => {
    if (!frame.previous) return;
    const timer = window.setTimeout(() => {
      setFrame(old => old === frame ? { current: old.current, previous: "" } : old);
    }, FADE_MS + 40);
    return () => window.clearTimeout(timer);
  }, [frame]);

  return <div className="artworkBackdrop" aria-hidden="true">
    {[frame.previous, frame.current].filter(Boolean).map(src => (
      <div key={src} className="artworkBackdropLayer" data-visible={src === frame.current ? "true" : "false"}>
        <div className="artworkBackdropCover">
          <img className="coverImage isLoaded" src={src} alt="" draggable={false} decoding="async" referrerPolicy="no-referrer"
            onError={() => setFrame(old => old.current === src ? { current: "", previous: "" } : old.previous === src ? { ...old, previous: "" } : old)} />
        </div>
      </div>
    ))}
  </div>;
}

export function ArtworkBackdrop({ song }: { song: Song | null }) {
  const enabled = useContext(ArtworkAmbientContext);
  const source = getSongAmbientSource(song);
  return enabled && source ? <CrossfadeArtwork source={source} /> : null;
}
