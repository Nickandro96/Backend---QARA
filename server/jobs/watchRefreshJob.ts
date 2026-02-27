import { triggerRefresh } from "../services/watch/WatchAggregator";

/**
 * Lightweight scheduler (no new dependencies).
 *
 * Railway can also run cron separately, but embedding this allows:
 * - local dev parity
 * - resilience if external cron isn't configured
 */

const INTERVAL_MS = Number(process.env.WATCH_JOB_INTERVAL_MS ?? String(6 * 60 * 60 * 1000));

let started = false;

export function startWatchRefreshJob(): void {
  const enabled = (process.env.WATCH_JOB_ENABLED ?? "true").toLowerCase() === "true";
  if (!enabled) return;
  if (started) return;
  started = true;

  // Initial slight delay to avoid competing with cold start traffic.
  const initialDelayMs = Number(process.env.WATCH_JOB_INITIAL_DELAY_MS ?? "15000");
  setTimeout(() => {
    void triggerRefresh("job");
  }, initialDelayMs);

  setInterval(() => {
    void triggerRefresh("job");
  }, INTERVAL_MS);

  console.log(`[WatchJob] started interval=${INTERVAL_MS}ms`);
}
