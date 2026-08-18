import type { CoverMood, RuntimePixelArtAsset } from "./cover.types";
import type { Song } from "../library/song.types";
import { DEFAULT_RUNTIME_PIXEL_ART_ASSETS, cleanStringList, getCachedRuntimePixelArtAssets, pixelArtUrl } from "./pixelArt";
import { coverMoodOptions } from "../settings/settings.constants";
export const stableHash=(input:string)=>{let hash=2166136261;for(let i=0;i<input.length;i+=1){hash^=input.charCodeAt(i);hash=Math.imul(hash,16777619);}return hash>>>0;};
export const seededUnit=(seed:number,salt:number)=>{const raw=Math.sin((seed+salt*1009)*12.9898)*43758.5453123;return raw-Math.floor(raw);};
export const songSignature=(song?:Song|null)=>song?[song.id,song.title,song.artist,song.album,song.duration,song.filePath].filter(Boolean).join("::").toLowerCase():"localitfy-idle";
export const pixelArtForSong=(song?:Song|null):RuntimePixelArtAsset=>{const pool=getCachedRuntimePixelArtAssets();return pool[stableHash(songSignature(song))%Math.max(1,pool.length)]||DEFAULT_RUNTIME_PIXEL_ART_ASSETS[0];};
export const nextPixelArtForSong=(song?:Song|null):RuntimePixelArtAsset=>{const pool=getCachedRuntimePixelArtAssets();return pool[(stableHash(`${songSignature(song)}::next`)+7)%Math.max(1,pool.length)]||DEFAULT_RUNTIME_PIXEL_ART_ASSETS[0];};
export function getSongCoverUsageKeys(song:Song){return cleanStringList([song.coverPath,song.coverUrl,song.coverUrl?song.coverUrl.split(/[\\/]/).pop():"",song.coverPath?song.coverPath.split(/[\\/]/).pop():""]);}
export function getPixelAssetMoodTags(asset:RuntimePixelArtAsset):CoverMood[]{const h=`${asset.file} ${asset.label} ${asset.path||""} ${asset.url||""}`.toLowerCase();const tags=new Set<CoverMood>();if(/cat|miku|anime|girl|gumball|mita|marie|wand|hello|cute|peace/.test(h))tags.add("cute");if(/space|earth|star|meteor|glow|sky|planet/.test(h))tags.add("space");if(/black|night|dark|void|shadow/.test(h))tags.add("dark");if(/beach|peace|house|laying|soft|cozy|calm/.test(h))tags.add("cozy");if(/fortnite|ringing|meteor|content|glitch|neon|energy/.test(h))tags.add("energy");if(!tags.size)tags.add("cozy");return[...tags];}
export function coverMoodName(mood:CoverMood){return coverMoodOptions.find((option)=>option.id===mood)?.label||mood;}
export function getPixelArtAssetKey(asset:RuntimePixelArtAsset){return String(asset.path||asset.url||(asset.file?pixelArtUrl(asset.file):asset.label)||"").trim();}
