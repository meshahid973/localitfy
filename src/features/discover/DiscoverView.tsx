import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Compass, ExternalLink, Plus, RefreshCw, Settings2, UserX } from "lucide-react";
import { PageHeader } from "../../shared/ui/PageHeader";
import { splitArtistCredits } from "../artists/artistCredits";
import type { NotForMeKind } from "../analysis/notForMe";
import type { SpotifyTrack } from "../downloads/download.types";
import type { Settings } from "../settings/settings.types";
import type { DiscoverResult, DiscoverTrack } from "./discover.types";
import "./discover.css";

export type DiscoverViewProps = {
  settings: Pick<Settings, "discoverEnabled" | "lastfmApiKey">;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => unknown;
  /** Opens Downloads with these songs selected, ready to download. */
  sendToDownloads: (tracks: SpotifyTrack[]) => unknown;
  notForMe?: { toggle: (kind: NotForMeKind, value: string) => unknown };
};

const API_KEY = /^[0-9a-f]{32}$/i;
// Short and stable: downloads use the ID in file names.
function trackId(track: DiscoverTrack) {
  let hash = 2166136261;
  for (const char of `${track.artist}|${track.title}`.toLocaleLowerCase()) hash = Math.imul(hash ^ char.codePointAt(0)!, 16777619);
  return `lastfm-${(hash >>> 0).toString(36)}`;
}
const toDownload = (track: DiscoverTrack): SpotifyTrack => ({ id: trackId(track), title: track.title, artist: track.artist, providerUrl: track.url });
const listNames = (names: string[]) => names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
const openLink = (url: string) => { if (url) void window.localitfy.openExternal?.(url); };

export default function DiscoverView({ settings, updateSetting, sendToDownloads, notForMe }: DiscoverViewProps) {
  const [result, setResult] = useState<DiscoverResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [keyDraft, setKeyDraft] = useState(settings.lastfmApiKey || "");
  const [picked, setPicked] = useState<Map<string, DiscoverTrack>>(() => new Map());
  const requestVersionRef = useRef(0);

  const load = useCallback(async (refresh = false) => {
    const requestVersion = ++requestVersionRef.current;
    setLoading(true);
    try {
      const result = await window.localitfy.getDiscoveries({ refresh });
      if (requestVersion === requestVersionRef.current) setResult(result);
    } catch {
      if (requestVersion === requestVersionRef.current) setResult({ status: "error", error: "Discover failed. Please try again." });
    } finally {
      if (requestVersion === requestVersionRef.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    return () => { requestVersionRef.current += 1; };
  }, [load, settings.discoverEnabled, settings.lastfmApiKey]);

  const togglePick = (track: DiscoverTrack) => setPicked((current) => {
    const next = new Map(current);
    if (next.has(trackId(track))) next.delete(trackId(track)); else next.set(trackId(track), track);
    return next;
  });
  const sendPicked = () => { sendToDownloads([...picked.values()].map(toDownload)); setPicked(new Map()); };
  const dismissArtist = (name: string) => {
    notForMe?.toggle("artist", name);
    const normalized = name.trim().toLocaleLowerCase();
    const includesArtist = (value: string) => splitArtistCredits(value).some((credit) => credit.toLocaleLowerCase() === normalized);
    setResult((current) => current?.status === "ready" ? {
      ...current,
      artists: current.artists.filter((artist) => !includesArtist(artist.name))
        .map((artist) => ({ ...artist, topTracks: artist.topTracks.filter((track) => !includesArtist(track.artist)) })),
      tracks: current.tracks.filter((track) => !includesArtist(track.artist))
    } : current);
    setPicked((current) => new Map([...current].filter(([, track]) => !includesArtist(track.artist))));
  };

  async function turnOn() {
    await updateSetting("lastfmApiKey", keyDraft.trim());
    await updateSetting("discoverEnabled", true);
    setShowSettings(false);
  }

  const needsSetup = !result || result.status === "off" || result.status === "needs-key";
  const setup = (
    <div className="discoverSetup">
      <p>Discover suggests artists and songs you don’t have yet, based on what you play and like. It asks <strong>Last.fm</strong>, sending only the names of your most-played artists and songs. Answers are cached on this device for a week.</p>
      <label className="discoverKey">
        <span>Last.fm API key</span>
        <input value={keyDraft} onChange={(event) => setKeyDraft(event.currentTarget.value)} placeholder="32 letters and numbers" spellCheck={false} autoComplete="off" />
      </label>
      <p className="discoverHint">Keys are free. You need a Last.fm account, which is separate from Google; if you’re not signed in to Last.fm, it asks you to first and then opens the form. Paste the “API key” it shows here, not the shared secret.
        {" "}<button type="button" className="discoverLink" onClick={() => openLink("https://www.last.fm/api/account/create")}>Get a key <ExternalLink size={12} /></button>
        {" · "}<button type="button" className="discoverLink" onClick={() => openLink("https://www.last.fm/join?next=/api/account/create")}>No account? Sign up <ExternalLink size={12} /></button></p>
      <div className="discoverActions">
        <button type="button" className="heroMain" disabled={!API_KEY.test(keyDraft.trim())} onClick={() => void turnOn()}>
          <Compass size={15} /><span>{settings.discoverEnabled ? "Save key" : "Turn on Discover"}</span>
        </button>
        {settings.discoverEnabled ? <button type="button" className="softButton" onClick={() => void updateSetting("discoverEnabled", false)}>Turn off Discover</button> : null}
      </div>
    </div>
  );

  const ready = result?.status === "ready" ? result : null;
  const seedsLine = useMemo(() => {
    if (!ready?.seeds.length) return "";
    const shown = ready.seeds.slice(0, 3);
    const more = ready.seeds.length - shown.length;
    return `Based on ${shown.join(", ")}${more > 0 ? ` and ${more} more artists you play` : ""}.`;
  }, [ready]);

  const pickButton = (track: DiscoverTrack) => {
    const on = picked.has(trackId(track));
    return <button type="button" className={`discoverPick ${on ? "active" : ""}`} aria-pressed={on} aria-label={`${on ? "Unpick" : "Pick"} ${track.title}`} onClick={() => togglePick(track)}>
      {on ? <Check size={14} /> : <Plus size={14} />}
    </button>;
  };

  return <section className="discoverPage" aria-busy={loading}>
    <PageHeader eyebrow="outside your library" title="Discover" description={ready ? seedsLine : "New artists and songs, picked from what you already play."}>
      {!needsSetup ? <>
        <button type="button" className="softButton" disabled={loading} onClick={() => void load(true)}><RefreshCw size={15} /> {loading ? "Finding music…" : "Refresh"}</button>
        <button type="button" className="softButton" aria-expanded={showSettings} onClick={() => setShowSettings((open) => !open)}><Settings2 size={15} /> Settings</button>
      </> : null}
    </PageHeader>

    {needsSetup || showSettings ? setup : null}
    {loading && !ready ? <p className="discoverNotice" role="status">Asking Last.fm about the artists you play… the first time takes a few seconds.</p> : null}
    {result?.status === "error" ? <p className="discoverNotice" role="alert">{result.error} <button type="button" className="softButton" onClick={() => void load(true)}>Retry</button></p> : null}
    {result?.status === "no-taste" ? <p className="discoverNotice">Play or like a few songs first. Discover learns from what you listen to.</p> : null}

    {ready?.artists.length ? <>
      <h2 className="discoverHeading">Artists you might like</h2>
      <div className="discoverArtists">
        {ready.artists.map((artist) => <article key={artist.name} className="discoverArtist">
          <header>
            <button type="button" className="discoverName" onClick={() => openLink(artist.url)} title="Open on Last.fm">{artist.name}</button>
            {notForMe ? <button type="button" className="discoverPick" aria-label={`Not for me: ${artist.name}`} title="Not for me"
              onClick={() => dismissArtist(artist.name)}><UserX size={14} /></button> : null}
          </header>
          <p className="discoverBecause">because you play {listNames(artist.because)}{artist.seedCount > artist.because.length ? ` and ${artist.seedCount - artist.because.length} more` : ""}</p>
          {artist.topTracks.length ? <ul className="discoverTracks">
            {artist.topTracks.map((track) => <li key={track.title}><span>{track.title}</span>{pickButton(track)}</li>)}
          </ul> : null}
        </article>)}
      </div>
    </> : null}

    {ready?.tracks.length ? <>
      <h2 className="discoverHeading">Popular songs you don’t have yet</h2>
      <p className="discoverBecause">From the artists you play most.</p>
      <ul className="discoverSongList">
        {ready.tracks.map((track) => <li key={trackId(track)}>
          <span className="discoverSongText"><strong>{track.title}</strong><small>{track.artist}</small></span>
          <button type="button" className="discoverPick" aria-label={`Open ${track.title} on Last.fm`} title="Open on Last.fm" onClick={() => openLink(track.url)}><ExternalLink size={14} /></button>
          {pickButton(track)}
        </li>)}
      </ul>
    </> : null}

    {ready && !ready.artists.length && !ready.tracks.length ? <p className="discoverNotice">Nothing new to suggest right now. Try again after listening to more music.</p> : null}

    {picked.size ? <div className="discoverTray" role="region" aria-label="Picked songs">
      <span>{picked.size} song{picked.size === 1 ? "" : "s"} picked</span>
      <button type="button" className="softButton" onClick={() => setPicked(new Map())}>Clear</button>
      <button type="button" className="heroMain" onClick={sendPicked}><Plus size={15} /><span>Send to Downloads</span></button>
    </div> : null}
  </section>;
}
