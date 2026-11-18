import { useEffect, useState } from "react";
import type { DailyMixesResult } from "../analysis/analysis.types";

// The last result is shown straight away when Home reopens, then replaced by a fresh answer
// (which also picks up a "Refresh mixes" from Playlists).
let lastMixes: DailyMixesResult | null = null;

/** Today's daily mixes for the Home shelf. `result` stays `null` until the first answer arrives. */
export function useHomeDailyMixes(day: string) {
  const [result, setResult] = useState<DailyMixesResult | null>(() => (lastMixes?.day === day ? lastMixes : null));
  const [failedDay, setFailedDay] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    window.localitfy.getDailyMixes({ refresh: false })
      .then((next) => {
        if (active) { lastMixes = next; setResult(next); setFailedDay(null); }
      })
      .catch(() => {
        if (active) setFailedDay(day);
      });
    return () => { active = false; };
  }, [day]);

  return { result: result?.day === day ? result : null, failed: failedDay === day };
}
