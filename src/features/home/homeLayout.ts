export const homeSections = [
  { id: "jumpBack", label: "Jump back in" },
  { id: "listenNow", label: "Listen now" },
  { id: "dailyMixes", label: "Daily mixes" },
  { id: "recentlyPlayed", label: "Recently played" },
  { id: "mostListened", label: "Most listened of all time" },
  { id: "newReleases", label: "Recently added" },
  { id: "likedSongs", label: "Liked songs" },
  { id: "rediscover", label: "Rediscover" },
  { id: "notPlayedYet", label: "Not played yet" }
] as const;

export type HomeSectionId = (typeof homeSections)[number]["id"];
export type HomeLayoutPatch = { homeSectionOrder?: HomeSectionId[]; homeHiddenSections?: HomeSectionId[] };

const defaultOrder: HomeSectionId[] = homeSections.map((section) => section.id);
/** Extra shelves that start hidden so a fresh Home stays short. Customize Home can show them. */
export const defaultHiddenHomeSections: HomeSectionId[] = ["likedSongs", "rediscover", "notPlayedYet"];

function knownSectionIds(value: unknown): HomeSectionId[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String))].filter((id): id is HomeSectionId => defaultOrder.includes(id as HomeSectionId));
}

/** Saved order first, then any sections the save does not know about yet (new sections in later versions). */
export function resolveHomeSectionOrder(order: unknown): HomeSectionId[] {
  const saved = knownSectionIds(order);
  return [...saved, ...defaultOrder.filter((id) => !saved.includes(id))];
}

export function normalizeHomeHidden(hidden: unknown): HomeSectionId[] {
  return knownSectionIds(hidden);
}

export function visibleHomeSections(order: unknown, hidden: unknown): HomeSectionId[] {
  const hiddenSet = new Set(normalizeHomeHidden(hidden));
  return resolveHomeSectionOrder(order).filter((id) => !hiddenSet.has(id));
}

export function canMoveHomeSection(order: unknown, id: HomeSectionId, delta: -1 | 1) {
  const resolved = resolveHomeSectionOrder(order);
  return Boolean(resolved[resolved.indexOf(id) + delta]);
}

export function moveHomeSection(order: unknown, id: HomeSectionId, delta: -1 | 1): HomeSectionId[] {
  const next = resolveHomeSectionOrder(order);
  const from = next.indexOf(id);
  const to = from + delta;
  if (from === -1 || to < 0 || to >= next.length) return next;
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export function toggleHomeSectionHidden(hidden: unknown, id: HomeSectionId): HomeSectionId[] {
  const current = normalizeHomeHidden(hidden);
  return current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id];
}

export function isHomeLayoutCustomized(order: unknown, hidden: unknown) {
  const current = normalizeHomeHidden(hidden);
  const hiddenChanged = current.length !== defaultHiddenHomeSections.length || current.some((id) => !defaultHiddenHomeSections.includes(id));
  return hiddenChanged || resolveHomeSectionOrder(order).some((id, index) => id !== defaultOrder[index]);
}
