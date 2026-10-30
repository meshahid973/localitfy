import { useEffect, useMemo, useState } from "react";
import type { Song } from "../library/song.types";

// The library list leaves genre tags out to stay small, so they are read once and shared by the
// Genres page and genre pages.
let cachedTags: Map<string, string> | null = null;
let pending: Promise<Map<string, string> | null> | null = null;

function loadGenreTags() {
  pending ??= window.localitfy.bootstrap({ includeGenres: true })
    .then((payload) => {
      if (!Array.isArray(payload?.songs)) return null;
      cachedTags = new Map<string, string>(payload.songs.map((song) => [song.id, String(song.genre || "")]));
      return cachedTags;
    })
    .catch((error) => {
      console.error("[localitfy genres load error]", error);
      return null;
    })
    .finally(() => { pending = null; });
  return pending;
}

/** Songs with their genre tags filled in. `loading` stays true until the first read finishes. */
export function useGenreTaggedSongs(songs: Song[]) {
  const [tags, setTags] = useState<Map<string, string> | null>(cachedTags);
  const [loading, setLoading] = useState(!cachedTags);

  // Read again on every visit (tags may have been edited), showing the last answer meanwhile.
  useEffect(() => {
    let active = true;
    void loadGenreTags().then((next) => {
      if (!active) return;
      if (next) setTags(next);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const tagged = useMemo(() => (tags ? songs.map((song) => ({ ...song, genre: tags.get(song.id) ?? song.genre })) : songs), [songs, tags]);
  return { songs: tagged, loading };
}
