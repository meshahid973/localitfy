from pathlib import Path

root = Path(__file__).resolve().parents[2]


def read(relative):
    return (root / relative).read_text(encoding="utf-8-sig")


def write(relative, text):
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def remove_block(text, start, end):
    a = text.find(start)
    if a < 0:
        return text
    b = text.find(end, a)
    if b < 0:
        raise SystemExit(f"end anchor missing for {start[:50]}")
    return text[:a] + text[b:]


app = read("src/App.tsx")

# Remove the safe top-level ownership blocks. Generated modules below preserve behavior.
app = remove_block(app, "const LOCALTFY_PLAYER_MORPH_PAUSE = {", "function runLocaltifyIdleTask")
app = remove_block(app, "function runLocaltifyIdleTask", "function localtifyAnalyticsNumber")
app = remove_block(app, "function localtifyAnalyticsNumber", "const VISUAL_CUSTOMIZATION_DEFAULTS")
app = remove_block(app, "const VISUAL_CUSTOMIZATION_DEFAULTS = {", "type LocaltifyPlatformInfo")
app = remove_block(app, "type LocaltifyPlatformInfo = {", "const ONBOARDING_RELEASE_SHOWCASE_KEY")
app = remove_block(app, "const ONBOARDING_RELEASE_SHOWCASE_KEY", "const CUSTOM_THEME_UPDATE_BACKUP_KEY")
app = remove_block(app, "const CUSTOM_THEME_UPDATE_BACKUP_KEY", "function MainModeApp()")

import_anchor = 'import CatBuddy from "./CatBuddy";\n'
imports = '''import { PlayerPlayPauseMorphIcon } from "./features/player/PlayerPlayPauseMorphIcon";\nimport { runLocaltifyIdleTask } from "./app/runtime/idle";\nimport { formatAnalyticsDuration, localtifyAnalyticsNumber, localtifyAnalyticsString } from "./features/analytics/formatters";\nimport { applyVisualCustomizationDefaults } from "./features/settings/visualCustomization";\nimport { getLocaltifyPlatformInfo } from "./app/platform";\nimport {\n  FEEDBACK_CATEGORY_OPTIONS,\n  FEEDBACK_MESSAGE_MAX_LENGTH,\n  FEEDBACK_PROMPT_COPY,\n  FEEDBACK_PROMPT_DELAY_MS,\n  FEEDBACK_PROMPT_RETRY_DELAY_MS,\n  FEEDBACK_PROMPT_SEEN_KEY,\n  LOCALTIFY_041_WHATS_NEW_ITEMS,\n  shouldOpenFeedbackPromptFromGlobalSearch,\n  shouldOpenFeedbackPromptFromSettingsSearch\n} from "./features/feedback/feedbackPrompt";\nimport {\n  markOnboardingSeenForThisRelease,\n  resetOnboardingForThisRelease,\n  shouldOpenOnboardingForThisRelease\n} from "./features/onboarding/onboardingRelease";\nimport {\n  restoreCustomThemeAfterUpdate,\n  writeCustomThemeBackupPatch\n} from "./features/settings/customThemePersistence";\n'''
if 'from "./app/platform"' not in app:
    if import_anchor not in app:
        raise SystemExit("App import anchor missing")
    app = app.replace(import_anchor, import_anchor + imports, 1)
write("src/App.tsx", app)

write(
    "src/features/player/PlayerPlayPauseMorphIcon.tsx",
    '''import { motion as Motion } from "motion/react";\n\nconst PAUSE = { left: "M5 5L9 5L9 19L5 19Z", right: "M15 5L19 5L19 19L15 19Z" } as const;\nconst PLAY = { left: "M7 5L13 8.5L13 15.5L7 19Z", right: "M13 8.5L19 12L19 12L13 15.5Z" } as const;\nconst SPRING = { type: "spring", stiffness: 260, damping: 26, mass: 0.9 } as const;\n\nexport function PlayerPlayPauseMorphIcon({ playing, className = "" }: { playing: boolean; className?: string }) {\n  const target = playing ? PAUSE : PLAY;\n  return (\n    <svg className={`playerMorphIcon ${className}`.trim()} width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">\n      <Motion.path animate={{ d: target.left }} transition={SPRING} initial={false} />\n      <Motion.path animate={{ d: target.right }} transition={SPRING} initial={false} />\n    </svg>\n  );\n}\n''',
)

write(
    "src/app/runtime/idle.ts",
    '''export function runLocaltifyIdleTask(task: () => void, timeout = 1400) {\n  const requestIdleCallback = (window as typeof window & {\n    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;\n  }).requestIdleCallback;\n\n  if (typeof requestIdleCallback === "function") {\n    requestIdleCallback(task, { timeout });\n    return;\n  }\n\n  window.setTimeout(task, 0);\n}\n''',
)

write(
    "src/features/analytics/formatters.ts",
    '''import type { LocaltifyAnalyticsSnapshot } from "./analyticsSnapshot";\n\nexport function localtifyAnalyticsNumber(snapshot: LocaltifyAnalyticsSnapshot, key: string, fallback = 0) {\n  const value = Number(snapshot[key]);\n  return Number.isFinite(value) ? value : fallback;\n}\n\nexport function localtifyAnalyticsString(snapshot: LocaltifyAnalyticsSnapshot, key: string, fallback = "") {\n  const value = snapshot[key];\n  return typeof value === "string" && value.trim() ? value : fallback;\n}\n\nexport function formatAnalyticsDuration(seconds: number) {\n  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));\n  const hours = Math.floor(safeSeconds / 3600);\n  const minutes = Math.floor((safeSeconds % 3600) / 60);\n  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;\n  if (minutes > 0) return `${minutes}m`;\n  return `${safeSeconds}s`;\n}\n''',
)

write(
    "src/features/settings/visualCustomization.ts",
    '''const DEFAULTS = {\n  homeBannerType: "dynamic",\n  blurEffects: "normal",\n  mediaCardBackground: "glassy",\n  homeLayoutMode: "balanced",\n  libraryRowStyle: "comfyRows",\n  starsIntensity: "off",\n  sidebarBehavior: "fixed",\n  playerBackgroundStyle: "coverBlur"\n} as const;\n\nfunction normalizeChoice(value: unknown, allowed: readonly string[], fallback: string) {\n  return typeof value === "string" && allowed.includes(value) ? value : fallback;\n}\n\nexport function applyVisualCustomizationDefaults<T extends Record<string, any>>(settings: T): T {\n  return {\n    ...settings,\n    homeBannerType: normalizeChoice(settings.homeBannerType, ["dynamic", "albumCover", "cleanBlack", "none"], DEFAULTS.homeBannerType),\n    blurEffects: DEFAULTS.blurEffects,\n    mediaCardBackground: normalizeChoice(settings.mediaCardBackground, ["solid", "glassy", "oledFlat"], DEFAULTS.mediaCardBackground),\n    homeLayoutMode: normalizeChoice(settings.homeLayoutMode, ["compact", "balanced", "bigHero"], DEFAULTS.homeLayoutMode),\n    libraryRowStyle: normalizeChoice(settings.libraryRowStyle, ["compactRows", "comfyRows", "coverCards", "listOnly"], DEFAULTS.libraryRowStyle),\n    starsIntensity: normalizeChoice(settings.starsIntensity, ["off", "subtle", "normal", "bright"], "off"),\n    sidebarBehavior: normalizeChoice(settings.sidebarBehavior, ["fixed", "slim", "hover"], DEFAULTS.sidebarBehavior),\n    playerBackgroundStyle: normalizeChoice(settings.playerBackgroundStyle, ["flat", "coverBlur", "oledBlack"], DEFAULTS.playerBackgroundStyle),\n    homeHeroCoverBrightness: Number.isFinite(Number(settings.homeHeroCoverBrightness)) ? Math.min(1.55, Math.max(0.65, Number(settings.homeHeroCoverBrightness))) : 1,\n    quickLibraryMoreBlur: settings.quickLibraryMoreBlur !== false,\n    catBuddyEnabled: settings.catBuddyEnabled === true\n  };\n}\n''',
)

write(
    "src/app/platform.ts",
    '''export type LocaltifyPlatformInfo = {\n  id: "windows" | "linux" | "mac" | "unknown";\n  label: string;\n  releaseLabel: string;\n  startupSettingSupported: boolean;\n  desktopControlsLabel: string;\n  desktopControlsHelp: string;\n  startupSettingLabel: string;\n  startupSettingHelp: string;\n  linuxInstallNotes: string[];\n};\n\nexport function getLocaltifyPlatformInfo(): LocaltifyPlatformInfo {\n  const userAgent = typeof navigator !== "undefined" ? String(navigator.userAgent || "").toLowerCase() : "";\n  const platform = typeof navigator !== "undefined" ? String(navigator.platform || "").toLowerCase() : "";\n  const isLinux = /linux|x11|wayland/.test(userAgent) || platform.includes("linux");\n  const isMac = /mac os|macintosh|darwin/.test(userAgent) || platform.includes("mac");\n  const isWindows = /windows|win32|win64|wow64/.test(userAgent) || platform.includes("win");\n\n  if (isLinux) return {\n    id: "linux", label: "Linux", releaseLabel: "AppImage / RPM / DEB", startupSettingSupported: false,\n    desktopControlsLabel: "Linux desktop controls",\n    desktopControlsHelp: "Tray and media keys work where your Linux desktop environment exposes them. Windows startup is hidden here because Linux uses desktop-specific autostart files.",\n    startupSettingLabel: "Start localtify with Linux",\n    startupSettingHelp: "Linux autostart will be added later through a proper desktop-entry flow.",\n    linuxInstallNotes: [\n      "AppImage: chmod +x localtify-0.4.1-x86_64.AppImage, then run it directly.",\n      "RPM: for Fedora, openSUSE, and RHEL-style distros.",\n      "DEB: for Ubuntu, Debian, Linux Mint, and related distros."\n    ]\n  };\n\n  if (isMac) return {\n    id: "mac", label: "macOS", releaseLabel: "macOS build not published yet", startupSettingSupported: false,\n    desktopControlsLabel: "macOS desktop controls",\n    desktopControlsHelp: "macOS support is not part of this release yet. This page keeps Windows-only startup controls hidden.",\n    startupSettingLabel: "Start localtify with macOS",\n    startupSettingHelp: "macOS autostart will be added later when a signed macOS build exists.",\n    linuxInstallNotes: []\n  };\n\n  return {\n    id: isWindows ? "windows" : "unknown",\n    label: isWindows ? "Windows" : "Unknown desktop",\n    releaseLabel: isWindows ? "NSIS installer" : "Desktop build",\n    startupSettingSupported: isWindows,\n    desktopControlsLabel: isWindows ? "Windows controls" : "Desktop controls",\n    desktopControlsHelp: isWindows\n      ? "Use keyboard media keys, taskbar buttons, tray controls, and Windows now playing."\n      : "Tray and media keys are available where the current desktop environment supports them.",\n    startupSettingLabel: "Start localtify when Windows starts",\n    startupSettingHelp: "Enabled by default so the player is ready after you sign in. You can turn it off anytime.",\n    linuxInstallNotes: []\n  };\n}\n''',
)

write(
    "src/features/feedback/feedbackPrompt.ts",
    '''export const FEEDBACK_PROMPT_SEEN_KEY = "localitfy.feedbackPrompt.seen.v1";\nexport const FEEDBACK_PROMPT_DELAY_MS = 40_000;\nexport const FEEDBACK_PROMPT_RETRY_DELAY_MS = 15_000;\nexport const FEEDBACK_MESSAGE_MAX_LENGTH = 1_500;\nexport const LOCALTIFY_041_WHATS_NEW_ITEMS = [\n  "0.4.1 is a quick hotfix for the album library importer freezing during big nested-folder scans.",\n  "Bulk album scanning now treats nested folders safer, so artist folders do not steal covers from child album folders.",\n  "Album import progress is throttled more carefully so the app stays responsive during large imports.",\n  "Linux AppImage startup and update-check noise from the 0.4.0 release path were cleaned up.",\n  "Small release cleanup: version text, Linux install copy, and old development comments were tidied."\n] as const;\n\nexport const FEEDBACK_PROMPT_COPY = {\n  title: "Thanks for using localtify!",\n  body: "really it has been amazing for users like you to keep using the app which make me want to update the app even more, why did this popup come? Well as you may know or may also have experienced localtify has few here and there visual or ui bugs in the app and that probably has made you angry. or maybe you really want a feature to be added.",\n  footer: "Which is why below me theres a message box where you can send bug reports and suggestions. and I will be actively reviewing them! (also you can type feeback in search bar)"\n} as const;\n\nexport const FEEDBACK_CATEGORY_OPTIONS = [\n  { id: "bug", label: "Bug" },\n  { id: "ui", label: "UI issue" },\n  { id: "feature", label: "Feature request" },\n  { id: "other", label: "Other" }\n] as const;\n\nexport function shouldOpenFeedbackPromptFromSettingsSearch(value: string) {\n  const query = value.trim().toLowerCase();\n  return query === "/feedback" || query === "feedback";\n}\n\nexport function shouldOpenFeedbackPromptFromGlobalSearch(value: string) {\n  const query = value.trim().toLowerCase();\n  return query === "/feedback" || query === "feedback";\n}\n''',
)

write(
    "src/features/onboarding/onboardingRelease.ts",
    '''import { APP_VERSION } from "../updates/update.constants";\nimport { ONBOARDING_STORAGE_KEY } from "../library/library.constants";\n\nconst RELEASE_SHOWCASE_KEY = `localitfy.onboarding.release-showcase.${APP_VERSION}`;\n\nexport function shouldOpenOnboardingForThisRelease() {\n  try {\n    const oldOnboardingDone = window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "done";\n    const releaseShowcaseDone = window.localStorage.getItem(RELEASE_SHOWCASE_KEY) === "done";\n    return !oldOnboardingDone || !releaseShowcaseDone;\n  } catch {\n    return true;\n  }\n}\n\nexport function markOnboardingSeenForThisRelease() {\n  try {\n    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "done");\n    window.localStorage.setItem(RELEASE_SHOWCASE_KEY, "done");\n  } catch {\n    // Storage errors must never block playback.\n  }\n}\n\nexport function resetOnboardingForThisRelease() {\n  try {\n    window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);\n    window.localStorage.removeItem(RELEASE_SHOWCASE_KEY);\n  } catch {\n    // Ignore reset storage errors.\n  }\n}\n''',
)

write(
    "src/features/settings/customThemePersistence.ts",
    '''import type { Settings } from "./settings.types";\n\nconst UPDATE_BACKUP_KEY = "localitfy.customThemeBackup.v1";\nconst PERSIST_KEYS = [\n  "customThemeEnabled", "customThemeColor", "customThemeColor2", "customThemeBackground",\n  "customThemeSurface", "customThemeText", "customThemeHighlight", "customThemeProgress"\n] as const;\n\nfunction extractPatch(source: Partial<Settings> | null | undefined): Partial<Settings> {\n  if (!source || typeof source !== "object") return {};\n  const hasCustomTheme = source.customThemeEnabled === true || PERSIST_KEYS.some((key) => {\n    if (key === "customThemeEnabled") return false;\n    return typeof source[key] === "string" && String(source[key] || "").trim().length > 0;\n  });\n  if (!hasCustomTheme) return {};\n  const patch: Partial<Settings> = { customThemeEnabled: true };\n  for (const key of PERSIST_KEYS) {\n    const value = source[key];\n    if (typeof value === "undefined") continue;\n    (patch as Record<string, unknown>)[key] = value;\n  }\n  patch.customThemeEnabled = true;\n  return patch;\n}\n\nfunction readBackupPatch(): Partial<Settings> {\n  try {\n    const raw = window.localStorage.getItem(UPDATE_BACKUP_KEY);\n    if (!raw) return {};\n    return extractPatch(JSON.parse(raw) as Partial<Settings>);\n  } catch {\n    return {};\n  }\n}\n\nexport function writeCustomThemeBackupPatch(source: Partial<Settings> | null | undefined) {\n  const patch = extractPatch(source);\n  if (!Object.keys(patch).length) return;\n  try {\n    window.localStorage.setItem(UPDATE_BACKUP_KEY, JSON.stringify(patch));\n  } catch {\n    // Theme backup must never block settings saves.\n  }\n}\n\nexport function restoreCustomThemeAfterUpdate(nextSettings: Settings, storedSettings: Partial<Settings>) {\n  const storedPatch = extractPatch(storedSettings);\n  const backupPatch = readBackupPatch();\n  const patch = Object.keys(storedPatch).length ? storedPatch : backupPatch;\n  if (!Object.keys(patch).length) return false;\n  Object.assign(nextSettings, patch, { customThemeEnabled: true });\n  writeCustomThemeBackupPatch(nextSettings);\n  return true;\n}\n''',
)

write(
    "tests/phase4/renderer-ownership.test.mjs",
    '''import assert from "node:assert/strict";\nimport fs from "node:fs";\nimport path from "node:path";\nimport test from "node:test";\nimport { fileURLToPath } from "node:url";\n\nconst root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");\nconst read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");\n\ntest("App delegates platform and policy helpers to owned modules", () => {\n  const app = read("src/App.tsx");\n  assert.match(app, /from "\.\/app\/platform"/);\n  assert.match(app, /from "\.\/features\/settings\/visualCustomization"/);\n  assert.match(app, /from "\.\/features\/onboarding\/onboardingRelease"/);\n  assert.match(app, /from "\.\/features\/settings\/customThemePersistence"/);\n  assert.doesNotMatch(app, /function getLocaltifyPlatformInfo/);\n  assert.doesNotMatch(app, /const VISUAL_CUSTOMIZATION_DEFAULTS/);\n  assert.doesNotMatch(app, /CUSTOM_THEME_UPDATE_BACKUP_KEY/);\n});\n\ntest("App delegates analytics formatting, feedback policy, idle scheduling and player icon", () => {\n  const app = read("src/App.tsx");\n  assert.match(app, /features\\/analytics\\/formatters/);\n  assert.match(app, /features\\/feedback\\/feedbackPrompt/);\n  assert.match(app, /app\\/runtime\\/idle/);\n  assert.match(app, /features\\/player\\/PlayerPlayPauseMorphIcon/);\n  assert.doesNotMatch(app, /function localtifyAnalyticsNumber/);\n  assert.doesNotMatch(app, /function runLocaltifyIdleTask/);\n});\n''',
)

print("Phase 4B checkpoint 2 applied")
