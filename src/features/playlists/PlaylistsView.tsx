import type { CSSProperties } from "react";
import { EmptyCoverIcon, LocaltifyStateCard, MetaDividerDot, PlusMiniIcon } from "../../shared/ui/LocaltifyViewUi";
import { VirtualPlaylistTrackList } from "./components/VirtualPlaylistTrackList";
import { formatTime } from "../../shared/utils/format";

export type PlaylistsViewProps = {
  activePlaylistId: any;
  appendPlaylistSongAction: any;
  cancelRenamePlaylist: any;
  createPlaylist: any;
  currentId: any;
  draggedSongId: any;
  dropPlaylistSongAction: any;
  duplicatePlaylist: any;
  endPlaylistSongDragAction: any;
  handlePlaylistShelfDragLeave: any;
  handlePlaylistShelfDragOver: any;
  handlePlaylistShelfDrop: any;
  importSongs: any;
  isPlaying: any;
  newPlaylistName: any;
  openPlaylistSongContextMenuAction: any;
  playPlaylist: any;
  playlistDragOverPlaylistId: any;
  playlistSummaries: any;
  playlists: any;
  removePlaylist: any;
  removePlaylistSongAction: any;
  renamingPlaylistId: any;
  renamingPlaylistName: any;
  renderPlaylistCollage: any;
  savePlaylistRename: any;
  selectPlaylistSongAction: any;
  selectedPlaylist: any;
  selectedPlaylistDuration: any;
  selectedPlaylistId: any;
  selectedPlaylistSongs: any;
  setNewPlaylistName: any;
  setRenamingPlaylistName: any;
  setSelectedPlaylistId: any;
  songs: any;
  startPlaylistSongDragAction: any;
  startRenamePlaylist: any;
};

export default function PlaylistsView(props: PlaylistsViewProps) {
  const {
    activePlaylistId,
    appendPlaylistSongAction,
    cancelRenamePlaylist,
    createPlaylist,
    currentId,
    draggedSongId,
    dropPlaylistSongAction,
    duplicatePlaylist,
    endPlaylistSongDragAction,
    handlePlaylistShelfDragLeave,
    handlePlaylistShelfDragOver,
    handlePlaylistShelfDrop,
    importSongs,
    isPlaying,
    newPlaylistName,
    openPlaylistSongContextMenuAction,
    playPlaylist,
    playlistDragOverPlaylistId,
    playlistSummaries,
    removePlaylist,
    removePlaylistSongAction,
    renamingPlaylistId,
    renamingPlaylistName,
    renderPlaylistCollage,
    savePlaylistRename,
    selectPlaylistSongAction,
    selectedPlaylist,
    selectedPlaylistDuration,
    selectedPlaylistSongs,
    setNewPlaylistName,
    setRenamingPlaylistName,
    setSelectedPlaylistId,
    songs,
    startPlaylistSongDragAction,
    startRenamePlaylist
  } = props;

  return (
    <section className="playlistsPage playlistPageV029">
      <div className="playlistTopGrid">
        <section className="panel playlistHeroPanel">
          <div className="playlistHeroCopy">
            <p className="eyebrow">playlists</p>
            <h3>{selectedPlaylist ? selectedPlaylist.name : "make your first mix"}</h3>
            <p>
              {selectedPlaylist ? (
                <>
                  {selectedPlaylistSongs.length} song{selectedPlaylistSongs.length === 1 ? "" : "s"}
                  <MetaDividerDot />
                  {formatTime(selectedPlaylistDuration)} total
                </>
              ) : (
                "Create a playlist, add songs, and keep your local music feeling familiar."
              )}
            </p>
          </div>

          {selectedPlaylist ? renderPlaylistCollage(selectedPlaylistSongs, "playlistHeroCollage playlistCoverCollage") : (
            <div className="playlistHeroCollage playlistCoverCollage playlistEmptyCollage" aria-hidden="true">
              <div className="playlistCoverTile empty"><span><EmptyCoverIcon /></span></div>
              <div className="playlistCoverTile empty"><span><PlusMiniIcon /></span></div>
              <div className="playlistCoverTile empty"><span><EmptyCoverIcon /></span></div>
              <div className="playlistCoverTile empty"><span><EmptyCoverIcon /></span></div>
            </div>
          )}

          <div className="playlistHeroActions">
            <button
              className="heroMain"
              type="button"
              onClick={() => selectedPlaylist && void playPlaylist(selectedPlaylist, false)}
              disabled={!selectedPlaylist || selectedPlaylist.songIds.length === 0}
            >
              play
            </button>
            <button
              className="softButton"
              type="button"
              onClick={() => selectedPlaylist && void playPlaylist(selectedPlaylist, true)}
              disabled={!selectedPlaylist || selectedPlaylist.songIds.length === 0}
            >
              shuffle
            </button>
            {selectedPlaylist ? (
              <>
                <button className="softButton" type="button" onClick={() => startRenamePlaylist(selectedPlaylist)}>
                  rename
                </button>
                <button className="softButton" type="button" onClick={() => duplicatePlaylist(selectedPlaylist.id)}>
                  duplicate
                </button>
              </>
            ) : null}
          </div>
        </section>

        <aside className="panel playlistCreatePanel">
          <p className="eyebrow">new playlist</p>
          <h3>start a mix</h3>
          <p className="softText">Night drive, gaming, school, sad songs — whatever fits.</p>
          <form
            className="playlistCreateForm"
            onSubmit={(event) => {
              event.preventDefault();
              createPlaylist();
            }}
          >
            <input
              value={newPlaylistName}
              onChange={(event) => setNewPlaylistName(event.currentTarget.value)}
              placeholder="playlist name"
            />
            <button className="mainAction" type="submit">new playlist</button>
          </form>
        </aside>
      </div>

      <div className="playlistContentGrid">
        <section className="panel playlistShelfPanel">
          <div className="panelHead">
            <div>
              <p className="eyebrow">your mixes</p>
              <h3>library shelves</h3>
            </div>
          </div>

          <div className="playlistShelfGrid">
            {playlistSummaries.length ? playlistSummaries.map(({ playlist, previewSongs, songCount, duration }, index) => (
              <button
                key={playlist.id}
                className={`playlistShelfCard ${selectedPlaylist?.id === playlist.id ? "active" : ""} ${activePlaylistId === playlist.id ? "playing" : ""} ${playlistDragOverPlaylistId === playlist.id ? "dropTarget" : ""}`}
                style={{ "--playlist-stagger": Math.min(index, 12) } as CSSProperties}
                type="button"
                onClick={() => setSelectedPlaylistId(playlist.id)}
                onDragOver={(event) => handlePlaylistShelfDragOver(event, playlist.id)}
                onDragLeave={(event) => handlePlaylistShelfDragLeave(event, playlist.id)}
                onDrop={(event) => handlePlaylistShelfDrop(event, playlist.id)}
                title="drop a song here to add it"
              >
                {renderPlaylistCollage(previewSongs)}
                <span className="playlistShelfMeta">
                  <strong>{playlist.name}</strong>
                  <small>{songCount} song{songCount === 1 ? "" : "s"}<MetaDividerDot />{formatTime(duration)}</small>
                </span>
                <span className="playlistShelfDropHint">{activePlaylistId === playlist.id ? "playing" : "drop song"}</span>
              </button>
            )) : (
              <LocaltifyStateCard
                centered
                cute
                badge="♫"
                tone={songs.length ? "info" : "warning"}
                eyebrow="playlists"
                title="No playlists yet"
                message={songs.length ? "Create a tiny mix and give your favorite songs a cozy corner." : "Import songs first, then make a playlist for gaming, studying, edits, or night drives."}
                detail={songs.length ? "Tip: you can also drag songs into a playlist card." : "Playlists are local and private."}
                actions={songs.length ? (
                  <button className="mainAction" type="button" onClick={() => {
                    if (!newPlaylistName.trim()) setNewPlaylistName("my mix");
                    window.setTimeout(() => createPlaylist(), 0);
                  }}>
                    create playlist
                  </button>
                ) : (
                  <button className="mainAction" type="button" onClick={importSongs}>import songs</button>
                )}
              />
            )}
          </div>
        </section>

        <section className="panel playlistTracksPanel">
          <div className="panelHead playlistTracksHead">
            <div className="playlistTracksTitleBlock">
              <p className="eyebrow">playlist</p>
              {selectedPlaylist && renamingPlaylistId === selectedPlaylist.id ? (
                <form
                  className="playlistRenameForm"
                  onSubmit={(event) => {
                    event.preventDefault();
                    savePlaylistRename(selectedPlaylist.id);
                  }}
                >
                  <input
                    value={renamingPlaylistName}
                    onChange={(event) => setRenamingPlaylistName(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") cancelRenamePlaylist();
                    }}
                    placeholder="playlist name"
                    autoFocus
                  />
                  <button className="settingsTinyButton" type="submit">save</button>
                  <button className="settingsTinyButton" type="button" onClick={cancelRenamePlaylist}>cancel</button>
                </form>
              ) : (
                <h3>{selectedPlaylist ? selectedPlaylist.name : "nothing selected"}</h3>
              )}
            </div>

            {selectedPlaylist ? (
              <div className="playlistManageActions">
                <button className="settingsTinyButton" type="button" onClick={() => startRenamePlaylist(selectedPlaylist)}>rename</button>
                <button className="settingsTinyButton" type="button" onClick={() => duplicatePlaylist(selectedPlaylist.id)}>duplicate</button>
                <button className="settingsTinyButton danger" type="button" onClick={() => removePlaylist(selectedPlaylist.id)}>remove</button>
              </div>
            ) : null}
          </div>

          <VirtualPlaylistTrackList
            selectedPlaylistId={selectedPlaylist?.id || ""}
            list={selectedPlaylistSongs}
            currentId={currentId}
            isPlaying={isPlaying}
            draggedSongId={draggedSongId}
            onSelectSong={selectPlaylistSongAction}
            onStartSongDrag={startPlaylistSongDragAction}
            onDropSong={dropPlaylistSongAction}
            onAppendSong={appendPlaylistSongAction}
            onDragEnd={endPlaylistSongDragAction}
            onOpenContextMenu={openPlaylistSongContextMenuAction}
            onRemoveSong={removePlaylistSongAction}
          />
        </section>
      </div>
    </section>
  );
}
