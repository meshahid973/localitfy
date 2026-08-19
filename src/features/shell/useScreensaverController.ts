import { useRef, useState } from "react";

export function useScreensaverController() {
  const [now, setNow] = useState(new Date());
  const [screensaverVisible, setScreensaverVisible] = useState(false);
  const [screensaverPreviewActive, setScreensaverPreviewActive] = useState(false);
  const screensaverTimerRef = useRef<number | null>(null);
  const screensaverPreviewTimerRef = useRef<number | null>(null);
  const screensaverIgnoreActivityUntilRef = useRef(0);

  return {
    now, setNow,
    screensaverVisible, setScreensaverVisible,
    screensaverPreviewActive, setScreensaverPreviewActive,
    screensaverTimerRef,
    screensaverPreviewTimerRef,
    screensaverIgnoreActivityUntilRef
  };
}
