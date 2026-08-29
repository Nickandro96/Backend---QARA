import "dotenv/config";
import { runRefresh } from "./WatchAggregator";
import { hasActiveRefreshRun } from "./WatchStore";

export async function runWatchWorker(): Promise<"completed" | "locked"> {
  if (await hasActiveRefreshRun()) {
    console.info("[WatchWorker] another refresh is active; exiting cleanly");
    return "locked";
  }
  await runRefresh("job");
  return "completed";
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  runWatchWorker().then(() => process.exit(0)).catch((error) => {
    console.error("[WatchWorker] failed", error);
    process.exit(1);
  });
}
