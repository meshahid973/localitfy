import type { Settings } from "./settings.types";

/** Compatibility boundary: old saved palettes must never become active again.
 * Keep their persisted data intact for rollback, but migrate the active mode.
 */
export function restoreCustomThemeAfterUpdate(nextSettings: Settings, storedSettings: Partial<Settings>) {
  const changed = storedSettings.customThemeEnabled === true || nextSettings.customThemeEnabled === true;
  nextSettings.customThemeEnabled = false;
  return changed;
}

/** Old callers are retained while the settings adapter is migrated. */
export function writeCustomThemeBackupPatch(_source: Partial<Settings> | null | undefined) {
  // No new palette backups are written.
}
