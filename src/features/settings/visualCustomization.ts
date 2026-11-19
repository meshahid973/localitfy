import { normalizeCoverColorSyncMode, normalizeThemeId } from "./theme.utils";
import type { Settings, LegacyThemeSettings } from "./settings.types";

export const VISUAL_CUSTOMIZATION_DEFAULTS = {
  homeBannerType: "dynamic",
  mediaCardBackground: "glassy",
  homeLayoutMode: "balanced",
  libraryRowStyle: "comfyRows",
  sidebarBehavior: "slim",
  playerBackgroundStyle: "coverBlur"
} as const;

function normalizeChoice(value: unknown, allowed: readonly string[], fallback: string) {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}

export function applyVisualCustomizationDefaults<T extends Record<string, any>>(settings: T): T {
  // Old fields are inert compatibility data. Preserve saved colors and disable
  // retired controls without letting them into the active Settings type.
  return {
    ...settings,
    theme: normalizeThemeId(settings.theme),
    customThemeEnabled: false,
    simpleMode: false,
    homeExpanded: false,
    quickLibraryMoreBlur: false,
    showRightColumn: false,
    homeBannerType: normalizeChoice(settings.homeBannerType, ["dynamic", "albumCover", "cleanBlack", "none"], VISUAL_CUSTOMIZATION_DEFAULTS.homeBannerType),
    blurEffects: "normal",
    mediaCardBackground: normalizeChoice(settings.mediaCardBackground, ["solid", "glassy", "oledFlat"], VISUAL_CUSTOMIZATION_DEFAULTS.mediaCardBackground),
    homeLayoutMode: normalizeChoice(settings.homeLayoutMode, ["compact", "balanced", "bigHero"], VISUAL_CUSTOMIZATION_DEFAULTS.homeLayoutMode),
    libraryRowStyle: normalizeChoice(settings.libraryRowStyle, ["compactRows", "comfyRows", "coverCards", "listOnly"], VISUAL_CUSTOMIZATION_DEFAULTS.libraryRowStyle),
    starsIntensity: "off",
    sidebarBehavior: normalizeChoice(settings.sidebarBehavior, ["fixed", "slim", "hover"], VISUAL_CUSTOMIZATION_DEFAULTS.sidebarBehavior),
    playerBackgroundStyle: normalizeChoice(settings.playerBackgroundStyle, ["flat", "coverBlur", "oledBlack"], VISUAL_CUSTOMIZATION_DEFAULTS.playerBackgroundStyle),
    homeHeroCoverBrightness: Number.isFinite(Number(settings.homeHeroCoverBrightness)) ? Math.min(1.55, Math.max(0.65, Number(settings.homeHeroCoverBrightness))) : 1,
    catBuddyEnabled: settings.catBuddyEnabled === true
  };
}

/** Migrate saved visual settings once at bootstrap, preserving unknown legacy data for rollback. */
export function migrateVisualSettings(raw: unknown, defaults: Settings, releaseDefaults?: Partial<Settings>) {
  const stored = (raw && typeof raw === "object" ? raw : {}) as Partial<Settings> & LegacyThemeSettings & { theme?: unknown };
  const settings = applyVisualCustomizationDefaults({ ...defaults, ...releaseDefaults, ...stored } as Settings);
  settings.animatedBackgrounds = true;
  settings.animeVisuals = true;
  settings.coverColorSyncMode = normalizeCoverColorSyncMode(stored.coverColorSyncMode ??
    (stored.showAmbientGradient === false ? "off" : settings.coverColorSyncMode));
  settings.showAmbientGradient = settings.coverColorSyncMode !== "off";
  const activeKeys = ["theme", "homeBannerType", "mediaCardBackground", "homeLayoutMode", "libraryRowStyle",
    "sidebarBehavior", "playerBackgroundStyle", "homeHeroCoverBrightness", "catBuddyEnabled",
    "animatedBackgrounds", "animeVisuals", "coverColorSyncMode", "showAmbientGradient"] as const;
  const changed = activeKeys.some(key => settings[key] !== stored[key]) ||
    stored.customThemeEnabled === true || stored.simpleMode === true ||
    (stored.starsIntensity !== undefined && stored.starsIntensity !== "off") ||
    (stored.blurEffects !== undefined && stored.blurEffects !== "normal") ||
    stored.homeExpanded === true || stored.quickLibraryMoreBlur === true || stored.showRightColumn === true;
  return {settings, changed};
}
