// One pure computation shared by the worker and its fallback.
export { computeLocaltifyAnalyticsSnapshot, makeLocaltifyAnalyticsSnapshotFallback } from "./analyticsSnapshotCore";
export type { LocaltifyAnalyticsSnapshot, LocaltifyAnalyticsSnapshotInput } from "./analyticsSnapshotCore";

export function createLocaltifyLibraryWorker() {
  try {
    return new Worker(new URL("../../library.worker.ts", import.meta.url), {
      type: "module",
      name: "localtify-library-worker"
    });
  } catch {
    return null;
  }
}
