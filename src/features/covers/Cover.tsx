import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { Song } from "../library/song.types";
import { getRendererSafeImageUrl } from "./cover.ambient";
import { nextPixelArtForSong, pixelArtForSong } from "./cover.runtime";
import { runtimePixelArtImageUrl } from "./pixelArt";
import { prettyTitle } from "../search/search.utils";
import { toCssUrl } from "../../shared/utils/format";

export type CoverImagePriority = "auto" | "high" | "low";
export function getCardCoverUrl(song?: Song | null) {
  return getRendererSafeImageUrl(song?.coverThumbUrl || song?.coverThumbnailUrl || song?.thumbnailUrl || song?.coverUrl || song?.coverPath || "");
}

export function getFullCoverUrl(song?: Song | null) {
  return getRendererSafeImageUrl(song?.coverFullUrl || song?.coverUrl || song?.coverPath || "");
}


export function getCardCoverCssUrl(song?: Song | null) {
  const coverUrl = getCardCoverUrl(song);
  if (!coverUrl) return "none";
  return `url("${coverUrl.replace(/["\\]/g, "\\$&")}")`;
}

export function Cover({ song, className, priority = "auto" }: { song: Song | null; className: string; priority?: CoverImagePriority }) {
  const [failedSources, setFailedSources] = useState<Record<string, boolean>>({});
  const [imageReady, setImageReady] = useState(false);
  const isImmediateCover = priority === "high" || (priority === "auto" && /\b(heroArt|smallArt|importCoverArt|editorCover)\b/.test(className));
  const coverLoadingMode = isImmediateCover ? "eager" : "lazy";
  const coverFetchPriority = isImmediateCover ? "high" : "low";
  const coverIntrinsicSize = isImmediateCover ? 512 : 260;

  const directCover = isImmediateCover ? getFullCoverUrl(song) : getCardCoverUrl(song);
  const savedCover = String(song?.coverPath || "").trim();
  const savedCoverSrc = getRendererSafeImageUrl(savedCover);
  const fallbackAsset = song ? pixelArtForSong(song) : null;
  const backupFallbackAsset = song ? nextPixelArtForSong(song) : null;
  const fallbackSrc = runtimePixelArtImageUrl(fallbackAsset);
  const backupFallbackSrc = runtimePixelArtImageUrl(backupFallbackAsset);

  const sourceCandidates = [directCover, savedCoverSrc, fallbackSrc, backupFallbackSrc]
    .map((source) => source.trim())
    .filter(Boolean);
  const coverSrc = sourceCandidates.find((source) => !failedSources[source]) || "";
  const hasCover = Boolean(coverSrc);
  const fallback = song ? prettyTitle(song.title, 1).slice(0, 1) || "?" : "?";
  const style = hasCover ? ({ "--cover-art-url": toCssUrl(coverSrc), "--cover-url": toCssUrl(coverSrc) } as CSSProperties) : undefined;

  useEffect(() => {
    setFailedSources({});
    setImageReady(false);
  }, [song?.id, song?.coverUrl, song?.coverThumbUrl, song?.coverThumbnailUrl, song?.thumbnailUrl, song?.coverPath]);

  useEffect(() => {
    setImageReady(false);
  }, [coverSrc]);

  return (
    <div
      className={`coverAura ${className} ${hasCover ? "hasCover" : "noCover"} ${imageReady ? "coverReady" : "coverLoading"}`}
      style={style}
      data-cover-title={song?.title ?? "localtify"}
    >
      <span className="coverPlaceholder" aria-hidden="true">
        {fallback}
      </span>

      {hasCover ? (
        <img
          key={coverSrc}
          className={`coverImage ${imageReady ? "isLoaded" : ""}`}
          src={coverSrc}
          alt=""
          width={coverIntrinsicSize}
          height={coverIntrinsicSize}
          draggable={false}
          loading={coverLoadingMode}
          decoding="async"
          fetchPriority={coverFetchPriority}
          referrerPolicy="no-referrer"
          onLoad={() => setImageReady(true)}
          onError={() => {
            setImageReady(false);
            setFailedSources((old) => ({ ...old, [coverSrc]: true }));
          }}
        />
      ) : null}
    </div>
  );
}
