import type { DragEvent } from "react";
import type { LibraryDropSide, LibraryDropTarget } from "./song.types";

export function getLibraryDropSideInfoForElement(
  clientX: number,
  clientY: number,
  element: HTMLElement
): Pick<LibraryDropTarget, "side" | "pull"> {
  const rect = element.getBoundingClientRect();
  const isCard = element.classList.contains("homeAlbumCard");

  if (isCard) {
    const centerX = rect.left + rect.width / 2;
    const halfWidth = Math.max(rect.width / 2, 1);
    const side: LibraryDropSide = clientX > centerX ? "after" : "before";
    const distanceFromCenter = Math.min(1, Math.abs(clientX - centerX) / halfWidth);
    const distanceFromEdge = side === "before" ? Math.max(0, clientX - rect.left) : Math.max(0, rect.right - clientX);
    const edgePull = 1 - Math.min(1, distanceFromEdge / Math.max(rect.width * 0.42, 1));
    return { side, pull: 10 + distanceFromCenter * 16 + edgePull * 32 };
  }

  const centerY = rect.top + rect.height / 2;
  const halfHeight = Math.max(rect.height / 2, 1);
  const side: LibraryDropSide = clientY > centerY ? "after" : "before";
  const distanceFromCenter = Math.min(1, Math.abs(clientY - centerY) / halfHeight);
  return { side, pull: 10 + distanceFromCenter * 16 };
}

export function getLibraryDropSideForElement(event: DragEvent<HTMLElement>, element: HTMLElement): LibraryDropSide {
  return getLibraryDropSideInfoForElement(event.clientX, event.clientY, element).side;
}

export function getLibraryDropSide(event: DragEvent<HTMLElement>): LibraryDropSide {
  return getLibraryDropSideForElement(event, event.currentTarget);
}

export function getLibraryDropElement(event: DragEvent<HTMLElement>) {
  if (!(event.target instanceof HTMLElement)) return null;
  const element = event.target.closest<HTMLElement>("[data-library-song-id]");
  if (!element || !event.currentTarget.contains(element)) return null;
  return element;
}

