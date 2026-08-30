import "dotenv/config";
import { runRefresh } from "./WatchAggregator";
import { hasActiveRefreshRun } from "./WatchStore";
import { getDb } from "../../db";
import { runAnalysisQueue } from "./ai/analysisQueue";

const logger = {
  info: (data: unknown, message: string) => console.info(`[WatchAI] ${message}`, data),
  warn: (data: unknown, message: string) => console.warn(`[WatchAI] ${message}`, data),
  error: (data: unknown, message: string) => console.error(`[WatchAI] ${message}`, data),
};

export async function runWatchWorker(): Promise<"completed" | "locked"> {
  if (await hasActiveRefreshRun()) {
    console.info("[WatchWorker] another refresh is active; exiting cleanly");
    return "locked";
  }
  await runRefresh("job");
  try {
    const db = await getDb();
    if (db) await runAnalysisQueue(db, logger);
    else logger.warn({}, "database unavailable; AI analysis skipped");
  } catch (error) {
    logger.error({ error }, "analysis queue failed; collection run remains successful");
  }
  return "completed";
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  runWatchWorker().then(() => process.exit(0)).catch((error) => {
    console.error("[WatchWorker] failed", error);
    process.exit(1);
  });
}
