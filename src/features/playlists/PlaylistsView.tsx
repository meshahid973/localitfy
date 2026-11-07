import "./playlists.css";
import DailyMixesShelf, { type DailyMixesShelfProps } from "../analysis/DailyMixesShelf";
import { lazy, Suspense, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Check, Copy, Pencil, Plus, Radio, SlidersHorizontal, Sparkles, Trash2, WandSparkles, X } from "lucide-react";
import type { SimilarSeedRequest } from "../analysis/similarSeed";
import { notForMeTest, type NotForMeMarks } from "../analysis/notForMe";
import PlaylistRecommendations from "./components/PlaylistRecommendations";
import { ActionLabel } from "../../shared/ui/ActionLabel";
import { PageHeader } from "../../shared/ui/PageHeader";
import { LocaltifyStateCard, MetaDividerDot } from "../../shared/ui/LocaltifyViewUi";
import { VirtualPlaylistTrackList } from "./components/VirtualPlaylistTrackList";
import PlaylistCoverCollage from "./components/PlaylistCoverCollage";
import { formatTime } from "../../shared/utils/format";
import type { Playlist } from "./playlist.types";
import type { Song } from "../library/song.types";
import { describeSmartRules, type ListeningCounts, type SmartRules } from "./smartPlaylist";
import { MediaCard } from "../../shared/ui/MediaCard";
import { playlistTarget, useAppActions } from "../shell/appActions";
import CollectionHero from "../pages/CollectionHero";

const SmartPlaylistDialog = lazy(() => import("./components/SmartPlaylistDialog"));
const PromptPlaylistDialog = lazy(() => import("./components/PromptPlaylistDialog"));

export type PlaylistsViewProps = {
  dailyMixes: DailyMixesShelfProps;
  playSongs: (ids: string[], label: string) => unknown;
  selectSong: (id: string, autoplay?: boolean) => unknown;
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
  openSimilarSongs: (request: SimilarSeedRequest) => unknown;
  playlistDragOverPlaylistId: any;
  playlistSummaries: any;
  removePlaylist: any;
  removePlaylistSongAction: any;
  renamingPlaylistId: any;
  renamingPlaylistName: any;
  savePlaylistRename: any;
  selectPlaylistSongAction: any;
  selectedPlaylist: any;
  selectedPlaylistDuration: any;
  selectedPlaylistSongs: any;
  setNewPlaylistName: any;
  setRenamingPlaylistName: any;
  setSelectedPlaylistId: any;
  songs: any;
  startPlaylistSongDragAction: any;
  startRenamePlaylist: any;
  saveSmartPlaylist: (playlistId: string | null, name: string, rules: SmartRules) => string | null;
  listeningCounts: ListeningCounts;
  /** The playlist page being shown; null shows every playlist. */
  detailPlaylistId?: string | null;
  addSongToPlaylist: (playlistId: string, songId: string) => unknown;
  notForMe: { marks: NotForMeMarks };
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
    savePlaylistRename,
    selectPlaylistSongAction,
    selectedPlaylist,
    setNewPlaylistName,
    setRenamingPlaylistName,
    setSelectedPlaylistId,
    songs,
    startPlaylistSongDragAction,
    startRenamePlaylist
  } = props;
  // undefined: closed; null: creating a new smart playlist.
  const [smartEditing, setSmartEditing] = useState<Playlist | null | undefined>(undefined);
  const [prompting, setPrompting] = useState(false);
  const hidden = useMemo(() => notForMeTest(props.notForMe.marks), [props.notForMe.marks]);
  const playlists = useMemo(() => playlistSummaries.map((summary: { playlist: Playlist }) => summary.playlist), [playlistSummaries]);
  const actions = useAppActions();
  const songsById = useMemo(() => new Map<string, Song>((songs as Song[]).map((song) => [song.id, song])), [songs]);
  const detailId = props.detailPlaylistId || null;
  // Adding a song to another playlist selects that one; the page keeps the selection on its own playlist,
  // which the track list's play, drop and remove actions act on.
  useEffect(() => { if (detailId && selectedPlaylist?.id !== detailId) setSelectedPlaylistId(detailId); }, [detailId, selectedPlaylist?.id]);
  const detailPlaylist: Playlist | null = detailId ? playlistSummaries.find((summary: { playlist: Playlist }) => summary.playlist.id === detailId)?.playlist ?? null : null;
  const detailSongs = useMemo(() => detailPlaylist?.songIds.flatMap((id) => songsById.get(id) ?? []) ?? [], [detailPlaylist, songsById]);
  const smartDialog = smartEditing !== undefined ? (
    <Suspense fallback={null}>
      <SmartPlaylistDialog playlist={smartEditing} songs={songs} listeningCounts={props.listeningCounts}
        onSave={(playlistId, name, rules) => {
          const id = props.saveSmartPlaylist(playlistId, name, rules);
          if (id && !playlistId) actions.nav.open({ kind: "playlist", id });
          return id;
        }} onClose={() => setSmartEditing(undefined)} />
    </Suspense>
  ) : null;

  const promptDialog = prompting ? (
    <Suspense fallback={null}>
      <PromptPlaylistDialog songs={songs} currentId={currentId} hidden={hidden} playSongs={props.playSongs}
        selectSong={props.selectSong} savePlaylist={props.dailyMixes.savePlaylist}
        openAnalysisSettings={() => { setPrompting(false); props.dailyMixes.openAnalysisSettings(); }} onClose={() => setPrompting(false)} />
    </Suspense>
  ) : null;

  if (detailId) {
    if (!detailPlaylist) {
      return (
        <section data-page-section="playlists" className="playlistsPage playlistPageV029">
          <LocaltifyStateCard centered tone="info" eyebrow="playlist" title="This playlist is gone" message="It was removed since you opened it."
            actions={<button className="softButton" type="button" onClick={() => actions.nav.go("playlists")}>all playlists</button>} />
        </section>
      );
    }
    const target = playlistTarget(detailPlaylist, detailSongs);
    return (
      <section data-page-section="playlists" className="playlistsPage playlistPageV029 playlistDetailPage">
        <CollectionHero
          eyebrow={detailPlaylist.rules ? "smart playlist" : "playlist"}
          title={detailPlaylist.name}
          cover={<PlaylistCoverCollage songs={detailSongs} className="collectionHeroCover playlistCoverCollage" />}
          coverSong={target.coverSong}
          byline={detailPlaylist.rules ? <span className="smartPlaylistSummary">{describeSmartRules(detailPlaylist.rules)}</span> : undefined}
          stats={`${detailSongs.length} song${detailSongs.length === 1 ? "" : "s"} · ${formatTime(detailSongs.reduce((total, song) => total + (Number(song.duration) || 0), 0))}`}
          playable={detailPlaylist.songIds.length}
          onPlay={() => void playPlaylist(detailPlaylist, false)}
          onShuffle={() => void playPlaylist(detailPlaylist, true)}
          onQueue={() => actions.queueCollection(target)}
          onMore={(event) => actions.openCollectionMenu(event, target)}
        >
          <button className="collectionIconButton" type="button" onClick={() => props.openSimilarSongs({ kind: "playlist", playlistId: detailPlaylist.id })}
            disabled={detailSongs.length === 0} aria-label="more like this playlist" title="Find songs in your library that sound like this playlist">
            <Radio size={16} strokeWidth={2.2} aria-hidden="true" />
          </button>
          {detailPlaylist.rules ? (
            <button className="collectionIconButton" type="button" onClick={() => setSmartEditing(detailPlaylist)} aria-label="edit rules" title="Edit rules">
              <SlidersHorizontal size={16} strokeWidth={2.2} aria-hidden="true" />
            </button>
          ) : null}
        </CollectionHero>

        <section className="panel playlistTracksPanel">
          <div className="panelHead playlistTracksHead">
            <div className="playlistTracksTitleBlock">
              <p className="eyebrow">songs</p>
              {renamingPlaylistId === detailPlaylist.id ? (
                <form
                  className="playlistRenameForm"
                  onSubmit={(event) => {
                    event.preventDefault();
                    savePlaylistRename(detailPlaylist.id);
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
                  <button className="settingsTinyButton" type="submit"><ActionLabel icon={Check}>save</ActionLabel></button>
                  <button className="settingsTinyButton" type="button" onClick={cancelRenamePlaylist}><ActionLabel icon={X}>cancel</ActionLabel></button>
                </form>
              ) : (
                <h3>{detailPlaylist.name}</h3>
              )}
            </div>

            <div className="playlistManageActions">
              <button className="settingsTinyButton" type="button" onClick={() => startRenamePlaylist(detailPlaylist)}><ActionLabel icon={Pencil}>rename</ActionLabel></button>
              <button className="settingsTinyButton" type="button" onClick={() => duplicatePlaylist(detailPlaylist.id)}><ActionLabel icon={Copy}>duplicate</ActionLabel></button>
              <button className="settingsTinyButton danger" type="button" onClick={() => { removePlaylist(detailPlaylist.id); actions.nav.back(); }}><ActionLabel icon={Trash2}>remove</ActionLabel></button>
            </div>
          </div>

          <VirtualPlaylistTrackList
            selectedPlaylistId={detailPlaylist.id}
            list={detailSongs}
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
          {!detailPlaylist.rules && detailSongs.length > 0 ? (
            <PlaylistRecommendations playlist={detailPlaylist} songs={songs as Song[]} playlists={playlists} currentId={currentId} hidden={hidden}
              addSongToPlaylist={props.addSongToPlaylist} selectSong={props.selectSong} />
          ) : null}
        </section>
        {smartDialog}
        {promptDialog}
      </section>
    );
  }

  return (
    <section data-page-section="playlists" className="playlistsPage playlistPageV029">
      <PageHeader
        title="Playlists"
      >
        <form
          className="playlistCreateForm"
          onSubmit={(event) => {
            event.preventDefault();
            const id = createPlaylist();
            if (id) actions.nav.open({ kind: "playlist", id });
          }}
        >
          <input
            className="pageHeaderSearch"
            value={newPlaylistName}
            onChange={(event) => setNewPlaylistName(event.currentTarget.value)}
            placeholder="new playlist name"
            aria-label="New playlist name"
          />
          <button className="mainAction" type="submit"><ActionLabel icon={Plus}>new playlist</ActionLabel></button>
          <button className="softButton" type="button" onClick={() => setSmartEditing(null)} disabled={!songs.length}
            title="A playlist that fills itself from rules, like liked songs you haven't played lately">
            <ActionLabel icon={Sparkles}>smart playlist</ActionLabel>
          </button>
          <button className="softButton" type="button" onClick={() => setPrompting(true)} disabled={!songs.length}
            title="Describe a playlist, then choose the songs to keep">
            <ActionLabel icon={WandSparkles}>from a prompt</ActionLabel>
          </button>
        </form>
      </PageHeader>

      <DailyMixesShelf {...props.dailyMixes} />
      <div className="playlistContentGrid isEmpty">
        <section className="panel playlistShelfPanel">
          <div className="panelHead">
            <div>
              <p className="eyebrow">saved</p>
              <h3>your playlists</h3>
            </div>
          </div>

          <div className="playlistShelfGrid">
            {playlistSummaries.length ? playlistSummaries.map(({ playlist, previewSongs, songCount, duration }, index) => (
              <MediaCard
                key={playlist.id}
                coverClassName="mediaCardPlayCentered"
                className={`playlistShelfCard ${activePlaylistId === playlist.id ? "playing" : ""} ${playlistDragOverPlaylistId === playlist.id ? "dropTarget" : ""}`}
                style={{ "--playlist-stagger": Math.min(index, 12) } as CSSProperties}
                openLabel={`open ${playlist.name}`}
                playLabel={`play ${playlist.name}`}
                onOpen={() => actions.openCollection(playlistTarget(playlist, previewSongs))}
                onPlay={() => void playPlaylist(playlist, false)}
                onContextMenu={(event) => actions.openCollectionMenu(event, playlistTarget(playlist, playlist.songIds.flatMap((id: string) => songsById.get(id) ?? [])))}
                onDragOver={(event) => handlePlaylistShelfDragOver(event, playlist.id)}
                onDragLeave={(event) => handlePlaylistShelfDragLeave(event, playlist.id)}
                onDrop={(event) => handlePlaylistShelfDrop(event, playlist.id)}
                title="drop a song here to add it"
                cover={<PlaylistCoverCollage songs={previewSongs} />}
              >
                <span className="playlistShelfMeta">
                  <strong>{playlist.name}</strong>
                  <small>{playlist.rules ? <>smart<MetaDividerDot /></> : null}{songCount} song{songCount === 1 ? "" : "s"}<MetaDividerDot />{formatTime(duration)}</small>
                </span>
                <span className="playlistShelfDropHint">{activePlaylistId === playlist.id ? "playing" : "drop song"}</span>
              </MediaCard>
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
                    createPlaylist(newPlaylistName.trim() || "my mix");
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

      </div>
      {smartDialog}
      {promptDialog}
    </section>
  );
}
