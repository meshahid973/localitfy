import { useCallback, useLayoutEffect, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { VirtualizerOptions } from "@tanstack/react-virtual";

type PageVirtualizerOptions = Omit<VirtualizerOptions<HTMLElement, Element>, "getScrollElement" | "scrollMargin" | "observeElementRect" | "observeElementOffset" | "scrollToFn">;

/** The page's one scroll area. Long lists scroll with the page instead of inside a box of their own. */
export const pageScroller = (element: Element | null) => element?.closest<HTMLElement>(".content") ?? null;

/**
 * A virtualizer for a list that is part of the page. `listRef` (a callback ref) goes on the list element; rows are placed at
 * `start - scrollMargin`, since the virtualizer counts from the top of the page's scroll area.
 */
export function usePageVirtualizer<ListElement extends HTMLElement>(options: Partial<PageVirtualizerOptions> & Pick<PageVirtualizerOptions, "count" | "estimateSize">) {
  const [list, listRef] = useState<ListElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const getScrollElement = useCallback(() => pageScroller(list), [list]);

  // Where the list starts on the page moves whenever anything above it changes size.
  useLayoutEffect(() => {
    const page = pageScroller(list);
    if (!list || !page) return;
    const measure = () => {
      const offset = list.getBoundingClientRect().top - page.getBoundingClientRect().top + page.scrollTop;
      setScrollMargin((previous) => (Math.abs(previous - offset) < 1 ? previous : offset));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(page);
    for (const child of Array.from(page.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [list]);

  const virtualizer = useVirtualizer<HTMLElement, Element>({ ...options, getScrollElement, scrollMargin });
  return { listRef, virtualizer, scrollMargin };
}
