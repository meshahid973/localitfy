/** Track art takes precedence, then the active page's real art. Bound fallback work. */
export function resolveWorkspaceArtwork(track: readonly string[], page: readonly string[]): string[] {
  const primary = [...new Set(track.filter(Boolean))].slice(0, 3);
  const fallback = [...new Set(page.filter(source => source && !primary.includes(source)))].slice(0, 3);
  return [...primary, ...fallback];
}
