/** Opt-in, development-only timing. Enable with localStorage.setItem("localtify:profile", "1"). */
const samples = new Map<string, number>();

function enabled(): boolean {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  try { return window.localStorage.getItem("localtify:profile") === "1"; }
  catch { return false; }
}

export function measureDevTime<T>(label: string, work: () => T): T {
  if (!enabled()) return work();
  const started = performance.now();
  try { return work(); }
  finally { console.info("[localtify profile]", label, (performance.now() - started).toFixed(2) + "ms"); }
}

export function devPerfStart(label: string): void {
  if (enabled() && !samples.has(label)) samples.set(label, performance.now());
}

export function devPerfEnd(label: string, details = ""): void {
  if (!enabled()) return;
  const started = samples.get(label);
  if (typeof started !== "number") return;
  samples.delete(label);
  console.info("[localtify profile]", label, (performance.now() - started).toFixed(2) + "ms", details);
}
