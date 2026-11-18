import { createContext, useContext, useEffect, useState } from "react";
import type { Song } from "../library/song.types";
import { decodeArtwork, getSongAmbientSource } from "./cover.ambient";
import { advanceArtworkFrame, type ArtworkFrame } from "./artworkPalette";
import "./artwork-backdrop.css";

export const ArtworkAmbientContext = createContext(true);
const FADE_MS = 360;

function CrossfadeArtwork({ source, fallbacks = [], workspace = false }: { source: string; fallbacks?: readonly string[]; workspace?: boolean }) {
  const fallbackKey = JSON.stringify(fallbacks);
  const [frame, setFrame] = useState<ArtworkFrame>({ current: "", previous: "" });
  useEffect(() => {
    if (!source) { setFrame({ current: "", previous: "" }); return; }
    const controller = new AbortController();
    async function load() {
      for (const candidate of [source, ...JSON.parse(fallbackKey) as string[]]) {
        if (controller.signal.aborted) return;
        const ready = await decodeArtwork(candidate, controller.signal);
        if (controller.signal.aborted) return;
        if (ready === true) {
          setFrame(old => advanceArtworkFrame(old, candidate, true));
          return;
        }
      }
      if (!controller.signal.aborted) setFrame(old => advanceArtworkFrame(old, "", false));
    }
    void load();
    return () => controller.abort();
  }, [source, fallbackKey]);

  useEffect(() => {
    if (!frame.previous) return;
    const timer = window.setTimeout(() => {
      setFrame(old => old === frame ? { current: old.current, previous: "" } : old);
    }, FADE_MS + 40);
    return () => window.clearTimeout(timer);
  }, [frame]);

  return <div className={workspace ? "artworkBackdrop workspaceArtworkBackdrop" : "artworkBackdrop"} aria-hidden="true">
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

/** One decorative image stack for the whole shell, independent of the immersive player. */
export function WorkspaceArtworkBackdrop({ sources }: { sources: readonly string[] }) {
  return sources.length ? <CrossfadeArtwork source={sources[0]} fallbacks={sources.slice(1)} workspace /> : null;
}
