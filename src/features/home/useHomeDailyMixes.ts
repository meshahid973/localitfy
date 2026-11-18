import { useEffect, useState } from "react";
import type { DailyMixesResult } from "../analysis/analysis.types";

// The last result is shown straight away when Home reopens, then replaced by a fresh answer
// (which also picks up a "Refresh mixes" from Playlists).
let lastMixes: DailyMixesResult | null = null;

/** Today's daily mixes for the Home shelf. `result` stays `null` until the first answer arrives. */
export function useHomeDailyMixes(day: string) {
  const [answer, setAnswer] = useState<{ requestedDay: string; result: DailyMixesResult } | null>(() => (lastMixes?.day === day ? { requestedDay: day, result: lastMixes } : null));
  const [failedDay, setFailedDay] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    window.localitfy.getDailyMixes({ refresh: false })
      .then((next) => {
        if (active) { lastMixes = next; setAnswer({ requestedDay: day, result: next }); setFailedDay(null); }
      })
      .catch(() => {
        if (active) setFailedDay(day);
      });
    return () => { active = false; };
  }, [day]);

  // Android may intentionally return a kept offline mix or an empty fallback.
  return { result: answer?.requestedDay === day ? answer.result : null, failed: failedDay === day };
}
