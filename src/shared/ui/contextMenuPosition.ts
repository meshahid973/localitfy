/** Keep a measured right-click menu visible inside a resizable Electron window. */
export type ContextMenuPoint = { x: number; y: number };
export type ContextMenuSize = { width: number; height: number };

export function clampContextMenuPosition(
  point: ContextMenuPoint,
  menu: ContextMenuSize,
  viewport: ContextMenuSize,
  margin = 12
): { left: number; top: number } {
  const maxLeft = Math.max(margin, viewport.width - menu.width - margin);
  const maxTop = Math.max(margin, viewport.height - menu.height - margin);
  return {
    left: Math.max(margin, Math.min(point.x, maxLeft)),
    top: Math.max(margin, Math.min(point.y, maxTop))
  };
}
