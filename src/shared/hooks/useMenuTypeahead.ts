import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";

export function findMenuMatch(labels: readonly string[], current: number, query: string) {
  const start = query.length === 1 ? current + 1 : Math.max(0, current);
  for (let offset = 0; offset < labels.length; offset++) {
    const index = (start + offset) % labels.length;
    if (labels[index].trim().toLocaleLowerCase().startsWith(query.toLocaleLowerCase())) return index;
  }
  return -1;
}

/** Shared type-to-focus behavior for context menus and selection menus. */
export function useMenuTypeahead(open: boolean) {
  const search = useRef({ text: "", at: 0 });
  useEffect(() => { search.current = { text: "", at: 0 }; }, [open]);
  return (event: KeyboardEvent, labels: readonly string[], current: number) => {
    if (event.key.length !== 1 || !event.key.trim() || event.ctrlKey || event.altKey || event.metaKey || event.nativeEvent.isComposing) return -1;
    const now = Date.now();
    const previous = now - search.current.at < 500 ? search.current.text : "";
    const text = previous === event.key ? event.key : previous + event.key;
    search.current = { text, at: now };
    const index = findMenuMatch(labels, current, text);
    if (index >= 0) event.preventDefault();
    return index;
  };
}
