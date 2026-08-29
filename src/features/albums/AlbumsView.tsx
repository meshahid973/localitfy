import type { CSSProperties } from "react";
import { Cover } from "../covers/Cover";
import { CheckMiniIcon, EmptyCoverIcon, LocaltifyStateCard, PlusMiniIcon } from "../../shared/ui/LocaltifyViewUi";
import { LikeHeartAnimationV443 } from "../library/components/SongRows";
import { formatTime, toCssUrl } from "../../shared/utils/format";
import { getSongAmbientSource } from "../covers/cover.ambient";
import { prettyMeta, prettyTitle } from "../search/search.utils";

export type AlbumsViewProps = {
  albumBuilderOpen: any;
  albumBuilderMode: any;
  albumDeleteConfirmArmed: any;
  albumDraftArtist: any;
  albumDraftArtistNames: any;
  albumDraftArtistPreview: any;
  albumDraftArtistSuggestion: any;
  albumDraftCoverUrl: any;
  albumDraftHasVariousArtists: any;
  albumDraftPreviewCoverSong: any;
  albumDraftSearch: any;
  albumDraftSearchResults: any;
  albumDraftSongIds: any;
  albumDraftTitle: any;
  albumDraftYear: any;
  albumFolderImportBusy: any;
  albumFolderImportMessage: any;
  albumFolderImportPreview: any;
  albumFolderImportProgress: any;
  albumSearch: any;
  albumSortMode: any;
  manualAlbums: any;
  setAlbumDraftArtist: any;
  setAlbumDraftSearch: any;
  setAlbumDraftTitle: any;
  setAlbumDraftYear: any;
  setAlbumSearch: any;
  setAlbumSortMode: any;
  setSelectedAlbumId: any;
  albumBuilderSectionRef: any;
  albumCoverInputRef: any;
  cancelAlbumFolderImportPreview: any;
  clearAlbumDraftCover: any;
  closeAlbumBuilder: any;
  commitAlbumFolderImportPreview: any;
  currentId: any;
  currentSong: any;
  deleteAllAlbums: any;
  deleteManualAlbum: any;
  deleteSelectedAlbum: any;
  handleAlbumCoverFile: any;
  localAlbums: any;
  manualAlbumEntries: any;
  metadataAlbums: any;
  openAlbumCoverPicker: any;
  openCreateAlbumBuilder: any;
  openEditAlbumBuilder: any;
  openPlaylistPicker: any;
  playAlbumSongs: any;
  queueAlbumSongs: any;
  ready: any;
  saveManualAlbumFromDraft: any;
  scanAlbumFolderImport: any;
  selectSong: any;
  selectedAlbum: any;
  selectedAlbumIds: any;
  selectedAlbumIsFolder: any;
  selectedAlbumIsManual: any;
  shuffleAlbumSongs: any;
  songs: any;
  toggleAlbumDraftSong: any;
  toggleLike: any;
  visibleAlbums: any;
};

export default function AlbumsView(props: AlbumsViewProps) {
  const {
    albumBuilderOpen,
    albumBuilderMode,
    albumDeleteConfirmArmed,
    albumDraftArtist,
    albumDraftArtistNames,
    albumDraftArtistPreview,
    albumDraftArtistSuggestion,
    albumDraftCoverUrl,
    albumDraftHasVariousArtists,
    albumDraftPreviewCoverSong,
    albumDraftSearch,
    albumDraftSearchResults,
    albumDraftSongIds,
    albumDraftTitle,
    albumDraftYear,
    albumFolderImportBusy,
    albumFolderImportMessage,
    albumFolderImportPreview,
    albumFolderImportProgress,
    albumSearch,
    albumSortMode,
    manualAlbums,
    setAlbumDraftArtist,
    setAlbumDraftSearch,
    setAlbumDraftTitle,
    setAlbumDraftYear,
    setAlbumSearch,
    setAlbumSortMode,
    setSelectedAlbumId,
    albumBuilderSectionRef,
    albumCoverInputRef,
    cancelAlbumFolderImportPreview,
    clearAlbumDraftCover,
    closeAlbumBuilder,
    commitAlbumFolderImportPreview,
    currentId,
    currentSong,
    deleteAllAlbums,
    deleteManualAlbum,
    deleteSelectedAlbum,
    handleAlbumCoverFile,
    localAlbums,
    manualAlbumEntries,
    metadataAlbums,
    openAlbumCoverPicker,
    openCreateAlbumBuilder,
    openEditAlbumBuilder,
    openPlaylistPicker,
    playAlbumSongs,
    queueAlbumSongs,
    saveManualAlbumFromDraft,
    scanAlbumFolderImport,
    selectSong,
    selectedAlbum,
    selectedAlbumIds,
    selectedAlbumIsFolder,
    selectedAlbumIsManual,
    shuffleAlbumSongs,
    songs,
    toggleAlbumDraftSong,
    toggleLike,
    visibleAlbums
  } = props;

  return (

              <section data-page-section="albums" className="albumsPageV318">
                <section className="albumsHeroPanelV318">
                  <div className="albumsHeroArtClusterV318" aria-hidden="true">
                    {(selectedAlbum?.songs || localAlbums[0]?.songs || songs).slice(0, 4).map((song, index) => (
                      <Cover key={`${song.id}-${index}`} song={song} className={`albumsHeroMiniCoverV318 cover${index + 1}`} />
                    ))}
                  </div>
                  <div className="albumsHeroCopyV318">
                    <p className="eyebrow">local albums</p>
                    <h3>your albums your way</h3>
                    <p>
                      group albums from file tags, build your own, or import real album folders from disk.
                    </p>
                    <div className="albumsHeroActionsV318">
                      <button className="mainAction" type="button" onClick={() => openCreateAlbumBuilder(currentSong || songs[0] || null)}>add album</button>
                      <button className="heroGhost" type="button" onClick={() => void scanAlbumFolderImport("single")} disabled={albumFolderImportBusy}>import album folder</button>
                      <button className="heroGhost" type="button" onClick={() => void scanAlbumFolderImport("library")} disabled={albumFolderImportBusy}>import album library</button>
                      <button className={`heroGhost danger ${albumDeleteConfirmArmed ? "confirmArmed" : ""}`} type="button" onClick={() => void deleteAllAlbums()} disabled={!manualAlbums.length && !metadataAlbums.length}>{albumDeleteConfirmArmed ? "sure? delete" : "delete all albums"}</button>
                    </div>
                  </div>
                  <div className="albumsHeroStatsV318" aria-label="album summary">
                    <span><strong>{localAlbums.length}</strong><small>albums</small></span>
                    <span><strong>{manualAlbumEntries.length}</strong><small>made by you</small></span>
                    <span><strong>{metadataAlbums.length}</strong><small>from tags</small></span>
                  </div>
                </section>

                {(albumFolderImportBusy || albumFolderImportPreview || albumFolderImportMessage) ? (
                  <section className={`albumFolderImportPanelV309 ${albumFolderImportPreview?.albums?.length ? "hasPreview" : ""}`}>
                    <div className="albumFolderImportHeaderV309">
                      <div>
                        <p className="eyebrow">folder album import</p>
                        <h3>{albumFolderImportBusy ? "Scanning your folder" : albumFolderImportPreview?.albums?.length ? "Ready to import" : "Album folder importer"}</h3>
                        <p>{albumFolderImportMessage || "Choose one album folder, or choose a parent folder that contains separate album folders."}</p>
                      </div>

                      <div className="albumFolderImportActionsV309">
                        <button className="heroGhost" type="button" onClick={() => void scanAlbumFolderImport("single")} disabled={albumFolderImportBusy}>import one album</button>
                        <button className="heroGhost" type="button" onClick={() => void scanAlbumFolderImport("library")} disabled={albumFolderImportBusy}>import album library</button>
                        {(albumFolderImportPreview || albumFolderImportMessage) && !albumFolderImportBusy ? (
                          <button className="heroGhost" type="button" onClick={cancelAlbumFolderImportPreview}>clear</button>
                        ) : null}
                      </div>
                    </div>

                    {albumFolderImportProgress ? (
                      <div className="albumFolderProgressV309" role="status" aria-live="polite">
                        <span>
                          <i style={{ width: `${albumFolderImportProgress.total ? Math.min(100, Math.max(5, ((albumFolderImportProgress.index || 0) / albumFolderImportProgress.total) * 100)) : albumFolderImportBusy ? 42 : 100}%` }} />
                        </span>
                        <small>{albumFolderImportProgress.message || albumFolderImportMessage}</small>
                      </div>
                    ) : null}

                    {albumFolderImportPreview?.albums?.length ? (
                      <>
                        <div className="albumFolderImportSummaryV309">
                          <span><strong>{albumFolderImportPreview.albumCount || albumFolderImportPreview.albums.length}</strong><small>albums found</small></span>
                          <span><strong>{albumFolderImportPreview.trackCount || 0}</strong><small>tracks</small></span>
                          <span><strong>{albumFolderImportPreview.duplicateCount || 0}</strong><small>already in library</small></span>
                        </div>

                        <div className="albumFolderPreviewGridV309">
                          {albumFolderImportPreview.albums.slice(0, 10).map((album: any) => (
                            <article key={album.id || album.sourcePath} className="albumFolderPreviewCardV309">
                              <div className="albumFolderPreviewCoverV309">
                                {album.coverUrl ? <img src={album.coverUrl} alt="" width={96} height={96} loading="lazy" decoding="async" fetchPriority="low" referrerPolicy="no-referrer" draggable={false} /> : <span><EmptyCoverIcon /></span>}
                              </div>
                              <div className="albumFolderPreviewCopyV309">
                                <strong title={album.title}>{album.title}</strong>
                                <small title={album.artist}>{album.artist}</small>
                                <em>{album.trackCount} track{album.trackCount === 1 ? "" : "s"}{album.duplicateCount ? ` · ${album.duplicateCount} already added` : ""}</em>
                                {album.sourcePath ? <b title={album.sourcePath}>{album.sourcePath}</b> : null}
                                {album.warnings?.length ? (
                                  <ul>
                                    {album.warnings.slice(0, 3).map((warning: string) => <li key={warning}>{warning}</li>)}
                                  </ul>
                                ) : null}
                              </div>
                            </article>
                          ))}
                        </div>

                        <div className="albumFolderImportFooterV309">
                          <button className="mainAction" type="button" onClick={() => void commitAlbumFolderImportPreview()} disabled={albumFolderImportBusy}>
                            {albumFolderImportBusy ? "importing..." : "import albums"}
                          </button>
                          <button className="heroGhost" type="button" onClick={cancelAlbumFolderImportPreview} disabled={albumFolderImportBusy}>cancel</button>
                        </div>
                      </>
                    ) : !albumFolderImportBusy && albumFolderImportPreview ? (
                      <div className="albumFolderEmptyV309">
                        <strong>No album folders found</strong>
                        <p>Pick a folder that contains audio files, or choose a parent folder where each album has its own subfolder.</p>
                      </div>
                    ) : null}
                  </section>
                ) : null}

                <section className="albumsShelfPanelV318">
                  <div className="albumsToolbarV318">
                    <div>
                      <p className="eyebrow">browse</p>
                      <h3>album shelf</h3>
                    </div>
                    <div className="albumsControlsV318">
                      <input
                        value={albumSearch}
                        onChange={(event) => setAlbumSearch(event.currentTarget.value)}
                        placeholder="search albums or artists"
                        aria-label="search albums"
                      />
                      <select value={albumSortMode} onChange={(event) => setAlbumSortMode(event.currentTarget.value)} aria-label="sort albums">
                        <option value="recent">recently added</option>
                        <option value="title">title</option>
                        <option value="artist">artist</option>
                        <option value="year">year</option>
                      </select>
                    </div>
                  </div>

                  {visibleAlbums.length ? (
                    <div className="albumsGridV318">
                      {visibleAlbums.map((album, index) => {
                        const isManual = (album as any).source === "manual";
                        return (
                          <button
                            key={album.id}
                            type="button"
                            className={`albumCardV318 ${selectedAlbum?.id === album.id ? "active" : ""}`}
                            onClick={() => setSelectedAlbumId(album.id)}
                            style={{ "--album-card-delay": `${Math.min(index, 18) * 14}ms` } as CSSProperties}
                          >
                            <Cover song={album.coverSong} className="albumCardCoverV318" />
                            <span className="albumCardSheenV318" aria-hidden="true" />
                            <span className="albumCardMetaV318">
                              <small>{isManual ? ((album as any).sourceType === "folder" ? "folder album" : "your album") : "from file tags"}</small>
                              <strong title={album.title}>{prettyTitle(album.title, 6)}</strong>
                              <em title={album.artist}>{prettyMeta(album.artist)}</em>
                              <b>{album.trackCount} track{album.trackCount === 1 ? "" : "s"}{album.year ? ` ${album.year}` : ""}</b>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="albumsEmptyStateV318 albumsEmptyStateV373 emptyStateCenterV466">
                      <LocaltifyStateCard
                        centered
                        cute
                        badge="▣"
                        tone="info"
                        eyebrow="albums"
                        title="No albums yet"
                        message="Give Localtify an album folder and it’ll make the shelf feel tidy."
                        detail="Best folder shape: Album name → tracks → cover.jpg or folder.png."
                        actions={
                          <button className="mainAction" type="button" onClick={() => void scanAlbumFolderImport("library")} disabled={albumFolderImportBusy}>
                            import album library
                          </button>
                        }
                      />
                    </div>
                  )}
                </section>

                {(selectedAlbum || visibleAlbums.length > 0) ? (
                  <section className="albumDetailPanelV318">
                    {selectedAlbum ? (
                    <>
                      <div className="albumDetailHeroV318" style={{ "--album-hero-cover": selectedAlbum.coverSong ? toCssUrl(getSongAmbientSource(selectedAlbum.coverSong)) : "none" } as CSSProperties}>
                        <Cover song={selectedAlbum.coverSong} className="albumDetailCoverV318" />
                        <div className="albumDetailCopyV318">
                          <p className="eyebrow">{selectedAlbumIsFolder ? "folder album" : selectedAlbumIsManual ? "custom album" : "album"}</p>
                          <h3 title={selectedAlbum.title}>{selectedAlbum.title}</h3>
                          <p>{selectedAlbum.artist}</p>
                          <div className="albumMetaPillsV318">
                            <span>{selectedAlbum.trackCount} track{selectedAlbum.trackCount === 1 ? "" : "s"}</span>
                            <span>{formatTime(selectedAlbum.totalDuration)}</span>
                            {selectedAlbum.year ? <span>{selectedAlbum.year}</span> : null}
                            {selectedAlbumIsFolder && (selectedAlbum as any).sourcePath ? <span title={(selectedAlbum as any).sourcePath}>folder import</span> : null}
                          </div>
                          <div className="albumActionRowV318">
                            <button className="mainAction" type="button" onClick={() => playAlbumSongs?.(selectedAlbumIds, selectedAlbum.title)} disabled={!selectedAlbumIds.length || !playAlbumSongs}>play</button>
                            <button className="heroGhost" type="button" onClick={() => shuffleAlbumSongs?.(selectedAlbumIds, selectedAlbum.title)} disabled={selectedAlbumIds.length < 2 || !shuffleAlbumSongs}>shuffle</button>
                            <button className="heroGhost" type="button" onClick={() => queueAlbumSongs?.(selectedAlbumIds, selectedAlbum.title)} disabled={!selectedAlbumIds.length || !queueAlbumSongs}>queue</button>
                            {selectedAlbumIsManual ? <button className="heroGhost" type="button" onClick={() => openEditAlbumBuilder(selectedAlbum)}>edit</button> : null}
                            <button className="heroGhost danger" type="button" onClick={() => void deleteSelectedAlbum()} disabled={!selectedAlbumIds.length && !selectedAlbumIsManual}>
                              {selectedAlbumIsManual ? "delete album" : "remove tag album"}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="albumTrackListV318">
                        {selectedAlbum.songs.map((song, index) => {
                          const active = song.id === currentId;
                          return (
                            <article key={song.id} className={`albumTrackRowV318 ${active ? "active" : ""}`}>
                              <button type="button" className="albumTrackMainV318" onClick={() => void selectSong(song.id, true)}>
                                <span>{String(index + 1).padStart(2, "0")}</span>
                                <Cover song={song} className="albumTrackCoverV318" />
                                <span>
                                  <strong title={song.title}>{prettyTitle(song.title, 10)}</strong>
                                  <small>{prettyMeta(song.artist)}</small>
                                </span>
                              </button>
                              <span className="albumTrackDurationV318">{formatTime(song.duration)}</span>
                              <button className={`iconAction likeActionV443 noActionHoverV444 ${song.liked ? "liked likeActionActiveV443" : ""}`} type="button" onClick={() => toggleLike(song.id)} aria-label={song.liked ? "unlike song" : "like song"} aria-pressed={song.liked}>
                                <LikeHeartAnimationV443 liked={song.liked} />
                              </button>
                              <button className="iconAction" type="button" onClick={() => openPlaylistPicker(song)} aria-label="add to playlist">+</button>
                            </article>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="albumsEmptyStateV318 albumDetailEmptyV318">
                      <LocaltifyStateCard
                        tone="info"
                        eyebrow="album detail"
                        title="Choose an album"
                        message={visibleAlbums.length ? "Pick an album from the shelf and its tracks will appear here." : "Once you import an album folder, this panel will show the track list, duration, and quick actions."}
                      />
                    </div>
                  )}
                  </section>
                ) : null}

                {albumBuilderOpen ? (
                  <section ref={albumBuilderSectionRef} className="albumBuilderPanelV318 open">
                  <div className="albumBuilderHeaderV318">
                    <div>
                      <p className="eyebrow">{albumBuilderMode === "edit" ? "edit custom album" : "create"}</p>
                      <h3>{albumBuilderMode === "edit" ? "edit album" : "add local album"}</h3>
                    </div>
                    <button className="heroGhost" type="button" onClick={albumBuilderOpen ? closeAlbumBuilder : () => openCreateAlbumBuilder(currentSong || songs[0] || null)}>
                      {albumBuilderOpen ? "close" : "open builder"}
                    </button>
                  </div>

                  {albumBuilderOpen ? (
                    <div className="albumBuilderBodyV318">
                      <div className="albumBuilderFieldsV318">
                        <div className="albumBuilderCoverPickerV319">
                          <Cover song={albumDraftPreviewCoverSong} className="albumBuilderCoverPreviewV319" />
                          <div className="albumBuilderCoverCopyV319">
                            <strong>album cover</strong>
                            <span>{albumDraftCoverUrl ? "cover ready" : albumDraftPreviewCoverSong ? "using a song cover" : "choose a cover image"}</span>
                            <div className="albumBuilderCoverActionsV319">
                              <button className="heroGhost" type="button" onClick={openAlbumCoverPicker}>choose image</button>
                              {albumDraftCoverUrl ? <button className="heroGhost" type="button" onClick={clearAlbumDraftCover}>use song cover</button> : null}
                            </div>
                          </div>
                          <input
                            ref={albumCoverInputRef}
                            className="albumCoverFileInputV319"
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                            onChange={handleAlbumCoverFile}
                          />
                        </div>
                        <label>
                          <span>album title</span>
                          <input value={albumDraftTitle} onChange={(event) => setAlbumDraftTitle(event.currentTarget.value)} placeholder="album name" />
                        </label>
                        <label>
                          <span>album artist</span>
                          <input value={albumDraftArtist} onChange={(event) => setAlbumDraftArtist(event.currentTarget.value)} placeholder={albumDraftHasVariousArtists ? "various artists" : "artist name"} />
                          <div className="albumBuilderArtistToolsV320">
                            <small>{albumDraftArtistPreview}</small>
                            {albumDraftArtistNames.length ? (
                              <button className="heroGhost" type="button" onClick={() => setAlbumDraftArtist(albumDraftArtistSuggestion)}>
                                use suggestion
                              </button>
                            ) : null}
                          </div>
                        </label>
                        <label>
                          <span>year</span>
                          <input value={albumDraftYear} onChange={(event) => setAlbumDraftYear(event.currentTarget.value)} placeholder="optional" inputMode="numeric" />
                        </label>
                      </div>

                      <div className="albumBuilderPickerV318">
                        <div className="albumBuilderSearchRowV318">
                          <input value={albumDraftSearch} onChange={(event) => setAlbumDraftSearch(event.currentTarget.value)} placeholder="search songs" />
                          <span>{albumDraftSongIds.length} selected</span>
                        </div>
                        <div className="albumBuilderSongGridV318">
                          {albumDraftSearchResults.map((song) => {
                            const selected = albumDraftSongIds.includes(song.id);
                            return (
                              <button key={song.id} type="button" className={selected ? "selected" : ""} onClick={() => toggleAlbumDraftSong(song.id)}>
                                <Cover song={song} className="albumBuilderSongCoverV318" />
                                <span>
                                  <strong>{prettyTitle(song.title, 8)}</strong>
                                  <small>{prettyMeta(song.artist)}</small>
                                </span>
                                <b>{selected ? <CheckMiniIcon /> : <PlusMiniIcon />}</b>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="albumBuilderFooterV318">
                        <div className="albumBuilderPreviewV318">
                          <Cover song={albumDraftPreviewCoverSong} className="albumBuilderPreviewCoverV318" />
                          <span>{albumDraftSongIds.length ? `${albumDraftSongIds.length} selected cover fits square` : "choose songs for this album"}</span>
                        </div>
                        <div className="albumBuilderActionsV318">
                          {albumBuilderMode === "edit" && selectedAlbumIsManual ? <button className="heroGhost danger" type="button" onClick={() => deleteManualAlbum(selectedAlbum)}>delete</button> : null}
                          <button className="mainAction" type="button" onClick={saveManualAlbumFromDraft} disabled={!albumDraftSongIds.length}>{albumBuilderMode === "edit" ? "save album" : "create album"}</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="albumBuilderClosedTextV318">build albums from any songs in your library.</p>
                  )}
                  </section>
                ) : null}
              </section>
            
  );
}
