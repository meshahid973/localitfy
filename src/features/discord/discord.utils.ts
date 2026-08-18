import { LOCALITIFY_DOWNLOAD_URL } from "./discord.constants";
export const discordKeyFromFileName = (file: string) => String(file || "").split(/[\\/]/).pop()!.replace(/\.[a-z0-9]+$/i, "").trim().toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"") || "earthglow";
export function buildDiscordSongSearchUrl(title: string, artist: string) { const query=[artist,title].map((part)=>String(part||"").trim()).filter(Boolean).join(" ").trim(); return query ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}` : LOCALITIFY_DOWNLOAD_URL; }
