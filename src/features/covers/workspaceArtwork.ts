/** Bound artwork work; entity pages may prioritize the browsed collection. */
export function resolveWorkspaceArtwork(track: readonly string[], page: readonly string[], preferPage = false): string[] {
  const [first, second] = preferPage ? [page, track] : [track, page];
  const primary = [...new Set(first.filter(Boolean))].slice(0, 3);
  const fallback = [...new Set(second.filter(source => source && !primary.includes(source)))].slice(0, 3);
  return [...primary, ...fallback];
}
