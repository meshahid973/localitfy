/** Offline notes for released versions are copied verbatim from the matching verified GitHub releases. */
import installedNotes from "../../../.github/release-notes.md?raw";
import notes_v0_5_0 from "./releases/v0.5.0.md?raw";
import notes_v0_4_1 from "./releases/v0.4.1.md?raw";
import notes_v0_4_0 from "./releases/v0.4.0.md?raw";
import notes_v0_3_9 from "./releases/v0.3.9.md?raw";
import notes_v0_3_8 from "./releases/v0.3.8.md?raw";
import notes_v0_3_7 from "./releases/v0.3.7.md?raw";
import notes_v0_3_6 from "./releases/v0.3.6.md?raw";
import notes_v0_3_5 from "./releases/v0.3.5.md?raw";
import notes_v0_3_4 from "./releases/v0.3.4.md?raw";
import notes_v0_3_3 from "./releases/v0.3.3.md?raw";

export type ReleaseEntry = { version: string; date: string | null; notes: string; published: boolean; sourceUrl?: string };
export const releaseHistory: readonly ReleaseEntry[] = [
  { version: "0.5.1", date: null, notes: installedNotes, published: false },
  { version: "0.5.0", date: "2026-11-13", notes: notes_v0_5_0, published: true, sourceUrl: "https://github.com/meshahid973/localtify/releases/tag/v0.5.0" },
  { version: "0.4.1", date: "2026-06-16", notes: notes_v0_4_1, published: true, sourceUrl: "https://github.com/meshahid973/localtify/releases/tag/v0.4.1" },
  { version: "0.4.0", date: "2026-06-15", notes: notes_v0_4_0, published: true, sourceUrl: "https://github.com/meshahid973/localtify/releases/tag/v0.4.0" },
  { version: "0.3.9", date: "2026-06-11", notes: notes_v0_3_9, published: true, sourceUrl: "https://github.com/meshahid973/localtify/releases/tag/v0.3.9" },
  { version: "0.3.8", date: "2026-06-10", notes: notes_v0_3_8, published: true, sourceUrl: "https://github.com/meshahid973/localtify/releases/tag/v0.3.8" },
  { version: "0.3.7", date: "2026-06-06", notes: notes_v0_3_7, published: true, sourceUrl: "https://github.com/meshahid973/localtify/releases/tag/v0.3.7" },
  { version: "0.3.6", date: "2026-06-04", notes: notes_v0_3_6, published: true, sourceUrl: "https://github.com/meshahid973/localtify/releases/tag/v0.3.6" },
  { version: "0.3.5", date: "2026-06-02", notes: notes_v0_3_5, published: true, sourceUrl: "https://github.com/meshahid973/localtify/releases/tag/v0.3.5" },
  { version: "0.3.4", date: "2026-05-24", notes: notes_v0_3_4, published: true, sourceUrl: "https://github.com/meshahid973/localtify/releases/tag/v0.3.4" },
  { version: "0.3.3", date: "2026-05-23", notes: notes_v0_3_3, published: true, sourceUrl: "https://github.com/meshahid973/localtify/releases/tag/v0.3.3" },
];
export function findRelease(version: string) {
  return releaseHistory.find(item => item.version === String(version).replace(/^v/i,""));
}
