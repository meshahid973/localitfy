/**
 * Three-way merge for phone sync. `base` is what both sides agreed on at the last sync, `mac` is the Mac now
 * and `phone` is this phone now. Only the phone's own edits are pushed; the Mac applies them and the phone
 * then adopts the Mac's result. When both sides changed the same thing, the phone's edit wins, except that
 * play counts add up and an edited playlist is kept over a deleted one.
 */

export const EDITABLE_SONG_FIELDS = ["liked", "title", "artist", "album", "genre", "volumeGain", "customVolume"] as const;
type EditableField = typeof EDITABLE_SONG_FIELDS[number];

export type SyncSongFields = {
  id: string;
  liked?: boolean;
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  volumeGain?: number;
  customVolume?: number;
  playCount?: number;
  lastPlayed?: string | null;
};

export type SongChange = Partial<Pick<SyncSongFields, EditableField>> & { playCountDelta?: number; lastPlayed?: string };

export type SyncPlaylist = { id: string; name: string; songIds: string[]; createdAt: number; rules?: unknown };

const time = (value?: string | null) => (value ? Date.parse(value) || 0 : 0);

/** Edits the phone made to songs since the last sync, keyed by song ID. */
export function phoneSongChanges(base: Map<string, SyncSongFields>, phone: Iterable<SyncSongFields>) {
  const changes: Record<string, SongChange> = {};
  for (const song of phone) {
    const before = base.get(song.id);
    if (!before) continue;
    const change: SongChange = {};
    for (const field of EDITABLE_SONG_FIELDS) {
      if (song[field] !== undefined && song[field] !== before[field]) (change as Record<string, unknown>)[field] = song[field];
    }
    const delta = Math.round(Number(song.playCount || 0) - Number(before.playCount || 0));
    if (delta > 0) change.playCountDelta = delta;
    if (song.lastPlayed && time(song.lastPlayed) > time(before.lastPlayed)) change.lastPlayed = song.lastPlayed;
    if (Object.keys(change).length) changes[song.id] = change;
  }
  return changes;
}

function samePlaylist(a: SyncPlaylist, b: SyncPlaylist) {
  return a.name === b.name && JSON.stringify(a.rules ?? null) === JSON.stringify(b.rules ?? null) &&
    a.songIds.length === b.songIds.length && a.songIds.every((id, index) => id === b.songIds[index]);
}

/** Keeps the Mac's order, drops songs the phone removed and inserts songs the phone added after their phone neighbours. */
export function mergeSongIds(base: string[], mac: string[], phone: string[]) {
  const phoneSet = new Set(phone);
  const baseSet = new Set(base);
  const removed = new Set(base.filter((id) => !phoneSet.has(id)));
  const result = mac.filter((id) => !removed.has(id));
  const present = new Set(result);
  phone.forEach((id, index) => {
    if (baseSet.has(id) || present.has(id)) return;
    // After the nearest earlier phone song that is still in the list (its direct neighbour may be gone).
    let previous = -1;
    for (let back = index - 1; back >= 0 && previous === -1; back -= 1) previous = result.indexOf(phone[back]);
    result.splice(previous + 1, 0, id);
    present.add(id);
  });
  return result;
}

export function phonePlaylistChanges(base: SyncPlaylist[], mac: SyncPlaylist[], phone: SyncPlaylist[]) {
  const baseById = new Map(base.map((item) => [item.id, item]));
  const macById = new Map(mac.map((item) => [item.id, item]));
  const phoneById = new Map(phone.map((item) => [item.id, item]));
  const put: SyncPlaylist[] = [];
  const remove: string[] = [];
  for (const id of new Set([...baseById.keys(), ...macById.keys(), ...phoneById.keys()])) {
    const b = baseById.get(id);
    const m = macById.get(id);
    const p = phoneById.get(id);
    if (!p) {
      // Deleted on the phone: delete on the Mac too, unless the Mac edited it since.
      if (b && m && samePlaylist(m, b)) remove.push(id);
      continue;
    }
    if (!b) {
      if (!m) put.push(p);
      continue;
    }
    if (samePlaylist(p, b)) continue;
    // Edited on the phone. If the Mac deleted it meanwhile, the phone's edits bring it back.
    if (!m || samePlaylist(m, b)) {
      put.push(p);
      continue;
    }
    const rulesChanged = JSON.stringify(p.rules ?? null) !== JSON.stringify(b.rules ?? null);
    put.push({
      ...m,
      name: p.name !== b.name ? p.name : m.name,
      ...(rulesChanged ? { rules: p.rules } : {}),
      songIds: mergeSongIds(b.songIds, m.songIds, p.songIds)
    });
  }
  return { put, delete: remove };
}
