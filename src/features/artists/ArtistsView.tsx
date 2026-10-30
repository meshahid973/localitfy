import { useEffect, useMemo, useState } from "react";
import { Cover } from "../covers/Cover";
import type { Song } from "../library/song.types";
import { LocaltifyStateCard } from "../../shared/ui/LocaltifyViewUi";
import { MediaCard } from "../../shared/ui/MediaCard";
import { PageHeader } from "../../shared/ui/PageHeader";
import { prettyMeta } from "../search/search.utils";
import { artistTarget, useAppActions } from "../shell/appActions";
import { splitArtistCredits } from "./artistCredits";
import "./artists.css";

type ArtistEntry = {
  id: string;
  name: string;
  songs: Song[];
  albumCount: number;
  coverSong: Song;
};

function buildArtists(songs: Song[]): ArtistEntry[] {
  const groups = new Map<string, { name: string; songs: Song[]; albums: Set<string> }>();

  for (const song of songs) {
    for (const name of splitArtistCredits(song.artist)) {
      const id = name.toLocaleLowerCase();
      const group = groups.get(id) || { name, songs: [], albums: new Set<string>() };
      group.songs.push(song);
      const album = song.album?.trim().toLocaleLowerCase();
      if (album) group.albums.add(album);
      groups.set(id, group);
    }
  }

  return [...groups.entries()]
    .map(([id, group]) => ({
      id,
      name: group.name,
      songs: group.songs,
      albumCount: group.albums.size,
      coverSong: group.songs.find((song) => Boolean(song.coverUrl || song.coverPath || song.coverThumbnailUrl)) || group.songs[0]
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export type ArtistsViewProps = {
  songs: Song[];
};

/** Every artist credited in the library. Clicking one opens its artist page. */
export default function ArtistsView({ songs }: ArtistsViewProps) {
  const actions = useAppActions();
  const [query, setQuery] = useState("");
  const [artistLimit, setArtistLimit] = useState(150);
  const artists = useMemo(() => buildArtists(songs), [songs]);
  const visibleArtists = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return artists;
    const exactMatches = artists.filter((artist) => artist.name.toLocaleLowerCase() === needle);
    if (exactMatches.length) return exactMatches;
    return artists.filter((artist) => artist.name.toLocaleLowerCase().includes(needle));
  }, [artists, query]);

  useEffect(() => setArtistLimit(150), [query]);

  return (
    <section data-page-section="artists" className="artistsPage" aria-label="artists">
      <PageHeader
        eyebrow="local artists"
        title="Artists"
        description="Every artist in your song tags. Semicolon and “feat.” credits are listed individually."
      >
        <input
          className="pageHeaderSearch"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="search artists"
          aria-label="search artists"
        />
        <span className="pageHeaderCount"><strong>{visibleArtists.length}</strong> artist{visibleArtists.length === 1 ? "" : "s"}</span>
      </PageHeader>

      {visibleArtists.length ? (
        <>
        <div className="artistsGrid">
          {visibleArtists.slice(0, artistLimit).map((artist) => {
            const target = artistTarget(artist.name, artist.songs);
            return (
              <MediaCard
                key={artist.id}
                className="artistCard"
                coverClassName="artistCardCoverWrap"
                openLabel={`open ${artist.name}`}
                playLabel={`play ${artist.name}`}
                onOpen={() => actions.openCollection(target)}
                onPlay={() => actions.playCollection(target)}
                onContextMenu={(event) => actions.openCollectionMenu(event, target)}
                cover={<Cover song={artist.coverSong} className="artistCardCover" />}
              >
                <span>
                  <strong title={artist.name}>{prettyMeta(artist.name)}</strong>
                  <small>{artist.songs.length} track{artist.songs.length === 1 ? "" : "s"} · {artist.albumCount} album{artist.albumCount === 1 ? "" : "s"}</small>
                </span>
              </MediaCard>
            );
          })}
        </div>
        {visibleArtists.length > artistLimit ? (
          <button type="button" className="softButton artistLoadMore" onClick={() => setArtistLimit((limit) => limit + 150)}>show more artists</button>
        ) : null}
        </>
      ) : (
        <LocaltifyStateCard
          centered
          tone="info"
          eyebrow="artists"
          title={songs.length ? "No artists found" : "No artists yet"}
          message={songs.length ? "Try a different artist or album name." : "Import songs and Localitfy will build your artist shelf from their metadata."}
          actions={query ? <button type="button" className="softButton" onClick={() => setQuery("")}>clear search</button> : undefined}
        />
      )}
    </section>
  );
}
