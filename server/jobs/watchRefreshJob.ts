import { triggerRefresh } from "../services/watch/WatchAggregator";

let started = false;

const INTERVAL_MS = Number(process.env.WATCH_JOB_INTERVAL_MS ?? String(6 * 60 * 60 * 1000)); // 6h

export function startWatchRefreshJob(): void {
  const enabled = (process.env.WATCH_JOB_ENABLED ?? "true").toLowerCase() === "true";
  if (!enabled) return;
  if (started) return;
  started = true;

  console.info(`[WatchJob] started interval=${INTERVAL_MS}ms`);

  // Initial slight delay to avoid competing with cold start traffic.
  const initialDelayMs = Number(process.env.WATCH_JOB_INITIAL_DELAY_MS ?? "15000");
  setTimeout(() => {
    // Never let a background job crash the process.
    void triggerRefresh("job").catch((err) => {
      console.error("[WatchJob] initial run failed", err);
    });
  }, initialDelayMs);

  setInterval(() => {
    // Never let a background job crash the process.
    void triggerRefresh("job").catch((err) => {
      console.error("[WatchJob] periodic run failed", err);
    });
  }, INTERVAL_MS);
}
