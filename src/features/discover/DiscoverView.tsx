import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Compass, Disc3, ExternalLink, Plus, RefreshCw, Search, Settings2, UserX } from "lucide-react";
import { PageHeader } from "../../shared/ui/PageHeader";
import { isAndroidApp, computerName } from "../../app/platform";
import { splitArtistCredits } from "../artists/artistCredits";
import type { NotForMeKind } from "../analysis/notForMe";
import type { SpotifyTrack } from "../downloads/download.types";
import type { Settings } from "../settings/settings.types";
import type { CatalogKind, DiscoverResult, DiscoverTrack } from "./discover.types";
import { DiscoverCover } from "./DiscoverArtwork";
import "./discover.css";

const AlbumTracksDialog = lazy(() => import("../tagging/AlbumTracksDialog"));

export type DiscoverViewProps = {
  settings: Pick<Settings, "discoverEnabled" | "lastfmApiKey" | "musicbrainzTagging">;
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
const toDownload = (track: DiscoverTrack): SpotifyTrack => ({ id: trackId(track), title: track.title, artist: track.artist, providerUrl: track.url, coverUrl: track.coverUrl, durationMs: track.durationMs });
const listNames = (names: string[]) => names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
const openLink = (url: string) => { if (url) void window.localitfy.openExternal?.(url); };

export default function DiscoverView({ settings, updateSetting, sendToDownloads, notForMe }: DiscoverViewProps) {
  const phone = isAndroidApp();
  const [result, setResult] = useState<DiscoverResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAllRecommended, setShowAllRecommended] = useState(false);
  const [catalogKind, setCatalogKind] = useState<CatalogKind>("recording");
  const [catalogTerm, setCatalogTerm] = useState("");
  const [catalog, setCatalog] = useState<DiscoverResult | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const catalogRequestRef = useRef(0);
  const [showSettings, setShowSettings] = useState(false);
  const [keyDraft, setKeyDraft] = useState(settings.lastfmApiKey || "");
  const [picked, setPicked] = useState<Map<string, DiscoverTrack>>(() => new Map());
  const requestVersionRef = useRef(0);
  // The song whose whole album is being looked up on MusicBrainz.
  const [albumOf, setAlbumOf] = useState<DiscoverTrack | null>(null);

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

  useEffect(() => {
    if (!settings.discoverEnabled) {
      setCatalog(null);
      setCatalogLoading(false);
    }
    return () => { catalogRequestRef.current += 1; };
  }, [settings.discoverEnabled]);
  async function searchCatalog() {
    const term = catalogTerm.trim();
    if (!settings.discoverEnabled || term.length < 2 || catalogLoading) return;
    const request = ++catalogRequestRef.current;
    setCatalogLoading(true);
    setCatalog(null);
    try {
      const answer = await window.localitfy.getDiscoveries({ catalog: { kind: catalogKind, term } });
      if (request === catalogRequestRef.current) setCatalog(answer.status === "catalog" || answer.status === "error" ? answer : { status: "error", error: "Public catalog is unavailable. Check the desktop version and Discover settings." });
    } catch {
      if (request === catalogRequestRef.current) setCatalog({ status: "error", error: phone ? "Connect to your " + computerName() + " to search." : "Could not search the public catalog." });
    } finally {
      if (request === catalogRequestRef.current) setCatalogLoading(false);
    }
  }

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

  const needsSetup = !settings.discoverEnabled;
  const setup = phone ? <div className="discoverSetup"><p>Turn on Discover and manage its optional Last.fm connection in localtify on your {computerName()}, then sync this phone.</p></div> : (
    <div className="discoverSetup">
      <p>Search the public MusicBrainz catalog without an account or key. Only your search text is sent for catalog searches. If you add an optional Last.fm key, Localtify also requests personalized suggestions using artist and song names from your library and looks up suggested tracks in MusicBrainz for artwork. Cover images are loaded from the Cover Art Archive.</p>
      <details className="discoverOptional" open={Boolean(keyDraft) || undefined}>
      <summary>Optional Last.fm recommendations</summary>
      <label className="discoverKey">
        <span>Last.fm API key (optional)</span>
        <input value={keyDraft} onChange={(event) => setKeyDraft(event.currentTarget.value)} placeholder="32 letters and numbers" spellCheck={false} autoComplete="off" />
      </label>
      <p className="discoverHint">Keys are free. You need a Last.fm account, which is separate from Google; if you’re not signed in to Last.fm, it asks you to first and then opens the form. Paste the “API key” it shows here, not the shared secret.
        {" "}<button type="button" className="discoverLink" onClick={() => openLink("https://www.last.fm/api/account/create")}>Get a key <ExternalLink size={12} /></button>
        {" · "}<button type="button" className="discoverLink" onClick={() => openLink("https://www.last.fm/join?next=/api/account/create")}>No account? Sign up <ExternalLink size={12} /></button></p>
      </details>
      <div className="discoverActions">
        <button type="button" className="heroMain" disabled={Boolean(keyDraft.trim()) && !API_KEY.test(keyDraft.trim())} onClick={() => void turnOn()}>
          <Compass size={15} /><span>{settings.discoverEnabled ? "Save settings" : "Enable public discovery"}</span>
        </button>
        {settings.discoverEnabled ? <button type="button" className="softButton" onClick={() => { catalogRequestRef.current += 1; setCatalog(null); setCatalogLoading(false); void updateSetting("discoverEnabled", false); }}>Turn off Discover</button> : null}
      </div>
    </div>
  );

  const ready = settings.discoverEnabled && result?.status === "ready" ? result : null;
  const seedsLine = useMemo(() => {
    if (!ready?.seeds.length) return "";
    const shown = ready.seeds.slice(0, 3);
    const more = ready.seeds.length - shown.length;
    return `Based on ${shown.join(", ")}${more > 0 ? ` and ${more} more artists you play` : ""}.`;
  }, [ready]);

  const albumButton = (track: DiscoverTrack) => !phone && settings.musicbrainzTagging
    ? <button type="button" className="discoverPick" aria-label={`Get the album ${track.title} is from`} title="Get the whole album" onClick={() => setAlbumOf(track)}><Disc3 size={14} /></button>
    : null;

  const pickButton = (track: DiscoverTrack) => {
    if (phone) return null;
    const on = picked.has(trackId(track));
    return <button type="button" className={`discoverPick ${on ? "active" : ""}`} aria-pressed={on} aria-label={`${on ? "Unpick" : "Pick"} ${track.title}`} onClick={() => togglePick(track)}>
      {on ? <Check size={14} /> : <Plus size={14} />}
    </button>;
  };

  const recommendedTracks = useMemo(() => {
    const seen = new Set<string>();
    return (ready?.artists.flatMap(artist => artist.topTracks) ?? []).filter(track => {
      const id = trackId(track);
      if (seen.has(id)) return false;
      seen.add(id); return true;
    });
  }, [ready]);
  const duration = (ms?: number) => ms ? Math.floor(ms / 60000) + ":" + String(Math.floor(ms / 1000) % 60).padStart(2, "0") : "";

  return <section className="discoverPage" aria-busy={loading}>
    <PageHeader title="Discover" description={ready && seedsLine ? seedsLine : undefined}>
      {!needsSetup ? <>
        {ready || result?.status === "error" ? <button type="button" className="softButton" disabled={loading} onClick={() => void load(true)}><RefreshCw size={15} /> {loading ? "Finding music…" : "Refresh"}</button> : null}
        {phone ? null : <button type="button" className="softButton" aria-expanded={showSettings} onClick={() => setShowSettings((open) => !open)}><Settings2 size={15} /> Settings</button>}
      </> : null}
    </PageHeader>

    {needsSetup || showSettings ? setup : null}
    {settings.discoverEnabled ? <section className="discoverCatalog" aria-labelledby="discover-catalog-title">
      <h2 id="discover-catalog-title" className="discoverHeading">Explore music</h2>
      <form className="discoverSearch" onSubmit={event => { event.preventDefault(); void searchCatalog(); }}>
        <select aria-label="Search category" value={catalogKind} disabled={catalogLoading} onChange={event => { setCatalogKind(event.currentTarget.value as CatalogKind); setCatalog(null); }}>
          <option value="recording">Songs</option><option value="artist">Artists</option><option value="album">Albums</option>
        </select>
        <input type="search" aria-label="Search public music catalog" placeholder="Search MusicBrainz" value={catalogTerm} maxLength={160} disabled={catalogLoading} onChange={event => { setCatalogTerm(event.currentTarget.value); setCatalog(null); }} />
        <button className="heroMain" type="submit" disabled={catalogLoading || catalogTerm.trim().length < 2}><Search size={15} /><span>{catalogLoading ? "Searching…" : "Search"}</span></button>
      </form>
      <p className="discoverBecause">MusicBrainz catalog · Local playback only</p>
      {catalogLoading ? <p role="status">Searching public catalog…</p> : null}
      {catalog?.status === "error" ? <p role="alert">{catalog.error}</p> : null}
      {catalog?.status === "catalog" ? catalog.items.length ? <ul className={catalog.kind === "album" ? "discoverShelf discoverCatalogShelf" : "discoverSongList"} aria-label="Search results" tabIndex={catalog.kind === "album" ? 0 : undefined}>
        {catalog.items.map(item => <li key={item.id}>
          <DiscoverCover title={item.title} artist={item.artist} artwork={item} lookup={catalog.kind === "recording" && !item.coverUrl} person={catalog.kind === "artist"} />
          <span className="discoverSongText"><strong>{item.title}</strong><small>{item.subtitle}</small></span>
          {catalog.kind === "recording" ? <><span className="discoverDuration">{duration(item.durationMs)}</span>{albumButton(item)}{pickButton(item)}</> : null}
          <button type="button" className="discoverPick" aria-label={"Open " + item.title + " on MusicBrainz"} title="Open on MusicBrainz" onClick={() => openLink(item.url)}><ExternalLink size={14} /></button>
        </li>)}
      </ul> : <p role="status">No matching music found.</p> : null}
    </section> : null}
    {result?.status === "needs-key" && settings.discoverEnabled && !phone ? <p className="discoverBecause">Personalized Last.fm suggestions are optional. Add a key in Settings if you want them.</p> : null}
    {phone && !needsSetup ? <p className="discoverHint">Catalog searches and suggestions use your paired {computerName()}. Manage recommendations there.</p> : null}
    {loading && !ready ? <p className="discoverNotice" role="status">Loading optional personalized suggestions…</p> : null}
    {result?.status === "error" ? <p className="discoverNotice" role="alert">{result.error} <button type="button" className="softButton" onClick={() => void load(true)}>Retry</button></p> : null}
    {result?.status === "no-taste" ? <p className="discoverNotice">Play or like a few songs first. Discover learns from what you listen to.</p> : null}

    {recommendedTracks.length ? <section className="discoverSection" aria-labelledby="discover-recommended">
      <div className="discoverSectionHead"><h2 id="discover-recommended" className="discoverHeading">Recommended songs</h2>{recommendedTracks.length > 10 ? <button type="button" className="discoverName discoverMore" aria-expanded={showAllRecommended} onClick={() => setShowAllRecommended(value => !value)}>{showAllRecommended ? "Show less" : "See all"}</button> : null}</div>
      <ul className="discoverSongList">
        {(showAllRecommended ? recommendedTracks : recommendedTracks.slice(0, 10)).map(track => <li key={trackId(track)}>
          <DiscoverCover title={track.title} artist={track.artist} artwork={track} lookup />
          <span className="discoverSongText"><button type="button" className="discoverName" onClick={() => openLink(track.url)} title={track.title}>{track.title}</button><small>{track.artist}</small></span>
          {albumButton(track)}{pickButton(track)}
        </li>)}
      </ul>
    </section> : null}

    {ready?.tracks.length ? <section className="discoverSection" aria-labelledby="discover-popular">
      <h2 id="discover-popular" className="discoverHeading">Popular songs you don't have yet</h2>
      <ul className="discoverShelf" tabIndex={0} aria-label="Popular songs">
        {ready.tracks.map(track => <li key={trackId(track)}>
          <div className="discoverShelfArt">
            <button type="button" className="discoverArtLink" onClick={() => openLink(track.url)} aria-label={`Open ${track.title} on Last.fm`}>
              <DiscoverCover title={track.title} artist={track.artist} artwork={track} lookup />
            </button>
            <div className="discoverShelfActions">{albumButton(track)}{pickButton(track)}</div>
          </div>
          <span className="discoverSongText"><strong title={track.title}>{track.title}</strong><small>{track.artist}</small></span>
        </li>)}
      </ul>
    </section> : null}

    {ready?.artists.length ? <section className="discoverSection" aria-labelledby="discover-artists">
      <h2 id="discover-artists" className="discoverHeading">Artists you might like</h2>
      <ul className="discoverSongList">
        {ready.artists.map(artist => <li key={artist.name}>
          <DiscoverCover title={artist.name} artist="" person />
          <span className="discoverSongText"><button type="button" className="discoverName" onClick={() => openLink(artist.url)} title={artist.name}>{artist.name}</button>
            <small title={listNames(artist.because)}>Because you play {listNames(artist.because)}{artist.seedCount > artist.because.length ? ` and ${artist.seedCount - artist.because.length} more` : ""}</small>
          </span>
          {!phone && notForMe ? <button type="button" className="discoverPick" aria-label={`Not for me: ${artist.name}`} title="Not for me" onClick={() => dismissArtist(artist.name)}><UserX size={16} /></button> : null}
        </li>)}
      </ul>
    </section> : null>

    {ready && !ready.artists.length && !ready.tracks.length ? <p className="discoverNotice">Nothing new to suggest right now. Try again after listening to more music.</p> : null}

    {picked.size ? <div className="discoverTray" role="region" aria-label="Picked songs">
      <span>{picked.size} song{picked.size === 1 ? "" : "s"} picked</span>
      <button type="button" className="softButton" onClick={() => setPicked(new Map())}>Clear</button>
      <button type="button" className="heroMain" onClick={sendPicked}><Plus size={15} /><span>Send to Downloads</span></button>
    </div> : null}

    {albumOf ? <Suspense fallback={null}><AlbumTracksDialog request={{ title: albumOf.title, artist: albumOf.artist, label: albumOf.title }}
      sendToDownloads={sendToDownloads} onClose={() => setAlbumOf(null)} /></Suspense> : null}
  </section>;
}
