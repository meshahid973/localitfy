import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Play, RefreshCw, Save, WandSparkles, X } from "lucide-react";
import { Cover } from "../../covers/Cover";
import type { Song } from "../../library/song.types";
import { prettyMeta, prettyTitle } from "../../search";
import { formatTime } from "../../../shared/utils/format";
import { artistKey, songArtistKeys } from "../playlistRecommendations";
import { buildPromptPlaylist, describePrompt, parsePrompt, planHasLibraryTerms, promptVocabulary, type PromptPlan } from "../promptPlaylist";

export type PromptPlaylistDialogProps = {
  songs: Song[];
  currentId: string;
  hidden: (song: Song) => boolean;
  playSongs: (ids: string[], label: string) => unknown;
  selectSong: (id: string, autoplay?: boolean) => unknown;
  savePlaylist: (name: string, ids: string[]) => string | null;
  openAnalysisSettings: () => void;
  onClose: () => void;
};

const EXAMPLES = ["chill songs for studying", "upbeat songs for a party, 1 hour", "liked songs I haven't played in a while", "my most played hip hop"];
type SoundState = "used" | "model-missing" | "no-profiles" | "error" | null;
type Result = { plan: PromptPlan; ids: string[]; sound: SoundState };

export default function PromptPlaylistDialog({ songs, currentId, hidden, playSongs, selectSong, savePlaylist, openAnalysisSettings, onClose }: PromptPlaylistDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [name, setName] = useState("");
  const seed = useRef(1);
  const request = useRef(0);
  // Prompt model scores depend only on the description, so regenerating reuses them.
  const soundCache = useRef(new Map<string, Map<string, number>>());
  const vocabulary = useMemo(() => promptVocabulary(songs), [songs]);
  const songsById = useMemo(() => new Map(songs.map((song) => [song.id, song])), [songs]);

  async function generate(text: string, again = false) {
    if (!text.trim()) return;
    const token = ++request.current;
    seed.current = again ? seed.current + 1 : 1;
    setLoading(true);
    const plan = parsePrompt(text, vocabulary);
    let sound: Map<string, number> | undefined = soundCache.current.get(plan.sound);
    let soundState: SoundState = sound ? "used" : null;
    if (plan.sound && !sound) {
      try {
        const scored = await window.localitfy.scorePromptSound({ text: plan.sound });
        if (scored.status === "ready") { sound = new Map(scored.scores); soundCache.current.set(plan.sound, sound); soundState = "used"; }
        else soundState = scored.status;
      } catch { soundState = "error"; }
    }
    let similar: Map<string, number> | undefined;
    if (plan.similarTo.length) {
      const names = new Set(plan.similarTo.map(artistKey));
      const seeds = songs.filter((song) => song.fileExists !== false && songArtistKeys(song).some((key) => names.has(key)));
      try {
        const found = seeds.length ? await window.localitfy.findSimilarSongs({ songIds: seeds.slice(0, 2000).map((song) => song.id), seedKey: "prompt", limit: 50 }) : null;
        if (found?.status === "ready") similar = new Map(found.matches.map((match) => [match.songId, match.score]));
      } catch { /* Falls back to shared artists and genres. */ }
    }
    if (token !== request.current) return;
    // A description alone can't be matched without the prompt model; don't pass off random songs as a result.
    const ids = sound || planHasLibraryTerms(plan) ? buildPromptPlaylist(plan, songs, { sound, similar, hidden, seed: seed.current }) : [];
    setResult({ plan, ids, sound: plan.sound ? soundState : null });
    setSelected(new Set(ids));
    if (!again) setName(plan.name);
    setLoading(false);
  }

  const picked = result ? result.ids.filter((id) => selected.has(id)) : [];
  const seconds = picked.reduce((total, id) => total + (Number(songsById.get(id)?.duration) || 0), 0);
  const toggle = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (!next.delete(id)) next.add(id);
    return next;
  });
  const notice = !result ? null : result.sound === "model-missing" ? (
    result.ids.length ? `Matching by sound is off, so “${result.plan.sound}” was only used for names and genres.`
      : "Sound matching needs the prompt model. Try an artist or genre."
  ) : result.sound === "no-profiles" ? "Analyze your library for sound matching."
    : result.sound === "error" ? "Couldn't compare the description with your music. Try again."
    : !result.ids.length ? "Nothing in your library matches that. Try fewer or different words." : null;

  // Portaled to the app root: the playlists page is a transformed container, which would trap a fixed overlay.
  return createPortal(
    <div className="modalWrap smartPlaylistWrap" onClick={onClose}>
      <div className="smartPlaylistModal promptPlaylistModal" role="dialog" aria-modal="true" aria-labelledby="prompt-playlist-title"
        onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}>
        <div className="modalHead">
          <div>
            <h3 id="prompt-playlist-title">Describe a playlist</h3>
          </div>
          <button className="closeModalButton" type="button" onClick={onClose} aria-label="Close"><X size={18} strokeWidth={2.4} /></button>
        </div>

        <form className="promptPlaylistForm" onSubmit={(event) => { event.preventDefault(); void generate(prompt); }}>
          <input value={prompt} onChange={(event) => setPrompt(event.currentTarget.value)} maxLength={300} autoFocus
            placeholder="e.g. chill songs like Mac Miller, no hip hop, 1 hour" aria-label="Prompt" />
          <button className="heroMain" type="submit" disabled={!prompt.trim() || loading}><WandSparkles size={15} /><span>{loading ? "thinking…" : "generate"}</span></button>
        </form>
        {!result ? (
          <div className="smartPlaylistPresets" aria-label="Examples">
            {EXAMPLES.map((example) => <button key={example} type="button" className="settingsTinyButton"
              onClick={() => { setPrompt(example); void generate(example); }}>{example}</button>)}
          </div>
        ) : (
          <ul className="promptPlaylistUnderstood" aria-label="Understood as">
            {describePrompt(result.plan, result.sound === "used").map((label) => <li key={label}>{label}</li>)}
          </ul>
        )}
        {notice ? (
          <p className="promptPlaylistNotice" role="status">{notice}{result?.sound === "model-missing" || result?.sound === "no-profiles" ? (
            <> <button type="button" className="settingsTinyButton" onClick={openAnalysisSettings}>open experimental settings</button></>
          ) : null}</p>
        ) : null}

        {result?.ids.length ? <>
          <div className="smartPlaylistMatch">
            <span>{picked.length} of {result.ids.length} songs · {formatTime(seconds)}</span>
            <button type="button" className="settingsTinyButton" onClick={() => setSelected(new Set(picked.length === result.ids.length ? [] : result.ids))}>
              {picked.length === result.ids.length ? "select none" : "select all"}</button>
          </div>
          <ol className="promptPlaylistList">
            {result.ids.map((id) => {
              const song = songsById.get(id) as Song;
              return (
                <li key={id} className="promptPlaylistRow" data-current={currentId === id}>
                  <label>
                    <input type="checkbox" checked={selected.has(id)} onChange={() => toggle(id)} />
                    <Cover song={song} className="playlistRecommendationCover" />
                    <span className="playlistTrackText"><strong>{prettyTitle(song.title)}</strong><small>{prettyMeta(song.artist)}</small></span>
                  </label>
                  <span className="playlistTrackDuration">{formatTime(song.duration)}</span>
                  <button type="button" className="settingsTinyButton" aria-label={`Play ${song.title}`} onClick={() => void selectSong(id, true)}><Play size={14} /></button>
                </li>
              );
            })}
          </ol>
          <div className="smartPlaylistFooter">
            <label className="smartPlaylistField">
              <span>name</span>
              <input value={name} onChange={(event) => setName(event.currentTarget.value)} maxLength={120} placeholder="playlist name" />
            </label>
            <div className="promptPlaylistActions">
              <button type="button" className="settingsTinyButton" disabled={loading} onClick={() => void generate(prompt, true)}><RefreshCw size={14} /> regenerate</button>
              <button type="button" className="settingsTinyButton" disabled={!picked.length} onClick={() => playSongs(picked, name || result.plan.name)}><Play size={14} /> play</button>
              <button type="button" className="heroMain" disabled={!picked.length}
                onClick={() => { if (savePlaylist(name || result.plan.name, picked)) onClose(); }}><Save size={15} strokeWidth={2.4} /><span>save playlist</span></button>
            </div>
          </div>
        </> : null}
      </div>
    </div>,
    document.querySelector(".app") || document.body
  );
}
