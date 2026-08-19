import { useCallback, useEffect, useRef, useState } from "react";
import type { AppToastKind } from "./view.types";
import { cleanToastCopy } from "./toast.utils";

export type AppToastState = {
  id: number;
  message: string;
  kind: AppToastKind;
} | null;

export function useAppToast() {
  const [appToast, setAppToast] = useState<AppToastState>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showAppToast = useCallback((message: string, kind: AppToastKind = "info") => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }

    setAppToast({ id: Date.now(), message: cleanToastCopy(message, kind), kind });

    toastTimerRef.current = window.setTimeout(() => {
      setAppToast(null);
      toastTimerRef.current = null;
    }, kind === "work" ? 1900 : 2600);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  return { appToast, setAppToast, showAppToast };
}
