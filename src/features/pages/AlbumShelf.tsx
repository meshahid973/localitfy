import { MediaCard } from "../../shared/ui/MediaCard";
import { Cover } from "../covers/Cover";
import { prettyMeta, prettyTitle } from "../search/search.utils";
import { albumTarget, useAppActions } from "../shell/appActions";
import type { LocalAlbumEntry } from "../albums/album.types";

/** A titled grid of album cards on a collection page. */
export default function AlbumShelf({ title, albums }: { title: string; albums: readonly LocalAlbumEntry[] }) {
  const actions = useAppActions();
  return (
    <section className="collectionSection" aria-label={title}>
      <h2>{title}</h2>
      <div className="collectionCardGrid">
        {albums.map((album) => {
          const target = albumTarget(album);
          return (
            <MediaCard key={album.id} className="collectionCard" openLabel={`open ${album.title} album`} playLabel={`play ${album.title}`}
              onOpen={() => actions.openCollection(target)} onPlay={() => actions.playCollection(target)}
              onContextMenu={(event) => actions.openCollectionMenu(event, target)}
              cover={<Cover song={album.coverSong} className="collectionCardArt" />}>
              <strong title={album.title}>{prettyTitle(album.title, 6)}</strong>
              <small>{[album.year, prettyMeta(album.albumArtist || album.artist)].filter(Boolean).join(" · ")}</small>
            </MediaCard>
          );
        })}
      </div>
    </section>
  );
}
