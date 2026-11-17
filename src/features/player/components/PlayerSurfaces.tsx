import { lazy, Suspense, useEffect, useState } from "react";
import type { RefObject } from "react";
import { isAndroidApp } from "../../../app/platform";
import PlayerBar from "./PlayerBar";
import type { PlayerBarProps } from "./PlayerBar";
import QueuePanel from "./QueuePanel";
import type { QueuePanelProps } from "./QueuePanel";
import type { LyricsViewProps } from "../../lyrics/LyricsView";
import ImmersivePlayer from "./ImmersivePlayer";
import "./immersive-player.css";

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

export default function PlayerSurfaces({ player, queue, lyrics, contentRef, backgroundStyle, backgrounded }: Props) {
  const [expanded, setExpanded] = useState(false);
  const android = isAndroidApp();
  const immersive = expanded && Boolean(player.currentSong) && !android;

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
      openImmersive={() => { dismissOverlays(); setExpanded(true); }} />}
    {immersive && player.currentSong ? <ImmersivePlayer player={player} song={player.currentSong}
      queue={queue} lyrics={lyrics} backgroundStyle={backgroundStyle} backgrounded={backgrounded} onClose={closeImmersive} />
      : <>
        <QueuePanel {...queue} />
        {lyrics.open && !android ? <Suspense fallback={null}><LyricsView {...lyrics} anchorRef={contentRef} /></Suspense> : null}
      </>}
  </>;
}
