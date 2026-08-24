import { APP_VERSION } from "../updates/update.constants";
import { ONBOARDING_STORAGE_KEY } from "../library/library.constants";

const RELEASE_SHOWCASE_KEY = `localitfy.onboarding.release-showcase.${APP_VERSION}`;

export function shouldOpenOnboardingForThisRelease() {
  try {
    const oldOnboardingDone = window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "done";
    const releaseShowcaseDone = window.localStorage.getItem(RELEASE_SHOWCASE_KEY) === "done";
    return !oldOnboardingDone || !releaseShowcaseDone;
  } catch {
    return true;
  }
}

export function markOnboardingSeenForThisRelease() {
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "done");
    window.localStorage.setItem(RELEASE_SHOWCASE_KEY, "done");
  } catch {
    // Storage errors must never block playback.
  }
}

export function resetOnboardingForThisRelease() {
  try {
    window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    window.localStorage.removeItem(RELEASE_SHOWCASE_KEY);
  } catch {
    // Ignore reset storage errors.
  }
}
