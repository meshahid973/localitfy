import type { CSSProperties } from "react";
import type { ImportAnimationState } from "./song.types";
import { Cover } from "../covers/Cover";
import { MascotStateArt } from "../../shared/ui/LocaltifyViewUi";
import { prettyTitle } from "../search";

export function ImportProgress({ state }: { state: ImportAnimationState }) {
  if (!state.active) return null;
  return (
    <div className={`importOverlay importPhase-${state.phase}`} role="status" aria-live="polite">
      <div className="importPanel">
        <div className="importScanStage" aria-hidden="true">
          <span className="importScannerLine" />
          <span className="importScannerGlow" />
          <span className="importScannerOrb" />
        </div>

        <div className="importPanelHead importPanelHeadMascotV496">
          <MascotStateArt
            state={state.phase === "success" ? "happy" : state.phase === "error" ? "error" : "loading"}
            className="importMascotV496"
          />
          <h3>{state.phase === "picking" ? "Choose music to import" : state.phase === "error" ? "Import interrupted" : state.phase === "success" ? "Import complete" : "Scanning your music"}</h3>
          <span>{state.message}</span>
        </div>

        <div className="importCounter">
          <strong>{state.count}</strong>
          <span>{state.count === 1 ? "song found" : "songs found"}</span>
        </div>

        <div className="importCoverGrid">
          {(state.preview.length ? state.preview : Array.from({ length: 10 }, () => null)).map((song, index) => (
            <div
              className={song ? "importCoverTile" : "importCoverTile importCoverPlaceholder"}
              key={song ? `${song.id}-${index}` : `import-placeholder-${index}`}
              style={{ "--tile-delay": `${index * 42}ms` } as CSSProperties}
            >
              {song ? <Cover song={song} className="importCoverArt" /> : <span className="importCoverSkeleton" />}
              <small>{song ? prettyTitle(song.title, 4) : "scanning..."}</small>
            </div>
          ))}
        </div>

        <div className="importLogList" aria-hidden="true">
          {(state.preview.length
            ? state.preview.slice(0, 5).map((song) => prettyTitle(song.title, 5))
            : ["opening file picker", "reading audio tags", "matching cover art", "building search index", "saving library order"]
          ).map((line, index) => (
            <span key={`${line}-${index}`} style={{ "--log-delay": `${index * 70}ms` } as CSSProperties}>
              {line}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
