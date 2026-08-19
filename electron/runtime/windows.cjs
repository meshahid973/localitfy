const DEFAULT_WINDOW_TRANSLUCENCY = Object.freeze({
  translucentWindow: true,
  windowTransparency: 82,
  windowBlur: 18,
  transparentAppBackground: true
});

function clampWindowNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function normalizeWindowTranslucencySettings(settings = {}) {
  const source = settings && typeof settings === "object" ? settings : {};
  return {
    translucentWindow: Boolean(source.translucentWindow ?? DEFAULT_WINDOW_TRANSLUCENCY.translucentWindow),
    windowTransparency: clampWindowNumber(
      source.windowTransparency,
      DEFAULT_WINDOW_TRANSLUCENCY.windowTransparency,
      12,
      88
    ),
    windowBlur: clampWindowNumber(source.windowBlur, DEFAULT_WINDOW_TRANSLUCENCY.windowBlur, 0, 36),
    transparentAppBackground: source.transparentAppBackground !== false
  };
}

module.exports = {
  DEFAULT_WINDOW_TRANSLUCENCY,
  normalizeWindowTranslucencySettings
};
