import type { ImportAnimationState } from "./song.types";
export function createImportAnimationState(patch: Partial<ImportAnimationState> = {}): ImportAnimationState {
  return { active:false, phase:"idle", message:"ready to scan local music", count:0, total:0, preview:[], ...patch };
}
