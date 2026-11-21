import "./downloads.css";
import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { AlertCircle, Check, Copy, Download, FolderOpen, Link2, MoreHorizontal, Music2, RotateCcw, Settings2, Wrench, X } from "lucide-react";
import type { DownloadQueueItem, DownloadResult, SpotifyTrack } from "./download.types";
import type { DownloadsTab } from "./useDownloadsRuntime";
import type { Settings, SettingsCategory } from "../settings/settings.types";
import type { Song } from "../library/song.types";
import type { View } from "../shell/view.types";
import { PageHeader } from "../../shared/ui/PageHeader";
import { Cover } from "../covers/Cover";
import { clamp } from "../../shared/utils/format";
import { Button } from "../../vendor/beui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../vendor/beui/tabs";
import SegmentedControl from "../../vendor/arc/segmented-control/segmented-control";
import { DropdownMenu } from "../../vendor/arc/dropdown-menu/dropdown-menu";
import { Progress } from "../../vendor/arc/progress/progress";
import FadeContent from "../../vendor/react-bits/FadeContent";

export type DownloadsViewProps = {
  cancelCurrentDownload: () => unknown;
  changeView: (view: View, source?: "nav" | "onboarding" | "settings" | "unknown") => unknown;
  clearFailedDownloads: () => unknown;
  clearFinishedDownloads: () => unknown;
  convertBusy: boolean;
  convertLocalMedia: () => unknown;
  convertMessage: string;
  convertProgress: number;
  copyDownloadError: (message?: string) => unknown;
  downloadAudioLinks: (overrideText?: string) => unknown;
  downloadBusy: boolean;
  downloadSpotifyTracks: (tracks?: SpotifyTrack[]) => unknown;
  downloadStatusLabel: (status: string) => string;
  downloadText: string;
  downloadsTab: DownloadsTab;
  failedDownloadQueueItems: DownloadQueueItem[];
  fetchSpotifyTracks: () => unknown;
  finishedDownloadQueueItems: DownloadQueueItem[];
  handleSpotifyLogin: () => unknown;
  handleSpotifyLogout: () => unknown;
  openDownloadedSongInLibrary: (item: DownloadResult | DownloadQueueItem) => unknown;
  retryDownload: (url: string, source: "youtube" | "spotify" | "auto", spotifyTrackId?: string, recoveryId?: string) => unknown;
  retryFailedDownloads: () => unknown;
  retrySpotifyTrack: (track: SpotifyTrack) => unknown;
  setDownloadText: Dispatch<SetStateAction<string>>;
  setDownloadsTab: Dispatch<SetStateAction<DownloadsTab>>;
  setSettingsCategory: Dispatch<SetStateAction<SettingsCategory>>;
  setSpotifyFetchError: Dispatch<SetStateAction<string>>;
  setSpotifySelectedIds: Dispatch<SetStateAction<Set<string>>>;
  setSpotifyTracks: Dispatch<SetStateAction<SpotifyTrack[]>>;
  setSpotifyUrl: Dispatch<SetStateAction<string>>;
  settings: Settings;
  spotifyDownloadBusy: boolean;
  spotifyFetchBusy: boolean;
  spotifyFetchError: string;
  spotifyLoggedIn: boolean;
  spotifyLoginBusy: boolean;
  spotifySelectedIds: Set<string>;
  spotifyTrackStatusLabel: (track: SpotifyTrack, selected: boolean) => string;
  spotifyTracks: SpotifyTrack[];
  spotifyUrl: string;
  visibleDownloadQueueItems: DownloadQueueItem[];
  visibleDownloadResults: DownloadResult[];
  songs: Song[];
};


type QueueFilter = "all" | "active" | "attention" | "completed";
const FILTERS: { value: QueueFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "attention", label: "Attention" },
  { value: "completed", label: "Completed" }
];
const ACTIVE = new Set(["queued", "downloading", "converting", "importing"]);
const ATTENTION = new Set(["failed", "cancelled", "interrupted"]);
const isActive = (status: string) => ACTIVE.has(status);
const needsAttention = (status: string) => ATTENTION.has(status);
const identity = (item: { recoveryId?: string; source?: string; spotifyTrackId?: string; url?: string }) =>
  item.recoveryId ? "job:" + item.recoveryId
    : item.source === "spotify" && item.spotifyTrackId ? "spotify:" + item.spotifyTrackId
      : item.url ? "source:" + (item.source || "youtube") + ":" + item.url : "";

function DownloadArtwork({ song, remoteUrl }: { song?: Song; remoteUrl?: string }) {
  const [failed, setFailed] = useState("");
  if (song) return <Cover song={song} className="downloadsArt" preferThumbnail priority="low" />;
  if (remoteUrl && failed !== remoteUrl) {
    return <span className="downloadsArt"><img src={remoteUrl} alt="" loading="lazy" decoding="async"
      referrerPolicy="no-referrer" onError={() => setFailed(remoteUrl)} draggable={false} /></span>;
  }
  return <span className="downloadsArt downloadsArtFallback" aria-hidden="true"><Music2 size={20} /></span>;
}

export default function DownloadsView(props: DownloadsViewProps) {
  const {
    cancelCurrentDownload, changeView, clearFailedDownloads, clearFinishedDownloads,
    convertBusy, convertLocalMedia, convertMessage, convertProgress, copyDownloadError,
    downloadAudioLinks, downloadBusy, downloadSpotifyTracks, downloadStatusLabel,
    downloadText, downloadsTab, failedDownloadQueueItems, fetchSpotifyTracks,
    finishedDownloadQueueItems, handleSpotifyLogin, handleSpotifyLogout,
    openDownloadedSongInLibrary, retryDownload, retryFailedDownloads, retrySpotifyTrack,
    setDownloadText, setDownloadsTab, setSettingsCategory, setSpotifyFetchError,
    setSpotifySelectedIds, setSpotifyTracks, setSpotifyUrl, settings,
    spotifyDownloadBusy, spotifyFetchBusy, spotifyFetchError, spotifyLoggedIn,
    spotifyLoginBusy, spotifySelectedIds, spotifyTrackStatusLabel, spotifyTracks, spotifyUrl,
    visibleDownloadQueueItems, visibleDownloadResults, songs
  } = props;
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const songById = useMemo(() => new Map(songs.map(song => [song.id, song])), [songs]);
  const trackById = useMemo(() => new Map(spotifyTracks.map(track => [track.id, track])), [spotifyTracks]);

  // Results are historical snapshots, not a second list of the same active jobs.
  const activity = useMemo(() => {
    const present = new Set(visibleDownloadQueueItems.map(identity).filter(Boolean));
    const recovered: DownloadQueueItem[] = [];
    for (const [index, result] of visibleDownloadResults.entries()) {
      const key = identity(result);
      if (key && present.has(key)) continue;
      if (key) present.add(key);
      recovered.push({
        id: result.recoveryId || "result-" + index,
        recoveryId: result.recoveryId,
        source: result.source,
        spotifyTrackId: result.spotifyTrackId,
        url: result.url || "",
        title: result.matchedTitle || result.filename || result.url || "Download",
        status: result.status || (result.ok ? "done" : "failed"),
        progress: result.ok ? 100 : 0,
        message: result.statusLabel || (result.ok ? "Downloaded" : "Download failed"),
        filename: result.filename,
        filePath: result.filePath,
        librarySongId: result.librarySongId,
        importedToLibrary: result.importedToLibrary,
        error: result.error
      });
    }
    return [...visibleDownloadQueueItems, ...recovered];
  }, [visibleDownloadQueueItems, visibleDownloadResults]);

  const counts = useMemo(() => ({
    active: activity.filter(item => isActive(item.status)).length,
    attention: activity.filter(item => needsAttention(item.status)).length,
    done: activity.filter(item => item.status === "done").length
  }), [activity]);
  const visible = activity.filter(item => queueFilter === "all" ||
    (queueFilter === "active" && isActive(item.status)) ||
    (queueFilter === "attention" && needsAttention(item.status)) ||
    (queueFilter === "completed" && item.status === "done"));
  const working = downloadBusy || spotifyDownloadBusy || convertBusy;
  const clearSpotify = () => {
    setSpotifyTracks([]);
    setSpotifySelectedIds(new Set());
    setSpotifyUrl("");
    setSpotifyFetchError("");
  };
  const openSettings = () => { changeView("settings", "unknown"); setSettingsCategory("downloads"); };
  const tools = [
    { label: "Convert local files", icon: <Wrench size={15} />, onSelect: () => void convertLocalMedia(), disabled: working },
    { label: "Open downloads folder", icon: <FolderOpen size={15} />, onSelect: () => void window.localitfy.openDownloadsFolder(settings.downloadFolder || undefined) },
    { label: "Download settings", icon: <Settings2 size={15} />, onSelect: openSettings },
    ...(downloadsTab === "spotify" ? [
      { label: "Fetch Spotify link", icon: <RotateCcw size={15} />, onSelect: () => void fetchSpotifyTracks(), disabled: !spotifyUrl.trim() || working || spotifyFetchBusy, separatorBefore: true },
      { label: "Select all tracks", onSelect: () => setSpotifySelectedIds(new Set(spotifyTracks.map(track => track.id))), disabled: spotifyDownloadBusy || !spotifyTracks.length },
      { label: "Clear selection", onSelect: () => setSpotifySelectedIds(new Set()), disabled: spotifyDownloadBusy || !spotifySelectedIds.size },
      { label: "Clear Spotify preview", onSelect: clearSpotify, disabled: spotifyDownloadBusy || !spotifyTracks.length },
      { label: spotifyLoggedIn ? "Disconnect Spotify" : "Connect Spotify",
        onSelect: () => void (spotifyLoggedIn ? handleSpotifyLogout() : handleSpotifyLogin()), disabled: spotifyLoginBusy }
    ] : [{ label: "Clear pasted links", icon: <X size={15} />, onSelect: () => setDownloadText(""), disabled: !downloadText.trim(), separatorBefore: true }]),
    { label: "Retry failed", icon: <RotateCcw size={15} />, onSelect: () => void retryFailedDownloads(), disabled: working || (!failedDownloadQueueItems.length && !activity.some(item => needsAttention(item.status))), separatorBefore: true },
    { label: "Clear completed", onSelect: () => void clearFinishedDownloads(), disabled: working || (!finishedDownloadQueueItems.length && !visibleDownloadResults.some(item => item.ok !== false)) },
    { label: "Clear failed or cancelled", onSelect: () => void clearFailedDownloads(), disabled: working || (!failedDownloadQueueItems.length && !visibleDownloadResults.some(item => item.ok === false)), destructive: true }
  ];

  return <section data-page-section="downloads" className="downloadsExperience downloadsLayoutV031">
    <PageHeader title="Downloads" description="Bring music into your library.">
      <Button variant="ghost" size="icon" aria-label="Open downloads folder"
        title="Open downloads folder" onClick={() => void window.localitfy.openDownloadsFolder(settings.downloadFolder || undefined)}>
        <FolderOpen size={17} />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Download settings" title="Download settings" onClick={openSettings}>
        <Settings2 size={17} />
      </Button>
      <div className="downloadsTools"><DropdownMenu label="Tools" icon={<MoreHorizontal size={16} />} items={tools} /></div>
    </PageHeader>

    <section className="downloadsImporter" aria-label="Import music">
      <Tabs value={downloadsTab} onValueChange={value => setDownloadsTab(value as DownloadsTab)} variant="pill" className="downloadsTabs">
        <TabsList className="downloadsTabList">
          <TabsTrigger value="youtube">YouTube</TabsTrigger>
          <TabsTrigger value="spotify">Spotify</TabsTrigger>
        </TabsList>
        <TabsContent value="youtube" className="downloadsSourceContent">
          <label className="downloadsInputLabel" htmlFor="downloads-youtube-links">Paste YouTube links</label>
          <div className="downloadsInputSurface">
            <Link2 size={17} className="downloadsLinkIcon" aria-hidden="true" />
            <textarea id="downloads-youtube-links" data-embedded-field="" className="downloadsLinkInput"
              value={downloadText} onChange={event => setDownloadText(event.currentTarget.value)}
              placeholder="One song or playlist link per line" spellCheck={false} rows={2} />
          </div>
          <div className="downloadsPrimaryRow">
            <span className="downloadsInputHint">Supported links are downloaded to your selected folder.</span>
            <Button variant={downloadBusy ? "secondary" : "primary"} size="md"
              disabled={!downloadBusy && (!downloadText.trim() || working)}
              onClick={() => void (downloadBusy ? cancelCurrentDownload() : downloadAudioLinks())}>
              {downloadBusy ? <X size={16} /> : <Download size={16} />}
              {downloadBusy ? "Cancel download" : "Download"}
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="spotify" className="downloadsSourceContent">
          <div className="downloadsSpotifyStatus">
            <span>{spotifyLoggedIn ? "Spotify connected" : "Spotify public import"}</span>
            <button type="button" className="downloadsTextAction" disabled={spotifyLoginBusy}
              onClick={() => void handleSpotifyLogin()}>{spotifyLoginBusy ? "Connecting…" : spotifyLoggedIn ? "Reconnect" : "Connect account"}</button>
          </div>
          <label className="downloadsInputLabel" htmlFor="downloads-spotify-link">Spotify link</label>
          <div className="downloadsInputSurface downloadsInputSingle">
            <Link2 size={17} className="downloadsLinkIcon" aria-hidden="true" />
            <input id="downloads-spotify-link" type="url" data-embedded-field="" className="downloadsLinkInput"
              placeholder="Playlist, album or track URL" value={spotifyUrl}
              disabled={spotifyFetchBusy || spotifyDownloadBusy}
              onChange={event => { setSpotifyUrl(event.currentTarget.value); setSpotifyFetchError(""); }}
              onKeyDown={event => { if (event.key === "Enter" && spotifyUrl.trim() && !working) void fetchSpotifyTracks(); }} />
            {spotifyTracks.length ? <button type="button" className="downloadsTextAction downloadsFetchInline"
              aria-label="Fetch another Spotify link" title="Fetch Spotify link" disabled={working || !spotifyUrl.trim()}
              onClick={() => void fetchSpotifyTracks()}>Fetch</button> : null}
          </div>
          {spotifyFetchError ? <div className="downloadsInlineError" role="alert">
            <AlertCircle size={16} /><span>{spotifyFetchError}</span>
            <button type="button" className="downloadsTextAction" onClick={() => void copyDownloadError(spotifyFetchError)}>Copy</button>
          </div> : null}
          <div className="downloadsPrimaryRow">
            <span className="downloadsInputHint">{spotifyTracks.length ? spotifySelectedIds.size + " of " + spotifyTracks.length + " selected" : "Select tracks after fetching a link."}</span>
            <Button variant={spotifyDownloadBusy ? "secondary" : "primary"} size="md"
              disabled={!spotifyDownloadBusy && (spotifyFetchBusy || working || (spotifyTracks.length ? !spotifySelectedIds.size : !spotifyUrl.trim()))}
              onClick={() => void (spotifyDownloadBusy ? cancelCurrentDownload() : spotifyTracks.length ? downloadSpotifyTracks() : fetchSpotifyTracks())}>
              {spotifyDownloadBusy ? <X size={16} /> : spotifyTracks.length ? <Download size={16} /> : <Link2 size={16} />}
              {spotifyDownloadBusy ? "Cancel download" : spotifyFetchBusy ? "Fetching…" : spotifyTracks.length ? "Download selected" : "Fetch tracks"}
            </Button>
          </div>
          {spotifyTracks.length ? <div className="downloadsSpotifyPreview" aria-label="Spotify tracks">
            <div className="downloadsPreviewTitle">
              <strong>{spotifyTracks.length} tracks</strong>
              <span>{spotifySelectedIds.size} selected</span>
            </div>
            <div className="downloadsPreviewItems">
              {spotifyTracks.map(track => {
                const selected = spotifySelectedIds.has(track.id);
                const failed = track.downloadStatus === "failed";
                const coverUrl = track.coverUrl || track.spotifyCoverUrl || track.albumCoverUrl;
                return <div className="downloadsPreviewItem" key={track.id}>
                  <button type="button" className="downloadsPreviewSelect" aria-pressed={selected}
                    disabled={spotifyDownloadBusy}
                    onClick={() => setSpotifySelectedIds(previous => {
                      const next = new Set(previous);
                      if (next.has(track.id)) next.delete(track.id); else next.add(track.id);
                      return next;
                    })}>
                    <DownloadArtwork remoteUrl={coverUrl} />
                    <span className="downloadsPreviewCopy">
                      <strong>{track.title}</strong>
                      <small>{track.artist || "Unknown artist"}{track.albumName ? " · " + track.albumName : ""}</small>
                      {track.downloadMessage ? <small>{track.downloadMessage}</small> : null}
                      {track.downloadError ? <small className="downloadsErrorText">{track.downloadError}</small> : null}
                    </span>
                    <span className={selected ? "downloadsSelectMark selected" : "downloadsSelectMark"} aria-hidden="true">{selected ? <Check size={13} /> : null}</span>
                  </button>
                  {failed ? <button type="button" className="downloadsRowAction" disabled={spotifyDownloadBusy} onClick={() => void retrySpotifyTrack(track)}>Retry</button>
                    : <span className="downloadsTrackStatus">{spotifyTrackStatusLabel(track, selected)}</span>}
                </div>;
              })}
            </div>
          </div> : null}
        </TabsContent>
      </Tabs>
    </section>

    {convertBusy ? <div className="downloadsConversion" role="status">
      <span>{convertMessage || "Converting local files…"}</span>
      <Progress value={clamp(convertProgress, 0, 100)} label="Conversion progress" />
      <button type="button" className="downloadsTextAction" onClick={() => void cancelCurrentDownload()}>Cancel</button>
    </div> : null}

    <section className="downloadsActivity" aria-label="Download activity">
      <div className="downloadsActivityHead">
        <div className="downloadsActivityTitle">
          <h2>Activity</h2>
          <p aria-live="polite">{counts.active ? counts.active + " active" : "No active downloads"}
            {counts.attention ? " · " + counts.attention + " need attention" : ""}
            {counts.done ? " · " + counts.done + " completed" : ""}</p>
        </div>
        <SegmentedControl label="Filter download activity" value={queueFilter} options={FILTERS}
          onValueChange={value => setQueueFilter(value as QueueFilter)} className="downloadsFilters" />
      </div>
      <div className="downloadsActivityList">
        {!visible.length ? <FadeContent trigger="mount" duration={220} once className="downloadsEmpty">
          <Music2 size={24} aria-hidden="true" />
          <strong>{activity.length ? "Nothing here yet" : "Your downloads will appear here"}</strong>
          <p>{activity.length ? "Choose another filter to view your downloads." : "Paste a link above to get started."}</p>
        </FadeContent> : visible.map(item => {
          const track = item.spotifyTrackId ? trackById.get(item.spotifyTrackId) : undefined;
          const song = item.librarySongId ? songById.get(item.librarySongId) : undefined;
          const primary = track?.title || song?.title || item.title || item.filename || "Download";
          const artist = track?.artist || song?.artist || "";
          const displayTitle = !artist && primary.includes(" — ") ? primary.split(" — ").slice(1).join(" — ") : primary;
          const displayArtist = artist || (primary.includes(" — ") ? primary.split(" — ")[0] : (item.source === "spotify" ? "Spotify" : "YouTube"));
          const attention = needsAttention(item.status);
          const done = item.status === "done";
          const notImported = done && item.importedToLibrary === false;
          const active = isActive(item.status);
          const canRetry = attention && Boolean(item.url || item.source === "local");
          const retry = () => void (item.source === "local" ? convertLocalMedia() :
            retryDownload(item.url, item.source === "spotify" ? "spotify" : "youtube", item.spotifyTrackId || "", item.recoveryId));
          const actions = [
            ...(canRetry ? [{ label: item.status === "interrupted" ? "Resume download" : "Retry download",
              icon: <RotateCcw size={15} />, onSelect: retry, disabled: working }] : []),
            ...(done && !notImported ? [{ label: "Open in library", icon: <Music2 size={15} />,
              onSelect: () => void openDownloadedSongInLibrary(item) }] : []),
            { label: "Open downloads folder", icon: <FolderOpen size={15} />,
              onSelect: () => void window.localitfy.openDownloadsFolder(settings.downloadFolder || undefined) },
            ...(attention ? [{ label: "Copy error", icon: <Copy size={15} />,
              onSelect: () => void copyDownloadError(item.error || item.message || item.url) }] : [])
          ];
          return <div key={item.recoveryId || item.id} className="downloadsActivityRow">
            <DownloadArtwork song={song} remoteUrl={track?.coverUrl || track?.albumCoverUrl || track?.spotifyCoverUrl} />
            <div className="downloadsActivityCopy">
              <strong title={displayTitle}>{displayTitle}</strong>
              <span title={displayArtist}>{displayArtist}</span>
              <div className="downloadsActivityMeta">
                <span className={attention ? "downloadsErrorText" : ""}>{notImported ? "Downloaded · not imported" : item.statusLabel || downloadStatusLabel(item.status)}</span>
                {active && item.speed ? <span>{item.speed}</span> : null}
                {active && item.eta ? <span>ETA {item.eta}</span> : null}
                {attention && item.error ? <span className="downloadsErrorText" title={item.error}>{item.error}</span> : null}
              </div>
              {active ? <Progress value={clamp(item.progress, 0, 100)} label={"Download progress for " + displayTitle} /> : null}
            </div>
            <div className="downloadsActivityActions">
              {active ? <small>{Math.round(clamp(item.progress, 0, 100))}%</small> : null}
              {attention && canRetry ? <button type="button" className="downloadsRowAction" disabled={working} onClick={retry}>
                {item.status === "interrupted" ? "Resume" : "Retry"}</button> : null}
              {done && !notImported ? <button type="button" className="downloadsRowAction" onClick={() => void openDownloadedSongInLibrary(item)}>Open</button> : null}
              {done && !notImported ? <Check size={14} className="downloadsCompleteIcon" aria-hidden="true" /> : null}
              <div className="downloadsRowMenu"><DropdownMenu label="More actions" icon={<MoreHorizontal size={16} />} items={actions} iconOnly /></div>
            </div>
          </div>;
        })}
      </div>
    </section>
  </section>;
}
