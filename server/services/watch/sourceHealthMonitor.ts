import { regulatorySources } from "../../../drizzle/schema";
import { getDb } from "../../db";

export type SourceHealthSummary = {
  checkedAt: string; degraded: boolean; healthy: number; failing: number; stale: number;
  sources: Array<{ id: string; name: string; status: "healthy" | "failing" | "stale"; lastSuccessAt: string | null; message: string | null }>;
};

export function summarizeSourceHealth(rows: Array<{ id: string; name: string; active: boolean; lastCollectedAt: Date | null; lastSuccessAt: Date | null; lastError: string | null }>, now = new Date(), staleHours = 30): SourceHealthSummary {
  const cutoff = now.getTime() - staleHours * 3_600_000;
  const sources = rows.filter((row) => row.active).map((row) => {
    const failing = Boolean(row.lastError) && (!row.lastSuccessAt || !row.lastCollectedAt || row.lastSuccessAt < row.lastCollectedAt);
    const stale = !row.lastSuccessAt || row.lastSuccessAt.getTime() < cutoff;
    const status = failing ? "failing" as const : stale ? "stale" as const : "healthy" as const;
    return { id: row.id, name: row.name, status, lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null, message: failing ? row.lastError : stale ? `Aucun succès depuis plus de ${staleHours} h` : null };
  });
  const failing = sources.filter((source) => source.status === "failing").length;
  const stale = sources.filter((source) => source.status === "stale").length;
  return { checkedAt: now.toISOString(), degraded: failing + stale > 0, healthy: sources.length - failing - stale, failing, stale, sources };
}

export async function getSourceHealthSummary(): Promise<SourceHealthSummary> {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  return summarizeSourceHealth(await db.select().from(regulatorySources));
}

export async function sendSourceHealthAlert(): Promise<boolean> {
  const summary = await getSourceHealthSummary(); if (!summary.degraded) return false;
  const apiKey = process.env.RESEND_API_KEY?.trim(); const from = process.env.EMAIL_FROM?.trim();
  const to = process.env.WATCH_ALERT_EMAIL?.trim() || "infos@n3-conseil.com";
  if (!apiKey || !from) { console.warn("[WatchHealth] alert email skipped: email configuration missing", summary); return false; }
  const incidents = summary.sources.filter((source) => source.status !== "healthy");
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to], subject: `[QARA] ${incidents.length} source(s) de veille dégradée(s)`, text: incidents.map((source) => `${source.name}: ${source.status} — ${source.message ?? "sans détail"}`).join("\n") }) });
  if (!response.ok) throw new Error(`Resend rejected watch alert (${response.status}): ${await response.text()}`);
  return true;
}
