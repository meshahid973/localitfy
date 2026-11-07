import { BarChart3, Compass, Disc3, Download, Heart, Home, Images, LibraryBig, ListMusic, Settings as SettingsIcon, Tags, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { View } from "./view.types";
export const navItems: Array<{ id: View; label: string; hint: string; icon: LucideIcon }> = [
  { id:"home", label:"home", hint:"now playing", icon:Home }, { id:"library", label:"library", hint:"all songs", icon:LibraryBig }, { id:"artists", label:"artists", hint:"browse artists", icon:UsersRound }, { id:"genres", label:"genres", hint:"browse genres", icon:Tags }, { id:"albums", label:"albums", hint:"local albums", icon:Disc3 }, { id:"playlists", label:"playlists", hint:"your mixes", icon:ListMusic }, { id:"discover", label:"discover", hint:"new music", icon:Compass }, { id:"liked", label:"liked", hint:"favorites", icon:Heart }, { id:"covers", label:"covers", hint:"pixel art", icon:Images }, { id:"analytics", label:"analytics", hint:"stats", icon:BarChart3 }, { id:"downloads", label:"downloads", hint:"imports", icon:Download }, { id:"settings", label:"settings", hint:"controls", icon:SettingsIcon }
];
export const sidebarNavGroups: Array<{ id:"library"|"tools"|"app"; label:string; itemIds:View[] }> = [
  { id:"library", label:"library", itemIds:["home","library","liked","artists","genres","albums","playlists","discover"] }, { id:"tools", label:"tools", itemIds:["downloads","covers","analytics"] }, { id:"app", label:"app", itemIds:["settings"] }
];

/** Pages the phone app leaves to the Mac (importing, downloading, the cover studio). */
export const MAC_ONLY_VIEWS = new Set<View>(["downloads", "covers"]);
