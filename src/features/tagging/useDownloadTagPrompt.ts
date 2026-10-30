import { useEffect, useRef, useState } from "react";

type DownloadedItem = { librarySongId?: string; downloadStatus?: string; ok?: boolean };

const importedIds = (lists: readonly (readonly DownloadedItem[] | undefined)[]) => new Set(lists.flatMap((list) => (list || [])
  .filter((item) => item?.librarySongId && item.downloadStatus !== "failed" && item.ok !== false)
  .map((item) => String(item.librarySongId))));

/**
 * Songs that a download batch just added to the library, once the batch is over. Watches the
 * busy flag rather than the Downloads page, so it also fires when you went elsewhere meanwhile.
 */
export function useDownloadTagPrompt(enabled: boolean, busy: boolean, ...lists: (readonly DownloadedItem[] | undefined)[]) {
  const [songIds, setSongIds] = useState<string[]>([]);
  const before = useRef<Set<string> | null>(null);
  const current = importedIds(lists);
  const latest = useRef(current);
  latest.current = current;

  useEffect(() => {
    if (busy) { before.current ??= latest.current; return; }
    const known = before.current;
    before.current = null;
    if (!enabled || !known) return;
    const added = [...latest.current].filter((id) => !known.has(id));
    if (added.length) setSongIds(added);
  }, [busy, enabled]);

  return { songIds, dismiss: () => setSongIds([]) };
}
