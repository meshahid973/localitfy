// @ts-nocheck
import { AnimatePresence, motion as Motion } from "motion/react";
import { Surface, SurfaceActions, SurfaceBody, SurfaceHeader } from "../ui/Surface";
import {
  createVerticalDragConstraints,
  physicalDragDefaults,
  updateIslandDragBounds
} from "../motion/physicalDrag";

function clampPercent(value: number) {
  if (!Number.isFinite(Number(value))) return 0;
  return Math.min(100, Math.max(0, Number(value)));
}

function updateTone(status: string) {
  if (status === "downloaded") return "success";
  if (status === "error") return "danger";
  if (status === "downloading" || status === "available") return "accent";
  return "neutral";
}

type UpdateIslandProps = {
  show: boolean;
  updatePrompt: any;
  appVersion: string;
  reducedMotion: boolean;
  yukariUpdateImage: string;
  enterSpring: any;
  childSpring: any;
  titleForPrompt: (prompt: any) => string;
  StatusIcon: (props: { status: string }) => JSX.Element;
  CloseIcon: () => JSX.Element;
  onDownload: () => void;
  onInstall: () => void;
  onCheckAgain: () => void;
  onDismiss: () => void;
};

export default function UpdateIsland({
  show,
  updatePrompt,
  appVersion,
  reducedMotion,
  yukariUpdateImage,
  enterSpring,
  childSpring,
  titleForPrompt,
  StatusIcon,
  CloseIcon,
  onDownload,
  onInstall,
  onCheckAgain,
  onDismiss
}: UpdateIslandProps) {
  const versionLabel = updatePrompt.version || appVersion;
  const progress = clampPercent(updatePrompt.percent);
  const showClose = updatePrompt.status !== "downloading";
  const surfaceTone = updateTone(updatePrompt.status);

  const dragProps = reducedMotion
    ? {}
    : {
        drag: "y",
        dragConstraints: createVerticalDragConstraints(updateIslandDragBounds),
        dragElastic: physicalDragDefaults.dragElastic,
        dragMomentum: physicalDragDefaults.dragMomentum,
        dragSnapToOrigin: true,
        whileDrag: { scale: 0.998 },
        style: { touchAction: "none", cursor: "grab" }
      };

  return (
    <AnimatePresence initial={false}>
      {show ? (
        <Motion.div
          key={`update-ribbon-${updatePrompt.status}-${versionLabel}`}
          className="updateToastLayer topUpdateRibbonLayer"
          role="presentation"
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -18 }}
          animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -16 }}
          transition={reducedMotion ? { duration: 0.12 } : enterSpring}
        >
          <Motion.img
            className={`updateYukariPeek updateYukariPeek-${updatePrompt.status}`}
            src={yukariUpdateImage}
            alt=""
            aria-hidden="true"
            draggable={false}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 118, rotate: 2, scale: 0.985 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, x: 0, rotate: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 96, rotate: 2, scale: 0.985 }}
            transition={reducedMotion ? { duration: 0.12 } : { type: "spring", stiffness: 260, damping: 24, mass: 0.82, delay: 0.08 }}
          />

          <Surface
            as={Motion.section}
            tone={surfaceTone}
            density="compact"
            elevated
            interactive
            className={`updateToastCard topUpdateRibbon ${updatePrompt.status} ${updatePrompt.nagStage ? `updateNagStage-${updatePrompt.nagStage}` : ""}`}
            onClick={(event) => event.stopPropagation()}
            role="status"
            aria-live="polite"
            aria-label="localtify update"
            initial={reducedMotion ? false : { opacity: 0, y: -8, scale: 0.992 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.995 }}
            transition={reducedMotion ? { duration: 0.12 } : enterSpring}
            {...dragProps}
          >
            <SurfaceHeader
              as={Motion.div}
              density="compact"
              className="topUpdateRibbonMain"
              initial={reducedMotion ? false : { opacity: 0, y: 6 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={reducedMotion ? { duration: 0.1 } : { ...childSpring, delay: 0.04 }}
            >
              <div className="updateToastIcon topUpdateRibbonIcon" aria-hidden="true">
                <StatusIcon status={updatePrompt.status} />
              </div>

              <SurfaceBody className="updateToastText topUpdateRibbonText" density="compact">
                <p className="eyebrow">localtify</p>
                <h3>{titleForPrompt(updatePrompt)}</h3>
              </SurfaceBody>
            </SurfaceHeader>

            <Motion.div
              className="topUpdateRibbonRight"
              initial={reducedMotion ? false : { opacity: 0, y: 6 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={reducedMotion ? { duration: 0.1 } : { ...childSpring, delay: 0.12 }}
            >
              <Motion.div
                className="updateToastMetaRow topUpdateRibbonMeta"
                aria-label="update info"
                initial={reducedMotion ? false : { opacity: 0, x: 6 }}
                animate={reducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 4 }}
                transition={reducedMotion ? { duration: 0.1 } : { ...childSpring, delay: 0.14 }}
              >
                <span className="updateVersionPill">version {versionLabel}</span>
              </Motion.div>

              <SurfaceActions
                as={Motion.div}
                density="compact"
                className="updateToastActions topUpdateRibbonActions"
                initial={reducedMotion ? false : { opacity: 0, x: 8 }}
                animate={reducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 5 }}
                transition={reducedMotion ? { duration: 0.1 } : { ...childSpring, delay: 0.18 }}
              >

                {updatePrompt.status === "available" ? (
                  <button className="updatePrimaryButton" type="button" onClick={onDownload}>
                    download update
                  </button>
                ) : null}

                {updatePrompt.status === "downloaded" ? (
                  <button className="updatePrimaryButton" type="button" onClick={onInstall}>
                    restart
                  </button>
                ) : null}

                {updatePrompt.status === "error" || updatePrompt.status === "latest" || updatePrompt.status === "dev" ? (
                  <button className="updatePrimaryButton" type="button" onClick={onCheckAgain}>
                    check again
                  </button>
                ) : null}

                {showClose ? (
                  <button className="updateToastClose" type="button" onClick={onDismiss} aria-label="Dismiss update notice">
                    <CloseIcon />
                  </button>
                ) : null}
              </SurfaceActions>
            </Motion.div>

            {updatePrompt.status === "downloading" ? (
              <Motion.div
                className="updateProgressTrack topUpdateRibbonProgress"
                aria-label="update progress"
                initial={reducedMotion ? false : { opacity: 0, scaleX: 0.94 }}
                animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scaleX: 1 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scaleX: 0.96 }}
                transition={reducedMotion ? { duration: 0.1 } : { ...childSpring, delay: 0.2 }}
              >
                <span style={{ width: `${progress}%` }} />
              </Motion.div>
            ) : null}
          </Surface>
        </Motion.div>
      ) : null}
    </AnimatePresence>
  );
}
