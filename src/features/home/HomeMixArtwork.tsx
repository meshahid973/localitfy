import type { Song } from "../library/song.types";
import { MixCoverArtwork } from "../covers/MixCoverArtwork";

export function HomeMixArtwork({ songs }: { id: string; name: string; songs: readonly Song[]; ordinal: number }) {
  return <MixCoverArtwork songs={songs} className="homeReleaseCoverWrap" />;
}
