export const mascotAssets = {
  empty: new URL("./assets/empty-state.png", import.meta.url).href,
  happy: new URL("./assets/happy-state.png", import.meta.url).href,
  question: new URL("./assets/question-state.png", import.meta.url).href,
  info: new URL("./assets/info-state.png", import.meta.url).href,
  warning: new URL("./assets/warning-state.png", import.meta.url).href,
  danger: new URL("./assets/danger-state.png", import.meta.url).href,
  error: new URL("./assets/error-state.png", import.meta.url).href,
  loading: new URL("./assets/loading-state.png", import.meta.url).href,
  confused: new URL("./assets/question-state.png", import.meta.url).href,
  neutral: new URL("./assets/empty-state.png", import.meta.url).href,
  peekOnboarding: new URL("./assets/peek-onboarding.png", import.meta.url).href
} as const;

export type MascotStateKey = keyof typeof mascotAssets;

export const localtifyAssets = {
  logo: new URL("./assets/logo.png", import.meta.url).href,
  onboardingAudio: new URL("./assets/onboarding.mp3", import.meta.url).href,
  mascot: mascotAssets
} as const;
