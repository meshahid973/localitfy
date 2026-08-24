import type { DiscordActivityStyle, DiscordArtMode, DiscordSecondLine, DiscordTitleCleanup } from "./discord.types";
export const LOCALITFY_DOWNLOAD_URL = "https://github.com/meshahid973/localitfy/releases/latest";
export const LOCALITFY_SOURCE_URL = "https://github.com/meshahid973/localitfy";
export const DISCORD_LOGO_ASSET = "earthglow";
export const discordStyleOptions: Array<{id:DiscordActivityStyle;name:string;note:string}> = [
  {id:"clean",name:"Clean",note:"Show the title and selected second line."},{id:"cute",name:"Cute",note:"Use a softer status style."},{id:"detailed",name:"Detailed",note:"Show artist, album, and time details."},{id:"minimal",name:"Minimal",note:"Show a simple title and artist."},{id:"meme",name:"Meme",note:"Use a lighter Discord status style."}
];
export const discordArtModeOptions: Array<{id:DiscordArtMode;name:string;note:string}> = [
  {id:"randomPixel",name:"Pixel shuffle",note:"Use a random pixel art image for each song."},{id:"albumCover",name:"Song cover",note:"Use the current song cover when possible."},{id:"logo",name:"Logo only",note:"Use the localtify logo."},{id:"none",name:"No large image",note:"Show no large image."}
];
export const discordCleanupOptions: Array<{id:DiscordTitleCleanup;name:string;note:string}> = [
  {id:"off",name:"Off",note:"keep original"},{id:"light",name:"Light",note:"clean filename only"},{id:"heavy",name:"Heavy",note:"remove audio junk"}
];
export const discordSecondLineOptions: Array<{id:DiscordSecondLine;name:string;note:string}> = [
  {id:"artist",name:"Artist",note:"show artist name"},{id:"album",name:"Album",note:"show album name"},{id:"timeLeft",name:"Time left",note:"remaining time"},{id:"playCount",name:"Count",note:"times played"},{id:"appName",name:"App",note:"from localtify"}
];
export const DISCORD_HASH_ASSET_KEYS = ["28c5d68dccf1fb03e939e1bd59eee485","2e7b21cb459fb08d135b2b9f6aa673e7","34a2b4266a9e1c1b09a842e24508eba8","3c6d3a6d7de389f664f9c6c46d81356a","40b7313f6d324ea27b0de2a5bfc3d903","47e615582babeca0e1b683bc3a7282a6","6889208e0600df4bdd975e867a147ad9","70b62000ff8794fe9d885235eb2b20a1","76412f8797d881310fe6c0532f7214af","9ddd013bcaabc39173c34642de5cd425","9fa42c9757a71f479d873f77121b8e97","a1484e915622e681bbdc484b93ce7288","c0ac14763553f0dff275e3b558e1121d","d3004f1d9ef904124c9f4778bfca8cc0","dcd577d1d9f08b535a573fc0a90c2a77","e23598836900abf05ae7acd2f56464d7","eabd17ab2f36db183bbf4ad98043e1bb","f40ffeed5b3b1be61709df79c1bb2f35"] as const;
export const DISCORD_NAMED_ASSET_KEYS = ["2cats","2tankpeople","4glasses","animepixell","animepixel","beach_house","blackcat","blackcatlaying","callhello","catinspace","catquestion","content","earthglow","erikaringingyobell","gumballl","marie","mikuinfortnite","mikuuu","mitapixel","peaceanime","smallcatwithwand","smallmita","somegirl","somegirllooking","spaceearth","spacemetor","starpersonlookup"] as const;
export const DISCORD_ASSET_KEYS = [...DISCORD_NAMED_ASSET_KEYS, ...DISCORD_HASH_ASSET_KEYS] as const;
