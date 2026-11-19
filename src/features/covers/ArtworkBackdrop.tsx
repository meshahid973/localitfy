import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Song } from "../library/song.types";
import { getSongAmbientSource } from "./cover.ambient";
import { prepareBackdropArtwork } from "./backdropRaster";
import { advanceArtworkFrame, type ArtworkFrame } from "./artworkPalette";
import "./artwork-backdrop.css";

export const ArtworkAmbientContext = createContext(true);
const FADE_MS = 420;

function CrossfadeArtwork({ source, fallbacks = [], workspace = false }: { source: string; fallbacks?: readonly string[]; workspace?: boolean }) {
  const fallbackKey = JSON.stringify(fallbacks);
  const loadedSource = useRef("");
  const [frame, setFrame] = useState<ArtworkFrame>({ current: "", previous: "" });
  useEffect(() => {
    if (!source) { loadedSource.current = ""; setFrame(old => old.current ? { current: "", previous: old.current } : old); return; }
    // Changes to fallback entities do not reload successfully decoded primary art.
    if (loadedSource.current === source) return;
    const controller = new AbortController();
    async function load() {
      for (const candidate of [source, ...JSON.parse(fallbackKey) as string[]]) {
        if (controller.signal.aborted) return;
        const prepared = await prepareBackdropArtwork(candidate, controller.signal);
        if (controller.signal.aborted) return;
        if (prepared) {
          loadedSource.current = candidate;
          setFrame(old => advanceArtworkFrame(old, prepared, true));
          return;
        }
      }
      if (!controller.signal.aborted) {
        loadedSource.current = "";
        setFrame(old => old.current ? { current: "", previous: old.current } : old);
      }
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
      <div key={src} className="artworkBackdropLayer" data-visible={src === frame.current ? "true" : "false"} data-hold={src === frame.previous && Boolean(frame.current)} data-raster={src.startsWith("data:image/png;")}>
        <div className="artworkBackdropCover">
          <img className="coverImage isLoaded" src={src} alt="" draggable={false} decoding="async" referrerPolicy="no-referrer"
            onError={() => { if (src === frame.current) loadedSource.current = ""; setFrame(old => old.current === src ? { current: old.previous, previous: "" } : old.previous === src ? { ...old, previous: "" } : old); }} />
        </div>
      </div>
    ))}
  </div>;
}

export function ArtworkBackdrop({ song }: { song: Song | null }) {
  const enabled = useContext(ArtworkAmbientContext);
  const source = getSongAmbientSource(song);
  return enabled ? <CrossfadeArtwork source={source} /> : null;
}

/** One decorative image stack for the whole shell, independent of the immersive player. */
export function WorkspaceArtworkBackdrop({ sources }: { sources: readonly string[] }) {
  return <CrossfadeArtwork source={sources[0] || ""} fallbacks={sources.slice(1)} workspace />;
}
