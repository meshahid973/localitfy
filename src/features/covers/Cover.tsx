import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Song } from "../library/song.types";
import { getRendererSafeImageUrl } from "./cover.ambient";
import { nextPixelArtForSong, pixelArtForSong } from "./cover.runtime";
import { runtimePixelArtImageUrl } from "./pixelArt";
import { prettyTitle } from "../search/search.utils";
import { toCssUrl } from "../../shared/utils/format";
import { observeArtwork, retainThumbnail, useCompletedThumbnail, type ThumbnailSize } from "./thumbnailResource";

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

export const Cover = memo(function Cover({ song, className, priority = "auto", preferThumbnail = false }: { song: Song | null; className: string; priority?: CoverImagePriority; preferThumbnail?: boolean }) {
  const [failedSources, setFailedSources] = useState<Record<string, boolean>>({});
  // Readiness is tied to the URL that actually loaded. A song update that keeps the same URL must not
  // hide the image again: the mounted <img> would never fire another load event.
  const [loadedSrc, setLoadedSrc] = useState("");
  const isImmediateCover = priority === "high" || (priority === "auto" && /\b(heroArt|smallArt|importCoverArt|editorCover)\b/.test(className));
  const coverLoadingMode = isImmediateCover ? "eager" : "lazy";
  const coverFetchPriority = isImmediateCover ? "high" : "low";
  const useFullCover = isImmediateCover && !preferThumbnail;
  const [viewport, setViewport] = useState<{near: boolean; size: ThumbnailSize}>({near: false, size: 256});
  const coverIntrinsicSize = useFullCover ? 512 : viewport.size;

  const directCover = useFullCover ? getFullCoverUrl(song) : getCardCoverUrl(song);
  const savedCover = String(song?.coverPath || "").trim();
  const savedCoverSrc = getRendererSafeImageUrl(savedCover);
  // A broken thumbnail must fall back to the actual original, not a placeholder.
  const sourceCandidates = [directCover, getFullCoverUrl(song), savedCoverSrc];
  const fullSource = getFullCoverUrl(song);
  const completedThumbnail = useCompletedThumbnail(useFullCover ? "" : fullSource, viewport.size);
  const anchor = useRef<HTMLDivElement>(null);
  const thumbnailSource = completedThumbnail || (viewport.size === 256 && directCover !== fullSource ? directCover : "");
  const thumbnailFailed = Boolean(thumbnailSource && failedSources[thumbnailSource]);
  const songId = song?.id;
  useEffect(() => {
    if (!anchor.current || useFullCover || !window.localitfy?.requestCoverThumbnail) return;
    return observeArtwork(anchor.current, (near, size) => {
      setViewport(previous => previous.near === near && previous.size === size ? previous : {near, size});
    });
  }, [useFullCover]);
  useEffect(() => {
    if (useFullCover || !viewport.near || !songId || !fullSource || (thumbnailSource && !thumbnailFailed)) return;
    return retainThumbnail(songId, fullSource, viewport.size, thumbnailFailed ? thumbnailSource : undefined);
  }, [useFullCover, viewport, songId, fullSource, thumbnailSource, thumbnailFailed]);
  if (completedThumbnail) sourceCandidates.unshift(completedThumbnail);
  let coverSrc = sourceCandidates.find(source => source && !failedSources[source]) || "";
  // Most tracks have real art; avoid hashing metadata and resolving fallback
  // assets unless the real cover is unavailable.
  if (!coverSrc && song) {
    const fallbackSrc = runtimePixelArtImageUrl(pixelArtForSong(song));
    if (fallbackSrc && !failedSources[fallbackSrc]) coverSrc = fallbackSrc;
    else {
      const backup = runtimePixelArtImageUrl(nextPixelArtForSong(song));
      if (backup && !failedSources[backup]) coverSrc = backup;
    }
  }
  const hasCover = Boolean(coverSrc);
  const imageReady = hasCover && loadedSrc === coverSrc;
  const imageRef = useRef<HTMLImageElement>(null);
  // A memory/disk-cached image may already be complete before its load handler.
  useLayoutEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) setLoadedSrc(coverSrc);
  }, [coverSrc]);
  const fallback = song ? prettyTitle(song.title, 1).slice(0, 1) || "?" : "?";
  const style = hasCover ? ({ "--cover-art-url": toCssUrl(coverSrc), "--cover-url": toCssUrl(coverSrc) } as CSSProperties) : undefined;

  useEffect(() => {
    setFailedSources(previous => Object.keys(previous).length ? {} : previous);
  }, [song?.id, song?.coverFullUrl, song?.coverUrl, song?.coverThumbUrl, song?.coverThumbnailUrl, song?.thumbnailUrl, song?.coverPath]);

  return (
    <div
      ref={anchor}
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
          ref={imageRef}
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
          onLoad={() => setLoadedSrc(coverSrc)}
          onError={() => setFailedSources((old) => ({ ...old, [coverSrc]: true }))}
        />
      ) : null}
    </div>
  );
});
