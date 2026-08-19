import { motion as Motion } from "motion/react";
import type { ReactNode } from "react";

const LOCALTFY_PLAYER_MORPH_PAUSE = {
  left: "M5 5L9 5L9 19L5 19Z",
  right: "M15 5L19 5L19 19L15 19Z"
} as const;

const LOCALTFY_PLAYER_MORPH_PLAY = {
  left: "M7 5L13 8.5L13 15.5L7 19Z",
  right: "M13 8.5L19 12L19 12L13 15.5Z"
} as const;

const LOCALTFY_PLAYER_MORPH_SPRING = {
  type: "spring",
  stiffness: 260,
  damping: 26,
  mass: 0.9
} as const;

export function PlayerPlayPauseMorphIcon({ playing, className = "" }: { playing: boolean; className?: string }) {
  const target = playing ? LOCALTFY_PLAYER_MORPH_PAUSE : LOCALTFY_PLAYER_MORPH_PLAY;

  return (
    <svg
      className={`playerMorphIcon ${className}`.trim()}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <Motion.path
        animate={{ d: target.left }}
        transition={LOCALTFY_PLAYER_MORPH_SPRING}
        initial={false}
      />
      <Motion.path
        animate={{ d: target.right }}
        transition={LOCALTFY_PLAYER_MORPH_SPRING}
        initial={false}
      />
    </svg>
  );
}

const MASCOT_STATE_IMAGE_SRC = {
  empty: new URL("../../assets/empty-state.png", import.meta.url).href,
  happy: new URL("../../assets/happy-state.png", import.meta.url).href,
  question: new URL("../../assets/question-state.png", import.meta.url).href,
  info: new URL("../../assets/info-state.png", import.meta.url).href,
  warning: new URL("../../assets/warning-state.png", import.meta.url).href,
  danger: new URL("../../assets/danger-state.png", import.meta.url).href,
  error: new URL("../../assets/error-state.png", import.meta.url).href,
  loading: new URL("../../assets/loading-state.png", import.meta.url).href,
  confused: new URL("../../assets/question-state.png", import.meta.url).href,
  neutral: new URL("../../assets/empty-state.png", import.meta.url).href
} as const;
export type MascotStateKey = keyof typeof MASCOT_STATE_IMAGE_SRC;

export function MascotStateArt({
  state = "neutral",
  className = ""
}: {
  state?: MascotStateKey;
  className?: string;
}) {
  const src = MASCOT_STATE_IMAGE_SRC[state] || MASCOT_STATE_IMAGE_SRC.neutral;
  return (
    <img
      className={`mascotStateArtV496 mascotState-${state} ${className}`.trim()}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      aria-hidden="true"
    />
  );
}

export function mascotStateForToast(kind?: string): MascotStateKey {
  if (kind === "success") return "happy";
  if (kind === "error") return "error";
  if (kind === "work") return "loading";
  return "info";
}


export function WindowMinimizeIcon() {
  return (
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" focusable="false">
      <path d="M2.25 6.25h7.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function WindowMaximizeIcon() {
  return (
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" focusable="false">
      <rect x="2.2" y="2.2" width="7.6" height="7.6" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.45" />
    </svg>
  );
}

export function WindowCloseIcon() {
  return (
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" focusable="false">
      <path d="M3 3l6 6M9 3L3 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function PlayingBarsIcon() {
  return (
    <svg className="inlineGlyphIcon playingBarsIcon" aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" focusable="false">
      <rect x="2.2" y="5.4" width="2" height="5.6" rx="1" fill="currentColor" />
      <rect x="6" y="2.4" width="2" height="8.6" rx="1" fill="currentColor" />
      <rect x="9.8" y="4" width="2" height="7" rx="1" fill="currentColor" />
    </svg>
  );
}

export function EmptyCoverIcon() {
  return (
    <svg className="inlineGlyphIcon emptyCoverIcon" aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" focusable="false">
      <path d="M4.2 13.2V5.7c0-.92.67-1.7 1.58-1.84l6.6-1.02c.76-.12 1.45.47 1.45 1.24v7.42" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="13" r="2" fill="none" stroke="currentColor" strokeWidth="1.55" />
      <circle cx="12.8" cy="11.6" r="2" fill="none" stroke="currentColor" strokeWidth="1.55" />
    </svg>
  );
}

export function CheckMiniIcon() {
  return (
    <svg className="inlineGlyphIcon checkMiniIcon" aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" focusable="false">
      <path d="M3 7.2l2.55 2.45L11.2 4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PlusMiniIcon() {
  return (
    <svg className="inlineGlyphIcon plusMiniIcon" aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" focusable="false">
      <path d="M7 2.8v8.4M2.8 7h8.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function AlertMiniIcon() {
  return (
    <svg className="inlineGlyphIcon alertMiniIcon" aria-hidden="true" width="15" height="15" viewBox="0 0 15 15" focusable="false">
      <path d="M7.5 2.2l5.35 9.55H2.15L7.5 2.2z" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      <path d="M7.5 5.65v2.55M7.5 10.65h.01" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function InfoMiniIcon() {
  return (
    <svg className="inlineGlyphIcon infoMiniIcon" aria-hidden="true" width="15" height="15" viewBox="0 0 15 15" focusable="false">
      <circle cx="7.5" cy="7.5" r="5.7" fill="none" stroke="currentColor" strokeWidth="1.45" />
      <path d="M7.5 6.7v3.45M7.5 4.7h.01" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
    </svg>
  );
}

export function SuccessMiniIcon() {
  return <CheckMiniIcon />;
}

export function LocaltifyStateToneIcon({ tone }: { tone: string }) {
  if (tone === "error" || tone === "warning") return <AlertMiniIcon />;
  if (tone === "success") return <SuccessMiniIcon />;
  return <InfoMiniIcon />;
}

export function UpdateStatusIcon({ status }: { status: string }) {
  if (status === "error") return <AlertMiniIcon />;
  if (status === "downloaded") return <CheckMiniIcon />;
  return (
    <svg className="inlineGlyphIcon updateMiniIcon" aria-hidden="true" width="15" height="15" viewBox="0 0 15 15" focusable="false">
      <path d="M7.5 2.2v7.1M4.9 6.8l2.6 2.6 2.6-2.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.4 12.2h8.2" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
    </svg>
  );
}

export function ResultStatusIcon({ failed, imported }: { failed: boolean; imported: boolean }) {
  if (failed) return <AlertMiniIcon />;
  if (imported) return <CheckMiniIcon />;
  return <InfoMiniIcon />;
}


export function MetaDividerDot() {
  return <span className="metaDividerDot" aria-hidden="true" />;
}

export type LocaltifyStateCardTone = "info" | "warning" | "error" | "success";

function mascotStateForTone(tone: LocaltifyStateCardTone, cute = false): MascotStateKey {
  if (tone === "success") return "happy";
  if (tone === "warning") return "warning";
  if (tone === "error") return "error";
  return cute ? "empty" : "info";
}


export function LocaltifyStateCard({
  tone = "info",
  eyebrow,
  title,
  message,
  detail,
  actions,
  centered = false,
  cute = false,
  mascotState
}: {
  tone?: LocaltifyStateCardTone;
  eyebrow: string;
  title: string;
  message: string;
  detail?: string;
  actions?: ReactNode;
  centered?: boolean;
  cute?: boolean;
  badge?: string;
  mascotState?: MascotStateKey;
}) {
  const resolvedMascotState = mascotState || mascotStateForTone(tone, cute);
  return (
    <div className={`localtifyStateCardV373 ${tone}${centered ? " localtifyStateCardCenteredV466" : ""}${cute ? " localtifyStateCardCuteV466" : ""}`}>
      {cute ? (
        <>
          <div className="localtifyEmptyArtV466" aria-hidden="true">
            <span className="localtifyEmptyImageShellV466">
              <MascotStateArt state={resolvedMascotState} className="localtifyEmptyMascotV496" />
            </span>
          </div>
          <p className="localtifyEmptyCaptionV467">my team couldn't find anything here!!</p>
          {actions ? <div className="localtifyStateActionsV373 localtifyEmptyActionsV467">{actions}</div> : null}
        </>
      ) : (
        <>
          <span className="localtifyStateIconV373" aria-hidden="true">
            <LocaltifyStateToneIcon tone={tone} />
          </span>

          <div className="localtifyStateCopyV373">
            <p className="eyebrow">{eyebrow}</p>
            <strong>{title}</strong>
            <span>{message}</span>
            {detail ? <small>{detail}</small> : null}
            {actions ? <div className="localtifyStateActionsV373">{actions}</div> : null}
          </div>
        </>
      )}
    </div>
  );
}


export function MascotHelperBubble({
  state = "info",
  tone = "info",
  eyebrow,
  title,
  message,
  actions,
  hideMascot = false,
  className = ""
}: {
  state?: MascotStateKey;
  tone?: LocaltifyStateCardTone;
  eyebrow?: string;
  title: string;
  message: string;
  actions?: ReactNode;
  hideMascot?: boolean;
  className?: string;
}) {
  return (
    <aside className={`mascotHelperBubbleV501 mascotHelper-${state} ${tone} ${hideMascot ? "noMascotV511" : ""} ${className}`.trim()} role="status">
      {!hideMascot ? <MascotStateArt state={state} className="mascotHelperArtV501" /> : null}
      <div className="mascotHelperCopyV501">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <strong>{title}</strong>
        <span>{message}</span>
      </div>
      {actions ? <div className="mascotHelperActionsV501">{actions}</div> : null}
    </aside>
  );
}
