/** Track art takes precedence, then the active page's real art. Bound fallback work. */
export function resolveWorkspaceArtwork(track: readonly string[], page: readonly string[]): string[] {
  return [...new Set([...track, ...page].filter(Boolean))].slice(0, 6);
}
