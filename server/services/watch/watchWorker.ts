import "dotenv/config";
import { runRefresh } from "./WatchAggregator";
import { hasActiveRefreshRun } from "./WatchStore";
import { getDb } from "../../db";
import { runAnalysisQueue } from "./ai/analysisQueue";
import { generateWeeklyBriefings } from "../intelligence/intelligenceWorker";
import { sendSourceHealthAlert } from "./sourceHealthMonitor";

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
  try {
    const briefingResults = await generateWeeklyBriefings();
    logger.info({ briefingResults }, "sector briefings refresh completed");
  } catch (error) {
    logger.error({ error }, "sector briefings refresh failed; watch collection remains successful");
  }
  try {
    await sendSourceHealthAlert();
  } catch (error) {
    logger.error({ error }, "source health alert failed");
  }
  return "completed";
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  runWatchWorker().then(() => process.exit(0)).catch((error) => {
    console.error("[WatchWorker] failed", error);
    process.exit(1);
  });
}
