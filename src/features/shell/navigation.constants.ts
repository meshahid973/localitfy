import { BarChart3, Disc3, Download, Heart, Home, Images, LibraryBig, ListMusic, Settings as SettingsIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { View } from "./view.types";
export const navItems: Array<{ id: View; label: string; hint: string; icon: LucideIcon }> = [
  { id:"home", label:"home", hint:"now playing", icon:Home }, { id:"library", label:"library", hint:"all songs", icon:LibraryBig }, { id:"albums", label:"albums", hint:"local albums", icon:Disc3 }, { id:"playlists", label:"playlists", hint:"your mixes", icon:ListMusic }, { id:"liked", label:"liked", hint:"favorites", icon:Heart }, { id:"covers", label:"covers", hint:"pixel art", icon:Images }, { id:"analytics", label:"analytics", hint:"stats", icon:BarChart3 }, { id:"downloads", label:"downloads", hint:"imports", icon:Download }, { id:"settings", label:"settings", hint:"controls", icon:SettingsIcon }
];
export const sidebarNavGroups: Array<{ id:"library"|"tools"|"app"; label:string; itemIds:View[] }> = [
  { id:"library", label:"library", itemIds:["home","library","liked","albums","playlists"] }, { id:"tools", label:"tools", itemIds:["downloads","covers","analytics"] }, { id:"app", label:"app", itemIds:["settings"] }
];
