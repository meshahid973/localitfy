import { computeLocaltifyAnalyticsSnapshot, type LocaltifyAnalyticsSnapshotInput } from "./features/analytics/analyticsSnapshotCore";

type LocaltifyWorkerPayload = LocaltifyAnalyticsSnapshotInput & {
  type: "compute-analytics-snapshot";
  requestId: number;
};

self.onmessage = (event: MessageEvent<LocaltifyWorkerPayload>) => {
  const payload = event.data;
  if (!payload || payload.type !== "compute-analytics-snapshot") return;
  try {
    self.postMessage({
      type: "analytics-snapshot", requestId: payload.requestId,
      snapshot: computeLocaltifyAnalyticsSnapshot(payload)
    });
  } catch (error) {
    self.postMessage({
      type: "analytics-snapshot", requestId: payload.requestId,
      error: error instanceof Error ? error.message : "worker failed"
    });
  }
};

export {};
