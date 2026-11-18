import type { CollectionContextMenuState } from "../library/components/CollectionContextMenu";

/** One shell-local menu owner. Only the overlay subscribes to menu changes. */
export function createCollectionMenuStore() {
  let state: CollectionContextMenuState | null = null;
  const listeners = new Set<() => void>();
  const getSnapshot = () => state;
  function set(next: CollectionContextMenuState | null) {
    if (Object.is(state, next)) return;
    state = next;
    listeners.forEach(listener => listener());
  }
  return {
    getSnapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    open: (next: CollectionContextMenuState) => set(next),
    close: () => set(null)
  };
}
export type CollectionMenuStore = ReturnType<typeof createCollectionMenuStore>;
