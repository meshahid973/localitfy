export type CoverMood = "all" | "favorites" | "leastUsed" | "cute" | "space" | "dark" | "cozy" | "energy";

export type PixelArtAsset = {
  file: string;
  label: string;
  discordKey: string;
};

export type RuntimePixelArtAsset = PixelArtAsset & {
  path?: string;
  url?: string;
};

export type PixelArtBridgeAsset = {
  name?: string;
  key?: string;
  path?: string;
  url?: string;
};
