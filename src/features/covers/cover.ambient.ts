import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { FastAverageColor } from "fast-average-color";
import type { Song } from "../library/song.types";
import { toCssUrl } from "../../shared/utils/format";
import { hexToRgbString, normalizeHexColor } from "../settings/theme.utils";
import { pixelArtForSong } from "./cover.runtime";
import { runtimePixelArtImageUrl } from "./pixelArt";
export function getAmbientStyle(coverUrl?:string|null):CSSProperties|undefined{return coverUrl?{"--cover-url":toCssUrl(coverUrl),"--cover-art-url":toCssUrl(coverUrl)} as CSSProperties:undefined;}
export function isRendererSafeImageUrl(value?:string|null){return Boolean(value&&/^(?:data:image\/|blob:|https?:\/\/|localtify-media:\/\/|\/|pixelart\/)/i.test(String(value).trim()));}
export function getRendererSafeImageUrl(value?:string|null){const source=String(value||"").trim();return isRendererSafeImageUrl(source)?source:"";}
export function getSongAmbientSource(song?:Song|null){if(!song)return"";return getRendererSafeImageUrl(song.coverUrl)||getRendererSafeImageUrl(song.coverPath)||runtimePixelArtImageUrl(pixelArtForSong(song));}
export type CoverAverageStyle=CSSProperties&{"--cover-rgb"?:string;"--player-ambient-rgb"?:string;"--active-cover-rgb"?:string;"--cover-average"?:string};
const MAX_COVER_COLORS = 512;
const coverAverageColorCache = new Map<string, CoverAverageStyle>();
const EMPTY_COVER_STYLE: CoverAverageStyle = {};

function cachedCoverStyle(source: string) {
  const style = coverAverageColorCache.get(source);
  if (style) {
    coverAverageColorCache.delete(source);
    coverAverageColorCache.set(source, style);
  }
  return style;
}

function rememberCoverStyle(source: string, style: CoverAverageStyle) {
  coverAverageColorCache.delete(source);
  coverAverageColorCache.set(source, style);
  if (coverAverageColorCache.size > MAX_COVER_COLORS) {
    const oldest = coverAverageColorCache.keys().next();
    if (!oldest.done) coverAverageColorCache.delete(oldest.value);
  }
}
const fastAverageColor=typeof window!=="undefined"?new FastAverageColor():null;
export function buildCoverAverageStyle(hex:string):CoverAverageStyle{const safe=normalizeHexColor(hex,"#8dffce"),rgb=hexToRgbString(safe,"#8dffce");return{"--cover-rgb":rgb,"--player-ambient-rgb":rgb,"--active-cover-rgb":rgb,"--cover-average":safe} as CoverAverageStyle;}
export function useCoverAverageStyle(source:string,enabled:boolean){const[style,setStyle]=useState<CoverAverageStyle>(EMPTY_COVER_STYLE),requestIdRef=useRef(0);useEffect(()=>{const coverSource=String(source||"").trim();if(!enabled||!coverSource||!fastAverageColor){setStyle(EMPTY_COVER_STYLE);return;}const cached=cachedCoverStyle(coverSource);if(cached){setStyle(cached);return;}let cancelled=false;const requestId=++requestIdRef.current;const timer=window.setTimeout(()=>{fastAverageColor.getColorAsync(coverSource,{algorithm:"sqrt",mode:"precision"}).then((color)=>{if(cancelled||requestIdRef.current!==requestId)return;const next=buildCoverAverageStyle(color.hex);rememberCoverStyle(coverSource,next);setStyle(next);}).catch(()=>{if(!cancelled&&requestIdRef.current===requestId)setStyle(EMPTY_COVER_STYLE);});},80);return()=>{cancelled=true;window.clearTimeout(timer);};},[enabled,source]);return style;}
