import "./downloads.css";
import { CheckMiniIcon, ResultStatusIcon } from "../../shared/ui/LocaltifyViewUi";
import { clamp } from "../../shared/utils/format";

export type DownloadsViewProps = {
  cancelCurrentDownload: any;
  changeView: any;
  clearFailedDownloads: any;
  clearFinishedDownloads: any;
  convertBusy: any;
  convertLocalMedia: any;
  convertMessage: any;
  convertProgress: any;
  copyDownloadError: any;
  downloadAudioLinks: any;
  downloadBusy: any;
  downloadSpotifyTracks: any;
  downloadStatusLabel: any;
  downloadText: any;
  downloadsTab: any;
  failedDownloadQueueItems: any;
  failedDownloadResults: any;
  fetchSpotifyTracks: any;
  finishedDownloadQueueItems: any;
  handleSpotifyLogin: any;
  handleSpotifyLogout: any;
  openDownloadedSongInLibrary: any;
  retryDownload: any;
  retryFailedDownloads: any;
  retrySpotifyTrack: any;
  setDownloadText: any;
  setDownloadsTab: any;
  setSettingsCategory: any;
  setSpotifyFetchError: any;
  setSpotifySelectedIds: any;
  setSpotifyTracks: any;
  setSpotifyUrl: any;
  settings: any;
  spotifyDownloadBusy: any;
  spotifyFetchBusy: any;
  spotifyFetchError: any;
  spotifyLoggedIn: any;
  spotifyLoginBusy: any;
  spotifySelectedIds: any;
  spotifyTrackStatusLabel: any;
  spotifyTracks: any;
  spotifyUrl: any;
  visibleDownloadQueueItems: any;
  visibleDownloadResults: any;
};

export default function DownloadsView(props: DownloadsViewProps) {
  const {
    cancelCurrentDownload,
    changeView,
    clearFailedDownloads,
    clearFinishedDownloads,
    convertBusy,
    convertLocalMedia,
    convertMessage,
    convertProgress,
    copyDownloadError,
    downloadAudioLinks,
    downloadBusy,
    downloadSpotifyTracks,
    downloadStatusLabel,
    downloadText,
    downloadsTab,
    failedDownloadQueueItems,
    failedDownloadResults,
    fetchSpotifyTracks,
    finishedDownloadQueueItems,
    handleSpotifyLogin,
    handleSpotifyLogout,
    openDownloadedSongInLibrary,
    retryDownload,
    retryFailedDownloads,
    retrySpotifyTrack,
    setDownloadText,
    setDownloadsTab,
    setSettingsCategory,
    setSpotifyFetchError,
    setSpotifySelectedIds,
    setSpotifyTracks,
    setSpotifyUrl,
    settings,
    spotifyDownloadBusy,
    spotifyFetchBusy,
    spotifyFetchError,
    spotifyLoggedIn,
    spotifyLoginBusy,
    spotifySelectedIds,
    spotifyTrackStatusLabel,
    spotifyTracks,
    spotifyUrl,
    visibleDownloadQueueItems,
    visibleDownloadResults
  } = props;

  return (

              <section data-page-section="downloads" className="downloadsLayout downloadsLayoutV031">
                <section className="panel downloadPanel downloadPanelV031">
                  <div className="panelHead downloadHeroHead">
                    <div>
                      <p className="eyebrow">downloads</p>
                      <h3>download music</h3>
                    </div>

                    <div className="downloadHeroActions downloadHeroActionsCompactV475">
                      <button className="softButton" onClick={() => window.localitfy.openDownloadsFolder(settings.downloadFolder || undefined)}>
                        Open folder
                      </button>
                      <button className="softButton" onClick={() => { changeView("settings", "unknown"); setSettingsCategory("downloads"); }}>
                        Settings
                      </button>
                    </div>
                  </div>

                  <div className="downloadsInputCard" aria-label="Download source and links">
                    <div className="downloadsInputTitle"><strong>Add music</strong><span>Paste links to download or import.</span></div>
                  {/* -- Source tabs -------------------------------- */}
                  <div className="downloadTabStrip" role="group" aria-label="Download source">
                    <button
                      className={downloadsTab === "youtube" ? "downloadTab active" : "downloadTab"} type="button" aria-pressed={downloadsTab === "youtube"}
                      onClick={() => setDownloadsTab("youtube")}
                    >
                      YouTube
                    </button>
                    <button
                      className={downloadsTab === "spotify" ? "downloadTab active spotifyTab" : "downloadTab"} type="button" aria-pressed={downloadsTab === "spotify"}
                      onClick={() => setDownloadsTab("spotify")}
                    >
                      <span className="spotifyTabDot" aria-hidden="true" />
                      Spotify
                    </button>
                  </div>

                  {/* -- YouTube tab --------------------------------- */}
                  {downloadsTab === "youtube" && (
                    <>
                       <textarea
                        className="downloadTextarea downloadTextareaV031"
                        aria-label="YouTube URLs"
                         value={downloadText}
                        onChange={(event) => setDownloadText(event.currentTarget.value)}
                        placeholder="Paste YouTube links, one per line"
                      />

                      <div className="downloadActions downloadActionsV031">
                        <button className="heroMain" onClick={() => void downloadAudioLinks()} disabled={downloadBusy}>
                          {downloadBusy ? "downloading..." : "start download"}
                        </button>

                        {downloadBusy ? (
                          <button className="heroGhost dangerGhost" onClick={() => void cancelCurrentDownload()}>
                            cancel download
                          </button>
                        ) : (
                          <button className="heroGhost" onClick={() => setDownloadText("")}>clear links</button>
                        )}

                       </div>
                    </>
                  )}

                  {/* -- Spotify tab --------------------------------- */}
                  {downloadsTab === "spotify" && (
                    <>
                      {/* -- Auth status card -- */}
                      <div className={`spotifyAuthCard${spotifyLoggedIn ? " loggedIn" : ""}`}>
                        <div className="spotifyAuthLeft">
                          <span className="spotifyAuthDot" aria-hidden="true" />
                          <div>
                            <strong>{spotifyLoggedIn ? "Spotify connected" : "Spotify import"}</strong>
                            <p>Paste a public Spotify link and choose what to fetch.</p>
                          </div>
                        </div>
                        <div className="spotifyAuthActions">
                          <button
                            className="heroMain spotifyAuthBtn"
                            onClick={() => void handleSpotifyLogin()}
                            disabled={spotifyLoginBusy}
                          >
                            {spotifyLoginBusy ? "opening..." : spotifyLoggedIn ? "reconnect" : "connect spotify"}
                          </button>
                          {spotifyLoggedIn ? (
                            <button
                              className="softButton spotifyAuthBtn"
                              onClick={() => void handleSpotifyLogout()}
                              disabled={spotifyLoginBusy}
                            >
                              disconnect
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {/* -- URL fetch -- */}
                       <div className="spotifyUrlRow">
                        <input
                          type="url"
                          className="downloadTextarea downloadTextareaV031 spotifyUrlInput"
                          value={spotifyUrl}
                          onChange={(e) => { setSpotifyUrl(e.currentTarget.value); setSpotifyFetchError(""); }}
                          placeholder="paste spotify playlist, album, or track link"
                          disabled={spotifyFetchBusy || spotifyDownloadBusy}
                          onKeyDown={(e) => { if (e.key === "Enter" && spotifyUrl.trim()) void fetchSpotifyTracks(); }}
                        />
                        <button
                          className="heroMain spotifyFetchButton"
                          onClick={() => void fetchSpotifyTracks()}
                          disabled={spotifyFetchBusy || spotifyDownloadBusy || !spotifyUrl.trim()}
                        >
                          {spotifyFetchBusy ? "fetching..." : "fetch"}
                        </button>
                      </div>

                      {spotifyFetchError ? (
                        <div className="spotifyError spotifyErrorV326 spotifyErrorMascotV502 spotifyErrorNoMascotV511">
                          <div>
                            <strong>Spotify needs attention</strong>
                            <span>{spotifyFetchError}</span>
                          </div>
                          <button className="softButton" type="button" onClick={() => void copyDownloadError(spotifyFetchError)}>
                            copy error
                          </button>
                        </div>
                      ) : null}

                      {/* -- Track list -- */}
                      {spotifyTracks.length > 0 && (
                        <div className="spotifyTrackList">
                          <div className="spotifyTrackListHead">
                            <strong>{spotifyTracks.length} track{spotifyTracks.length !== 1 ? "s" : ""} found</strong>
                            <div className="spotifySelectActions">
                              <button
                                className="softButton"
                                onClick={() => setSpotifySelectedIds(new Set(spotifyTracks.map((t) => t.id)))}
                                disabled={spotifyDownloadBusy}
                              >
                                all
                              </button>
                              <button
                                className="softButton"
                                onClick={() => setSpotifySelectedIds(new Set())}
                                disabled={spotifyDownloadBusy}
                              >
                                none
                              </button>
                            </div>
                          </div>

                          <div className="spotifyTrackItems">
                            {spotifyTracks.map((track, i) => {
                              const selected = spotifySelectedIds.has(track.id);
                              const statusLabel = spotifyTrackStatusLabel(track, selected);
                              const failed = track.downloadStatus === "failed";
                              const done = track.downloadStatus === "done";
                              const coverUrl = track.coverUrl || track.spotifyCoverUrl || track.albumCoverUrl;

                              return (
                                <button
                                  key={track.id}
                                  className={`spotifyTrackItem spotifyTrackItemV326${selected ? " selected" : ""}${failed ? " failed" : ""}${done ? " done" : ""}`}
                                  type="button"
                                  disabled={spotifyDownloadBusy}
                                  onClick={() => {
                                    setSpotifySelectedIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(track.id)) next.delete(track.id);
                                      else next.add(track.id);
                                      return next;
                                    });
                                  }}
                                >
                                  {coverUrl ? (
                                    <span className="spotifyTrackArt" aria-hidden="true">
                                      <img src={coverUrl} alt="" width={56} height={56} loading="lazy" decoding="async" fetchPriority="low" referrerPolicy="no-referrer" draggable={false} />
                                    </span>
                                  ) : (
                                    <span className="spotifyTrackIndex">{String(i + 1).padStart(2, "0")}</span>
                                  )}
                                  <div className="spotifyTrackMeta">
                                    <div className="spotifyTrackTitleLine">
                                      <strong>{track.title}</strong>
                                      <span className="spotifySourceBadge">Spotify</span>
                                      <span className={`spotifyTrackStatus ${statusLabel.replace(/\s+/g, "-")}`}>{statusLabel}</span>
                                    </div>
                                    <p>{track.artist || "artist will be matched during download"}{track.albumName ? ` · ${track.albumName}` : ""}</p>
                                    {track.downloadMessage ? <small>{track.downloadMessage}</small> : null}
                                    {track.downloadError ? <small className="spotifyTrackError">{track.downloadError}</small> : null}
                                  </div>
                                  <span className="spotifyTrackCheck" aria-hidden="true">{selected ? <CheckMiniIcon /> : null}</span>
                                  {failed ? (
                                    <span
                                      className="spotifyRetryButton"
                                      role="button"
                                      tabIndex={0}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void retrySpotifyTrack?.(track);
                                      }}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          void retrySpotifyTrack?.(track);
                                        }
                                      }}
                                    >
                                      retry
                                    </span>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>

                          <div className="downloadActions downloadActionsV031 spotifyDownloadRow">
                            <button
                              className="heroMain spotifyDownloadButton"
                              onClick={() => void downloadSpotifyTracks()}
                              disabled={spotifyDownloadBusy || !spotifySelectedIds.size}
                            >
                              {spotifyDownloadBusy
                                ? "downloading..."
                                : `download ${spotifySelectedIds.size} track${spotifySelectedIds.size !== 1 ? "s" : ""}`}
                            </button>
                            {spotifyDownloadBusy ? (
                              <button className="heroGhost dangerGhost" onClick={() => void cancelCurrentDownload()}>
                                cancel
                              </button>
                            ) : (
                              <button
                                className="heroGhost"
                                onClick={() => {
                                  setSpotifyTracks([]);
                                  setSpotifySelectedIds(new Set());
                                  setSpotifyUrl("");
                                  setSpotifyFetchError("");
                                }}
                              >
                                clear
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  </div>
                  {/* -- Shared: queue, converter, results ----------- */}
                  {visibleDownloadQueueItems.length ? (
                    <div className="downloadQueuePanel">
                      <div className="panelHead smallPanelHead">
                        <div>
                          <p className="eyebrow">queue</p>
                          <h3>{visibleDownloadQueueItems.length} item{visibleDownloadQueueItems.length === 1 ? "" : "s"}</h3>
                        </div>
                        <div className="downloadQueueHeaderActions downloadQueueHeaderActionsV502">
                          <span>{downloadBusy ? "working" : failedDownloadQueueItems.length ? "needs attention" : "ready"}</span>
                          <button
                            className="softButton tinyDownloadAction"
                            onClick={() => window.localitfy.openDownloadsFolder(settings.downloadFolder || undefined)}
                          >
                            folder
                          </button>
                          <button
                            className="softButton tinyDownloadAction"
                            onClick={retryFailedDownloads}
                            disabled={downloadBusy || !failedDownloadQueueItems.length}
                          >
                            retry failed
                          </button>
                          <button
                            className="softButton tinyDownloadAction"
                            onClick={() => clearFinishedDownloads?.()}
                            disabled={downloadBusy || !finishedDownloadQueueItems.length}
                          >
                            clear finished
                          </button>
                          <button
                            className="softButton tinyDownloadAction dangerTinyDownloadActionV502"
                            onClick={() => clearFailedDownloads?.()}
                            disabled={downloadBusy || !failedDownloadQueueItems.length}
                            title="clear failed/cancelled items from the queue"
                          >
                            clear failed
                          </button>
                        </div>
                      </div>

                      <div className="downloadQueueList">
                        {visibleDownloadQueueItems.map((item, index) => {
                          const done = item.status === "done";
                          const failed = item.status === "failed" || item.status === "cancelled";
                          const downloadedNotImported = done && item.importedToLibrary === false;
                          const sourceLabel = item.source === "spotify" ? "Spotify" : "YouTube";

                          return (
                            <div
                              key={`${item.id}-${index}`}
                              className={`downloadQueueItem downloadQueueItemV338 ${item.status}${done ? " compactDone" : ""}${downloadedNotImported ? " notImported" : ""}`}
                            >
                              <div className="downloadQueueTop">
                                <span className="downloadQueueIndex">{String(index + 1).padStart(2, "0")}</span>
                                <div>
                                  <strong>{item.filename || item.title}</strong>
                                  <p>{item.message || downloadStatusLabel(item.status)}</p>
                                </div>
                                <small>{done ? "100%" : `${item.progress}%`}</small>
                              </div>

                              {!done || downloadedNotImported ? (
                                <div className="downloadQueueTrack"><i style={{ width: `${clamp(item.progress, 0, 100)}%` }} /></div>
                              ) : null}

                              <div className="downloadQueueMeta">
                                <span className="downloadSourceBadgeV338">{sourceLabel}</span>
                                <span>{item.statusLabel || downloadStatusLabel(item.status)}</span>
                                {item.speed ? <span>{item.speed}</span> : null}
                                {item.eta ? <span>ETA {item.eta}</span> : null}
                                {downloadedNotImported ? <span className="downloadWarnBadgeV338">downloaded, not imported</span> : null}
                                {item.error ? <span className="downloadErrorBadgeV338">{item.error}</span> : null}
                              </div>

                              <div className="downloadQueueActions">
                                {failed ? (
                                  <>
                                    <button className="softButton downloadRetryButtonV502" onClick={() => void retryDownload(item.url, item.source === "spotify" ? "spotify" : "youtube", item.spotifyTrackId || "")}>retry</button>
                                    <button className="softButton" onClick={() => void copyDownloadError(item.error || item.message || item.url)}>copy error</button>
                                  </>
                                ) : null}
                                {done && item.importedToLibrary !== false ? (
                                  <button className="softButton" onClick={() => openDownloadedSongInLibrary(item)}>open in library</button>
                                ) : null}
                                {downloadedNotImported ? (
                                  <button className="softButton" onClick={() => window.localitfy.openDownloadsFolder(settings.downloadFolder || undefined)}>open folder</button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="converterBox converterBoxV031">
                    <div>
                      <strong>Convert local files</strong>
                      <p>Convert audio and video to music files.</p>
                    </div>

                    <button className="heroMain" onClick={convertLocalMedia} disabled={convertBusy}>
                      {convertBusy ? "converting..." : "choose files"}
                    </button>


                    {convertBusy ? (
                      <div className="converterProgress">
                        <div>
                          <span>{convertMessage || "working..."}</span>
                          <strong>{convertProgress}%</strong>
                        </div>

                        <div className="converterTrack">
                          <i style={{ width: `${convertProgress}%` }} />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {visibleDownloadResults.length ? (
                    <div className="downloadResults downloadResultsV031 downloadResultsGlowV502">
                      <div className="downloadResultsHeadV502">
                        <strong>finished downloads</strong>
                        <div>
                          <button className="softButton tinyDownloadAction" type="button" onClick={() => window.localitfy.openDownloadsFolder(settings.downloadFolder || undefined)}>
                            open folder
                          </button>
                          <button className="softButton tinyDownloadAction" type="button" onClick={() => clearFinishedDownloads?.()} disabled={downloadBusy}>
                            clear finished
                          </button>
                        </div>
                      </div>

                      {visibleDownloadResults.map((item: any, index) => {
                        const imported = item.importedToLibrary !== false;
                        const failed = !item.ok;
                        return (
                          <div
                            key={`${item.url || item.filename || index}`}
                            className={failed ? "downloadResult bad downloadResultV326" : imported ? "downloadResult ok downloadResultV326" : "downloadResult warn downloadResultV326"}
                          >
                            <span><ResultStatusIcon failed={failed} imported={imported} /></span>

                            <div>
                              <strong>{failed ? "Download failed" : imported ? "Added to library" : "Downloaded, not imported"}</strong>
                              <p>
                                {failed
                                  ? item.error || item.url || "unknown error"
                                  : imported
                                    ? item.filename || item.url || "downloaded audio"
                                    : "The file downloaded, but Localtify did not find it in the library. Check auto-add and the downloads folder."}
                              </p>
                              {!failed && imported ? <small className="downloadResultAddedV338">added to library</small> : null}
                              {!failed && !imported ? <small className="downloadResultWarnV338">downloaded, not imported</small> : null}
                            </div>

                            {failed ? (
                              <span className="downloadResultActionsV502">
                                <button className="softButton downloadRetryButtonV502" onClick={() => void retryDownload(item.url || "", item.source === "spotify" ? "spotify" : "youtube", item.spotifyTrackId || "")}>retry</button>
                                <button className="softButton" onClick={() => void copyDownloadError(item.error || item.url || item.filename)}>copy error</button>
                              </span>
                            ) : imported ? (
                              <button className="softButton" onClick={() => openDownloadedSongInLibrary(item)}>open in library</button>
                            ) : (
                              <button className="softButton" onClick={() => window.localitfy.openDownloadsFolder(settings.downloadFolder || undefined)}>open folder</button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </section>
              </section>
            
  );
}
