import { lazy, memo, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { isAndroidApp } from "../../../app/platform";
import PlayerBar from "./PlayerBar";
import type { PlayerBarProps } from "./PlayerBar";
import QueuePanel from "./QueuePanel";
import type { QueuePanelProps } from "./QueuePanel";
import type { LyricsViewProps } from "../../lyrics/LyricsView";
import "./immersive-player.css";

const ImmersivePlayer = lazy(() => import("./ImmersivePlayer"));
const PhonePlayer = lazy(() => import("./PhonePlayer"));
const LyricsView = lazy(() => import("../../lyrics/LyricsView"));

type Props = {
  player: PlayerBarProps;
  queue: QueuePanelProps;
  lyrics: Omit<LyricsViewProps, "anchorRef">;
  contentRef: RefObject<HTMLElement | null>;
  backgroundStyle: string;
  backgrounded: boolean;
};

function PlayerSurfaces({ player, queue, lyrics, contentRef, backgroundStyle, backgrounded }: Props) {
  const [expanded, setExpanded] = useState(false);
  const restoreFocus = useRef(false);
  const android = isAndroidApp();
  const immersive = expanded && Boolean(player.currentSong) && !android;

  useLayoutEffect(() => {
    if (immersive || !restoreFocus.current) return;
    restoreFocus.current = false;
    document.querySelector<HTMLButtonElement>(".immersiveEntry")?.focus({ preventScroll: true });
  }, [immersive]);

  function dismissOverlays() {
    if (queue.open) queue.onClose();
    if (lyrics.open) lyrics.onClose();
  }

  function closeImmersive() {
    dismissOverlays();
    setExpanded(false);
  }

  useEffect(() => {
    if (expanded && !player.currentSong) {
      if (queue.open) queue.onClose();
      if (lyrics.open) lyrics.onClose();
      setExpanded(false);
    }
  }, [expanded, player.currentSong, queue, lyrics]);

  return <>
    {android ? <Suspense fallback={null}>
      <PhonePlayer {...player} lyrics={lyrics} backgroundStyle={backgroundStyle} backgrounded={backgrounded} />
    </Suspense> : <PlayerBar {...player} immersiveOpen={immersive}
      openImmersive={() => { dismissOverlays(); restoreFocus.current = true; setExpanded(true); }} />}
    {immersive && player.currentSong ? <Suspense fallback={<button type="button" className="immersiveLoading" onClick={closeImmersive} onKeyDown={event => { if (event.key === "Escape") closeImmersive(); }}>Loading player… Cancel</button>}>
      <ImmersivePlayer player={player} song={player.currentSong}
        queue={queue} lyrics={lyrics} backgroundStyle={backgroundStyle} backgrounded={backgrounded} onClose={closeImmersive} />
    </Suspense>
      : <>
        <QueuePanel {...queue} />
        {lyrics.open && !android ? <Suspense fallback={null}><LyricsView {...lyrics} anchorRef={contentRef} /></Suspense> : null}
      </>}
  </>;
}

// Compare actual values, not render-created contract object identities. The
// caller stabilizes local callbacks; remote callbacks remain reactive.
function shallowEqual(a: object, b: object) {
  if (Object.is(a, b)) return true;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key =>
    Object.prototype.hasOwnProperty.call(b, key) && Object.is(
      (a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}
export default memo(PlayerSurfaces, (previous, next) =>
  previous.contentRef === next.contentRef &&
  previous.backgroundStyle === next.backgroundStyle &&
  previous.backgrounded === next.backgrounded &&
  shallowEqual(previous.player, next.player) &&
  shallowEqual(previous.queue, next.queue) &&
  shallowEqual(previous.lyrics, next.lyrics)
);
