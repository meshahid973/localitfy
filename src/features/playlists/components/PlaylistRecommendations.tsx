import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Cover } from "../../covers/Cover";
import type { Song } from "../../library/song.types";
import { prettyMeta, prettyTitle } from "../../search";
import { formatTime } from "../../../shared/utils/format";
import type { Playlist } from "../playlist.types";
import { RECOMMENDATION_PAGE, audioRecommendationSeeds, pickRecommendations, rankScores, relatedSongScores } from "../playlistRecommendations";

export type PlaylistRecommendationsProps = {
  playlist: Playlist;
  songs: Song[];
  playlists: Playlist[];
  currentId: string;
  /** Songs marked "not for me" are never suggested. */
  hidden: (song: Song) => boolean;
  addSongToPlaylist: (playlistId: string, songId: string) => unknown;
  selectSong: (id: string, autoplay?: boolean) => unknown;
};

type Pool = { playlistId: string; ids: string[]; bySound: boolean };

/** Spotify-style "Recommended songs" under a playlist: a short list with an add button per song and a refresh. */
export default function PlaylistRecommendations({ playlist, songs, playlists, currentId, hidden, addSongToPlaylist, selectSong }: PlaylistRecommendationsProps) {
  const songsById = useMemo(() => new Map(songs.map((song) => [song.id, song])), [songs]);
  const [pool, setPool] = useState<Pool | null>(null);
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set());
  const [reload, setReload] = useState(0);
  // Adding a recommendation changes the playlist; that should swap in the next song, not recalculate everything.

  useEffect(() => {
    let cancelled = false;
    setSeen(new Set());
    void (async () => {
      const members = playlist.songIds.map((id) => songsById.get(id)).filter((song): song is Song => !!song && song.fileExists !== false);
      if (!members.length) { setPool({ playlistId: playlist.id, ids: [], bySound: false }); return; }
      let bySound: string[] = [];
      try {
        const result = await window.localitfy.findSimilarSongs({ songIds: audioRecommendationSeeds(members),
          seedKey: `recommend:${playlist.id}`.slice(0, 200), limit: 50 });
        if (result.status === "ready") bySound = result.matches.map((match) => match.songId);
      } catch { /* Without saved audio analysis, library relationships still give suggestions. */ }
      if (cancelled) return;
      const related = rankScores(relatedSongScores(members, songs, playlists)).slice(0, 120);
      const ids = [...new Set([...bySound, ...related])].filter((id) => { const song = songsById.get(id); return !!song && !hidden(song); });
      setPool({ playlistId: playlist.id, ids, bySound: bySound.length >= RECOMMENDATION_PAGE / 2 });
    })();
    return () => { cancelled = true; };
  }, [playlist.id, reload, songsById, hidden]);

  const current = pool?.playlistId === playlist.id ? pool : null;
  const inPlaylist = useMemo(() => new Set(playlist.songIds), [playlist.songIds]);
  const visible = useMemo(() => current ? pickRecommendations(current.ids, songsById, new Set([...inPlaylist, ...seen]))
    .filter((id) => !hidden(songsById.get(id) as Song)) : [], [current, songsById, inPlaylist, seen, hidden]);

  function refresh() {
    const next = new Set([...seen, ...visible]);
    const remaining = current ? pickRecommendations(current.ids, songsById, new Set([...inPlaylist, ...next])) : [];
    // Once the pool runs low, start over from the playlist as it is now.
    if (remaining.length < RECOMMENDATION_PAGE / 2) setReload((value) => value + 1);
    else setSeen(next);
  }

  if (current && !current.ids.length) return null;
  return (
    <section className="playlistRecommendations" aria-labelledby="playlist-recommendations-title">
      <div className="playlistRecommendationsHead">
        <div>
          <h4 id="playlist-recommendations-title">Recommended songs</h4>
          <small>{current?.bySound ? "Sound match" : "From your library"}</small>
        </div>
        <button className="settingsTinyButton" type="button" onClick={refresh} disabled={!current}><RefreshCw size={14} /> refresh</button>
      </div>
      {!current ? <p className="playlistRecommendationsNote" role="status">Finding suggestions…</p> : !visible.length ? (
        <p className="playlistRecommendationsNote" role="status">No more suggestions.</p>
      ) : (
        <ol className="playlistRecommendationsList">
          {visible.map((id) => {
            const song = songsById.get(id) as Song;
            return (
              <li key={id} className="playlistRecommendationRow" data-current={currentId === id}>
                <button className="playlistRecommendationMain" type="button" onClick={() => void selectSong(id, true)} title="Play">
                  <Cover song={song} className="playlistRecommendationCover" />
                  <span className="playlistTrackText"><strong>{prettyTitle(song.title)}</strong><small>{prettyMeta(song.artist)}</small></span>
                </button>
                <small className="playlistRecommendationAlbum">{prettyMeta(song.album)}</small>
                <span className="playlistTrackDuration">{formatTime(song.duration)}</span>
                <button className="softButton playlistRecommendationAdd" type="button" onClick={() => addSongToPlaylist(playlist.id, id)}
                  aria-label={`Add ${song.title} to ${playlist.name}`}><Plus size={14} /> add</button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
