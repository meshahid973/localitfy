import type { Settings } from "./settings.types";

const UPDATE_BACKUP_KEY = "localitfy.customThemeBackup.v1";
const PERSIST_KEYS = [
  "customThemeEnabled", "customThemeColor", "customThemeColor2", "customThemeBackground",
  "customThemeSurface", "customThemeText", "customThemeHighlight", "customThemeProgress"
] as const;

function extractPatch(source: Partial<Settings> | null | undefined): Partial<Settings> {
  if (!source || typeof source !== "object") return {};
  const hasCustomTheme = source.customThemeEnabled === true || PERSIST_KEYS.some((key) => {
    if (key === "customThemeEnabled") return false;
    return typeof source[key] === "string" && String(source[key] || "").trim().length > 0;
  });
  if (!hasCustomTheme) return {};
  const patch: Partial<Settings> = { customThemeEnabled: true };
  for (const key of PERSIST_KEYS) {
    const value = source[key];
    if (typeof value === "undefined") continue;
    (patch as Record<string, unknown>)[key] = value;
  }
  patch.customThemeEnabled = true;
  return patch;
}

function readBackupPatch(): Partial<Settings> {
  try {
    const raw = window.localStorage.getItem(UPDATE_BACKUP_KEY);
    if (!raw) return {};
    return extractPatch(JSON.parse(raw) as Partial<Settings>);
  } catch {
    return {};
  }
}

export function writeCustomThemeBackupPatch(source: Partial<Settings> | null | undefined) {
  const patch = extractPatch(source);
  if (!Object.keys(patch).length) return;
  try {
    window.localStorage.setItem(UPDATE_BACKUP_KEY, JSON.stringify(patch));
  } catch {
    // Theme backup must never block settings saves.
  }
}

export function restoreCustomThemeAfterUpdate(nextSettings: Settings, storedSettings: Partial<Settings>) {
  const storedPatch = extractPatch(storedSettings);
  const backupPatch = readBackupPatch();
  const patch = Object.keys(storedPatch).length ? storedPatch : backupPatch;
  if (!Object.keys(patch).length) return false;
  Object.assign(nextSettings, patch, { customThemeEnabled: true });
  writeCustomThemeBackupPatch(nextSettings);
  return true;
}
