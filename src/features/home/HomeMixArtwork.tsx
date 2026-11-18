import type { Song } from "../library/song.types";
import { CollectionArtwork } from "../covers/CollectionArtwork";

export function HomeMixArtwork(props: { id: string; name: string; songs: readonly Song[]; ordinal: number }) {
  return <CollectionArtwork {...props} className="homeReleaseCoverWrap" />;
}
