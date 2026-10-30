import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { Song } from "../library/song.types";
import type { DailyMix, DailyMixesResult } from "./analysis.types";
import PlaylistCoverCollage from "../playlists/components/PlaylistCoverCollage";
import { MediaCard } from "../../shared/ui/MediaCard";
import { MetaDividerDot } from "../../shared/ui/LocaltifyViewUi";
import { formatTime } from "../../shared/utils/format";
import { prettyMeta } from "../search";
import { mixTarget, useAppActions } from "../shell/appActions";
import { splitArtistCredits } from "../artists/artistCredits";
import "./daily-mixes.css";

const ARTISTS_SHOWN = 4;

export type DailyMixesShelfProps = {
  songs: Song[];
  /** Used by the mix page's "save as playlist". */
  savePlaylist: (name: string, ids: string[]) => string | null;
  openAnalysisSettings: () => void;
};
function day() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }

export default function DailyMixesShelf(props: DailyMixesShelfProps) {
  const [result, setResult] = useState<DailyMixesResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef(0);
  const loadingRef = useRef(false);
  const songsById = useMemo(() => new Map(props.songs.map((song) => [song.id, song])), [props.songs]);
  const load = useCallback(async (refresh = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    const request = ++requestRef.current;
    setLoading(true); setError("");
    try {
      const next = await window.localitfy.getDailyMixes({ refresh });
      if (request === requestRef.current) setResult(next);
    } catch {
      if (request === requestRef.current) setError("Could not generate your mixes. Please retry.");
    } finally {
      if (request === requestRef.current) { loadingRef.current = false; setLoading(false); }
    }
  }, []);
  useEffect(() => {
    void load();
    return () => { requestRef.current++; loadingRef.current = false; };
  }, [load]);
  useEffect(() => {
    const check = () => { if (result?.day !== day()) void load(); };
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = window.setTimeout(check, midnight.getTime() - now.getTime() + 1000);
    window.addEventListener("focus", check);
    return () => { window.clearTimeout(timer); window.removeEventListener("focus", check); };
  }, [load, result]);

  return <section className="panel dailyMixes" aria-labelledby="daily-mixes-title" aria-busy={loading}>
    <div className="panelHead dailyMixesHeader">
      <div><p className="eyebrow">made from your library</p><h3 id="daily-mixes-title">your daily mixes</h3>
        <p className="dailyMixesIntro">Familiar sounds, a fresh selection each day. Built on your device from saved audio analysis.</p></div>
      <button type="button" className="softButton dailyMixesRefresh" disabled={loading} onClick={() => void load(true)}><RefreshCw size={15} />{loading ? "Building mixes…" : "Refresh mixes"}</button>
    </div>
    {error ? <p className="dailyMixesNotice" role="alert">{error} <button type="button" className="softButton" disabled={loading} onClick={() => void load()}>Retry</button></p> : null}
    {loading && !result ? <p className="dailyMixesNotice" role="status">Finding groups of similar sounds…</p> : null}
    {result && !result.mixes.length ? <div className="dailyMixesNotice"><p>Analyze at least five playable tracks to make your first mix. More analyzed music gives you more variety.</p><button type="button" className="softButton" onClick={props.openAnalysisSettings}>Open analysis settings</button></div> : null}
    {result?.mixes.length ? <>
      <div className="playlistShelfGrid dailyMixesGrid">{result.mixes.map((mix) => <MixCard key={`${result.day}:${result.edition}:${mix.id}`} mix={mix} songsById={songsById} />)}</div>
      <p className="dailyMixesFootnote">{result.eligible} analyzed tracks available · {result.day} · Up to 25 tracks per mix. Refreshing leaves saved playlists intact.</p>
    </> : null}
  </section>;
}

/** A mix card like a saved playlist's: click opens the mix, the round button plays it, right-click opens its menu. */
function MixCard({ mix, songsById }: { mix: DailyMix; songsById: Map<string, Song> }) {
  const actions = useAppActions();
  const songs = mix.songIds.flatMap((id) => { const song = songsById.get(id); return song && song.fileExists !== false ? [song] : []; });
  const target = mixTarget(mix, songs);
  const artists = [...new Set(songs.flatMap((song) => song.artist?.trim() ? splitArtistCredits(song.artist).map((name) => prettyMeta(name)) : []))];
  return (
    <MediaCard className="playlistShelfCard dailyMixCard" coverClassName="mediaCardPlayCentered" openLabel={`open ${mix.name}`} playLabel={`play ${mix.name}`}
      onOpen={() => actions.openCollection(target)} onPlay={() => actions.playCollection(target)}
      onContextMenu={(event) => actions.openCollectionMenu(event, target)}
      cover={<PlaylistCoverCollage songs={songs} />}>
      <span className="playlistShelfMeta">
        <strong>{mix.name}</strong>
        <span className="dailyMixArtists">{artists.slice(0, ARTISTS_SHOWN).join(", ") || "your analyzed music"}{artists.length > ARTISTS_SHOWN ? " and more" : ""}</span>
        <small>{songs.length} song{songs.length === 1 ? "" : "s"}<MetaDividerDot />{formatTime(songs.reduce((sum, song) => sum + (song.duration || 0), 0))}</small>
      </span>
    </MediaCard>
  );
}
