import { AnimatePresence, motion as Motion } from "motion/react";
import "./screensaver.css";

type Props = { screensaverVisible: boolean; screensaverVisualSource: string; reducedMotion: boolean;
  dismissScreensaverFromActivity: () => unknown; setScreensaverVisible: (visible: boolean) => void };
export default function ScreensaverOverlay({screensaverVisible, screensaverVisualSource, reducedMotion, dismissScreensaverFromActivity, setScreensaverVisible}: Props) {
  return (
      <AnimatePresence>
        {screensaverVisible ? (
          <Motion.div
            className="screensaverOverlay"
            role="presentation"
            onPointerMove={dismissScreensaverFromActivity}
            onClick={() => setScreensaverVisible(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.12 : 0.45, ease: "easeOut" }}
          >
            <div className="screensaverBackdrop" style={{ backgroundImage: `url(${screensaverVisualSource})` }} />
            <div className="screensaverGlow" />
            <Motion.div
              className="screensaverPanel"
              initial={reducedMotion ? false : { opacity: 0, y: 18, scale: 0.982 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.99 }}
              transition={reducedMotion ? { duration: 0.12 } : { type: "spring", stiffness: 130, damping: 20, mass: 0.8 }}
              style={{ backgroundImage: `url(${screensaverVisualSource})` }}
            >
              <div className="screensaverShade" />
              <div className="screensaverIdleText">am waiting..</div>
            </Motion.div>
          </Motion.div>
        ) : null}
      </AnimatePresence>
  );
}
