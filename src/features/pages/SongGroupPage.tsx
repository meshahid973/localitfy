import "./pages.css";
import { useEffect, useMemo, useState } from "react";
import { Radio } from "lucide-react";
import { Cover } from "../covers/Cover";
import { CollectionArtwork } from "../covers/CollectionArtwork";
import { LocaltifyStateCard } from "../../shared/ui/LocaltifyViewUi";
import { formatTime } from "../../shared/utils/format";
import { splitArtistCredits } from "../artists/artistCredits";
import { splitGenreCredits } from "../genres/genreCredits";
import { useGenreTaggedSongs } from "../genres/useGenreTaggedSongs";
import { artistTarget, genreTarget, playableIds, useAppActions } from "../shell/appActions";
import type { Song } from "../library/song.types";
import type { ArtistBio } from "../discover/discover.types";
import { PageAtmosphere } from "../covers/pageAtmosphere";
import CollectionHero from "./CollectionHero";
import TrackList from "./TrackList";

export type SongGroupPageProps = {
  id: string;
  songs: Song[];
  currentId: string | null;
  isPlaying: boolean;
  toggleLike: (songId: string) => unknown;
  openPlaylistPicker: (song: Song) => unknown;
  openSimilar: (songIds: string[], key: string, title: string) => unknown;
};

const TOP_SONGS = 10;

/** The songs credited to one name (artist or genre), keeping the name as it is written in the tags. */
function collect(songs: Song[], id: string, credits: (song: Song) => string[]) {
  let name = "";
  const members = songs.filter((song) => credits(song).some((credit) => {
    if (credit.toLocaleLowerCase() !== id) return false;
    name ||= credit;
    return true;
  }));
  return { name, members };
}

export function ArtistPage(props: SongGroupPageProps) {
  const group = useMemo(() => collect(props.songs, props.id, (song) => splitArtistCredits(song.artist)), [props.songs, props.id]);
  return <SongGroupBody key={props.id} {...props} kind="artist" name={group.name} members={group.members} loading={false} />;
}

export function GenrePage(props: SongGroupPageProps) {
  const tagged = useGenreTaggedSongs(props.songs);
  const group = useMemo(() => collect(tagged.songs, props.id, (song) => splitGenreCredits(song.genre)), [tagged.songs, props.id]);
  return <SongGroupBody key={props.id} {...props} kind="genre" name={group.name} members={group.members} loading={tagged.loading} />;
}

function SongGroupBody({ kind, name, members, loading, currentId, isPlaying, toggleLike, openPlaylistPicker, openSimilar }: SongGroupPageProps & { kind: "artist" | "genre"; name: string; members: Song[]; loading: boolean }) {
  const actions = useAppActions();
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");
  // Most played first once there is history; otherwise library order.
  const popular = useMemo(() => (members.some((song) => song.playCount > 0)
    ? [...members].sort((a, b) => (b.playCount || 0) - (a.playCount || 0)) : members), [members]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return needle ? popular.filter(song => [song.title, song.artist, song.album].some(value => (value || "").toLocaleLowerCase().includes(needle))) : popular;
  }, [popular, query]);
  if (!name) {
    return (
      <section data-page-section={kind} className="collectionPage">
        <LocaltifyStateCard centered tone="info" eyebrow={kind} title={loading ? "Reading genre tags" : `This ${kind} is gone`}
          message={loading ? "Checking the genre tags in your local library." : "No songs in your library are credited to it any more."}
          actions={loading ? undefined : <button className="softButton" type="button" onClick={() => actions.nav.go(kind === "artist" ? "artists" : "genres")}>browse {kind}s</button>} />
      </section>
    );
  }

  const target = kind === "artist" ? artistTarget(name, members) : genreTarget(name, members);
  const playable = playableIds(members);
  const duration = members.reduce((total, song) => total + Math.max(0, Number(song.duration) || 0), 0);
  const shown = showAll || query.trim() ? filtered : filtered.slice(0, TOP_SONGS);

  return (
    <section data-page-section={kind} className="collectionPage songGroupPage" aria-label={`${name} ${kind}`}>
      <PageAtmosphere songs={members} custom={target.coverSong?.coverThumbUrl || target.coverSong?.coverThumbnailUrl || target.coverSong?.thumbnailUrl || target.coverSong?.coverUrl || target.coverSong?.coverPath || target.coverSong?.coverFullUrl} />
      <CollectionHero
        typeLabel={kind}
        title={name}
        round={kind === "artist"}
        cover={kind === "genre" ? <CollectionArtwork id={`genre:${target.id}`} name={name} songs={members} className="collectionHeroCover" /> : <Cover song={target.coverSong} className="collectionHeroCover" priority="high" />}
        coverSong={target.coverSong}
        stats={[`${members.length} track${members.length === 1 ? "" : "s"}`, formatTime(duration)].join(" · ")}
        playable={playable.length}
        onPlay={() => actions.playCollection(target)}
        onShuffle={() => actions.playCollection(target, { shuffle: true })}
        onQueue={() => actions.queueCollection(target)}
        onMore={(event) => actions.openCollectionMenu(event, target)}
        search={<input className="pageHeaderSearch" type="search" aria-label="Search collection tracks" placeholder="Search tracks"
          value={query} onChange={event => setQuery(event.currentTarget.value)} />}
      >
        <button className="collectionIconButton" type="button" disabled={!playable.length} aria-label={`songs like ${name}`} title="Similar songs"
          onClick={() => openSimilar(playable, `${kind}:${target.id}`, name)}>
          <Radio size={16} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </CollectionHero>

      <section className="collectionSection" aria-label="songs">
        <div className="collectionSectionHead">
          <h2>{members.some((song) => song.playCount > 0) ? "Popular" : "Songs"}</h2>
         </div>
        {!shown.length ? <p role="status">No matching tracks.</p> : null}
        <TrackList songs={shown} currentId={currentId} isPlaying={isPlaying} hideArtist={kind === "artist" ? name : undefined}
          playFrom={(songId) => actions.playCollection({ ...target, songs: filtered }, { startId: songId })}
          toggleLike={toggleLike} openPlaylistPicker={openPlaylistPicker} />
        {!query.trim() && popular.length > TOP_SONGS ? (
          <button className="collectionTextButton collectionShowAll" type="button" onClick={() => setShowAll((value) => !value)}>
            {showAll ? "show less" : `show all ${popular.length} songs`}
          </button>
        ) : null}
      </section>

      {kind === "artist" ? <ArtistAbout name={name} /> : null}
    </section>
  );
}

/** The Last.fm biography, shown only once Discover is on. Nothing is shown while it loads or when there is none. */
function ArtistAbout({ name }: { name: string }) {
  const [bio, setBio] = useState<ArtistBio | null>(null);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    let current = true;
    setBio(null);
    setExpanded(false);
    window.localitfy?.getArtistBio?.(name).then((answer) => { if (current) setBio(answer); }).catch(() => undefined);
    return () => { current = false; };
  }, [name]);

  if (bio?.status !== "ready") return null;
  const longer = bio.content.length > bio.summary.length;
  const paragraphs = (expanded ? bio.content : bio.summary).split(/\n{2,}/);
  return (
    <section className="collectionSection artistAbout" aria-label="about">
      <h2>About</h2>
      <div className="artistAboutText">
        {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      </div>
      <p className="artistAboutCredit">
        {longer ? <button className="collectionTextButton" type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? "show less" : "read more"}</button> : null}
        <span>Biography from Last.fm · CC BY-SA</span>
      </p>
    </section>
  );
}
