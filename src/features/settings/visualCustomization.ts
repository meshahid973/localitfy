export const VISUAL_CUSTOMIZATION_DEFAULTS = {
  homeBannerType: "dynamic",
  blurEffects: "normal",
  mediaCardBackground: "glassy",
  homeLayoutMode: "balanced",
  libraryRowStyle: "comfyRows",
  starsIntensity: "off",
  sidebarBehavior: "fixed",
  playerBackgroundStyle: "coverBlur"
} as const;

function normalizeChoice(value: unknown, allowed: readonly string[], fallback: string) {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}

export function applyVisualCustomizationDefaults<T extends Record<string, any>>(settings: T): T {
  // These keys belonged to the removed Home Quick Library/right-column layout.
  // Strip them from both defaults and persisted settings so old installs cannot
  // silently re-enable the retired layout or its extra-blur compositor path.
  const {
    homeExpanded: _retiredHomeExpanded,
    quickLibraryMoreBlur: _retiredQuickLibraryMoreBlur,
    showRightColumn: _retiredShowRightColumn,
    ...rest
  } = settings;

  return {
    ...rest,
    homeBannerType: normalizeChoice(settings.homeBannerType, ["dynamic", "albumCover", "cleanBlack", "none"], VISUAL_CUSTOMIZATION_DEFAULTS.homeBannerType),
    blurEffects: VISUAL_CUSTOMIZATION_DEFAULTS.blurEffects,
    mediaCardBackground: normalizeChoice(settings.mediaCardBackground, ["solid", "glassy", "oledFlat"], VISUAL_CUSTOMIZATION_DEFAULTS.mediaCardBackground),
    homeLayoutMode: normalizeChoice(settings.homeLayoutMode, ["compact", "balanced", "bigHero"], VISUAL_CUSTOMIZATION_DEFAULTS.homeLayoutMode),
    libraryRowStyle: normalizeChoice(settings.libraryRowStyle, ["compactRows", "comfyRows", "coverCards", "listOnly"], VISUAL_CUSTOMIZATION_DEFAULTS.libraryRowStyle),
    starsIntensity: normalizeChoice(settings.starsIntensity, ["off", "subtle", "normal", "bright"], "off"),
    sidebarBehavior: normalizeChoice(settings.sidebarBehavior, ["fixed", "slim", "hover"], VISUAL_CUSTOMIZATION_DEFAULTS.sidebarBehavior),
    playerBackgroundStyle: normalizeChoice(settings.playerBackgroundStyle, ["flat", "coverBlur", "oledBlack"], VISUAL_CUSTOMIZATION_DEFAULTS.playerBackgroundStyle),
    homeHeroCoverBrightness: Number.isFinite(Number(settings.homeHeroCoverBrightness)) ? Math.min(1.55, Math.max(0.65, Number(settings.homeHeroCoverBrightness))) : 1,
    catBuddyEnabled: settings.catBuddyEnabled === true
  } as T;
}
