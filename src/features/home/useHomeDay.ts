import { useEffect, useState } from "react";
import { localDayKey } from "./homeShelfPicks";

/** Invalidate calendar-dependent shelves at local midnight, including after sleep. */
export function useHomeDay() {
  const [day, setDay] = useState(() => localDayKey(new Date()));
  useEffect(() => {
    let timer = 0;
    const refresh = () => {
      window.clearTimeout(timer);
      const now = new Date();
      setDay(localDayKey(now));
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = window.setTimeout(refresh, Math.max(1, next.getTime() - now.getTime() + 50));
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return day;
}
