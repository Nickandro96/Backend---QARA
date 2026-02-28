import crypto from "crypto";
import type {
  RegulatoryUpdate,
  UpdateSource,
  WatchMeta,
  CompanyProfile,
  PersonalizedImpact,
} from "./types";

import { dedupeByHash } from "./enrichment/Dedupe";
import { enrichUpdate } from "./enrichment/Enricher";
import { nowUtc } from "./utils";

import { EurLexMdrSource } from "./sources/EurLexMdrSource";
import { MdcgSource } from "./sources/MdcgSource";
import { HarmonisedStandardsSource } from "./sources/HarmonisedStandardsSource";
import { IsoNewsSource } from "./sources/IsoNewsSource";

import {
  createRefreshRun,
  finishRefreshRun,
  getLastRefresh,
  listUpdates,
  upsertUpdates,
  getCompanyProfile,
  upsertCompanyProfile,
} from "./WatchStore";

const DEFAULT_SOURCES: UpdateSource[] = [
  EurLexMdrSource,
  MdcgSource,
  HarmonisedStandardsSource,
  IsoNewsSource,
];

const STALE_HOURS = Number(process.env.WATCH_STALE_HOURS ?? "6");
const FETCH_TIMEOUT_MS = Number(process.env.WATCH_FETCH_TIMEOUT_MS ?? "12000");

let refreshInProgress = false;
let lastHealth: WatchMeta["sourceHealth"] = [];
let lastDegraded = false;

/**
 * We must never crash the process because the Watch module is "best effort".
 * Typical failure modes:
 * - DB tables not migrated yet (ER_NO_SUCH_TABLE)
 * - External sources down / timeout
 * - DB transient errors
 */
function isMissingTableError(err: unknown): boolean {
  const anyErr = err as any;
  const code = anyErr?.code ?? anyErr?.cause?.code;
  const sqlMessage = anyErr?.sqlMessage ?? anyErr?.cause?.sqlMessage;
  return code === "ER_NO_SUCH_TABLE" || (typeof sqlMessage === "string" && sqlMessage.includes("doesn't exist"));
}

function asErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export function isRefreshInProgress(): boolean {
  return refreshInProgress;
}

export async function getUpdatesCached(input: {
  limit: number;
  offset: number;
  type?: string;
  impactLevel?: string;
  status?: string;
  search?: string;
}): Promise<{ items: RegulatoryUpdate[]; meta: WatchMeta }> {
  // Return cache immediately (DB list), meta indicates staleness.
  // If tables are missing, degrade gracefully with empty items.
  let lastRefresh: Date | null = null;
  let items: RegulatoryUpdate[] = [];

  try {
    lastRefresh = await getLastRefresh();
  } catch (err) {
    // If watch tables don't exist yet, do not crash the API.
    lastDegraded = true;
    lastRefresh = null;
  }

  try {
    items = await listUpdates(input);
  } catch (err) {
    // Same: if tables missing, return empty list
    lastDegraded = true;
    items = [];
  }

  const stale =
    !lastRefresh || Date.now() - lastRefresh.getTime() > STALE_HOURS * 60 * 60 * 1000;

  const meta: WatchMeta = {
    lastRefresh,
    stale,
    refreshInProgress,
    degraded: lastDegraded,
    sourceHealth: lastHealth,
  };

  return { items, meta };
}

export async function triggerRefresh(
  trigger: "page_open" | "job" | "manual",
): Promise<{ started: boolean }> {
  if (refreshInProgress) return { started: false };

  refreshInProgress = true;

  // Fire-and-forget but NEVER unhandled rejection.
  void runRefresh(trigger)
    .catch((err) => {
      // Do not crash process; mark degraded and store health if possible.
      lastDegraded = true;
      console.error("[Watch] runRefresh failed:", err);
    })
    .finally(() => {
      refreshInProgress = false;
    });

  return { started: true };
}

async function runRefresh(trigger: "page_open" | "job" | "manual"): Promise<void> {
  const startedAt = nowUtc();

  // 1) Create refresh run (may fail if tables not migrated)
  let runId: string | null = null;
  try {
    runId = await createRefreshRun({ startedAt, trigger });
  } catch (err) {
    lastDegraded = true;

    // Most common: migration not applied yet (watch_refresh_runs missing)
    if (isMissingTableError(err)) {
      console.warn(
        "[Watch] refresh skipped because watch tables are missing (apply DB migration first).",
      );
      return;
    }

    console.error("[Watch] createRefreshRun failed:", err);
    // If we cannot create a run, we still try to fetch sources but we can't persist.
    runId = null;
  }

  const errors: string[] = [];
  const sources = DEFAULT_SOURCES;

  // 2) Fetch sources in parallel, but isolate failures per source.
  const results = await Promise.all(
    sources.map(async (s) => {
      try {
        return await s.fetchUpdates({ timeoutMs: FETCH_TIMEOUT_MS });
      } catch (err) {
        const message = asErrorMessage(err);
        errors.push(`[${s.name}] fetch failed: ${message}`);
        return {
          items: [],
          health: {
            name: s.name,
            ok: false,
            message,
            items: 0,
            durationMs: null as any, // keep compatibility with your health type
          },
        };
      }
    }),
  );

  const health = results.map((r) => r.health);
  lastHealth = health;
  lastDegraded = health.some((h) => !h.ok) || errors.length > 0;

  const baseItems = results.flatMap((r) => r.items);

  // 3) Enrich + assign IDs (pure deterministic rules; no hallucination)
  const enriched: RegulatoryUpdate[] = baseItems.map((b) => {
    const id = crypto.randomUUID();
    const enrichment = enrichUpdate(b as any);
    return {
      id,
      ...b,
      ...enrichment,
    } as RegulatoryUpdate;
  });

  // 4) Dedupe by hash (keep one canonical item)
  const dd = dedupeByHash(enriched);
  const unique = dd.unique;

  if (dd.duplicates.length) {
    errors.push(`Duplicates dropped: ${dd.duplicates.length}`);
  }

  // 5) Upsert into DB (if possible)
  let inserted = 0;
  let updated = 0;

  if (!runId) {
    // We cannot persist without a refresh run id.
    // This happens when DB is down / tables missing.
    errors.push("DB refresh run not created; skipping persistence.");
  } else {
    try {
      const up = await upsertUpdates(runId, unique);
      inserted = up.inserted;
      updated = up.updated;
    } catch (err) {
      lastDegraded = true;

      if (isMissingTableError(err)) {
        // DB tables not migrated (or wrong schema). Degrade gracefully.
        errors.push("DB tables missing; apply watch migration then redeploy.");
      } else {
        errors.push(asErrorMessage(err));
      }
    }
  }

  // Success rule: no blocking errors, OR we actually inserted/updated something.
  const success = (errors.length === 0) || (inserted + updated) > 0;

  // 6) Finish refresh run (best effort; never crash)
  if (runId) {
    try {
      await finishRefreshRun({
        id: runId,
        finishedAt: nowUtc(),
        success,
        newCount: inserted,
        updatedCount: updated,
        errors,
        sourceHealth: health,
      });
    } catch (err) {
      lastDegraded = true;
      // If watch_refresh_runs missing, do not crash.
      if (isMissingTableError(err)) {
        console.warn("[Watch] finishRefreshRun skipped (tables missing).");
        return;
      }
      console.error("[Watch] finishRefreshRun failed:", err);
    }
  }
}

export async function getOrDefaultCompanyProfile(userId: number): Promise<CompanyProfile> {
  try {
    const existing = await getCompanyProfile(userId);
    if (existing) return existing;
  } catch (err) {
    // If company profile table missing, degrade gracefully.
    lastDegraded = true;
  }

  // Default profile: manufacturer, class IIa, EU market
  return {
    economicRole: "fabricant",
    deviceClass: "IIa",
    deviceFamilies: ["non_active"],
    markets: ["EU"],
  };
}

export async function saveCompanyProfile(userId: number, profile: CompanyProfile): Promise<void> {
  try {
    await upsertCompanyProfile(userId, profile);
  } catch (err) {
    lastDegraded = true;
    // Do not crash if tables missing.
    if (isMissingTableError(err)) {
      console.warn("[Watch] saveCompanyProfile skipped (tables missing).");
      return;
    }
    throw err;
  }
}

export function personalizeUpdate(update: RegulatoryUpdate, profile: CompanyProfile): PersonalizedImpact {
  // Deterministic personalization:
  // - if user role is not in impactedRoles => reduce one level (min Low)
  // - if device class is III and impact is High => Critical
  // - if profile includes "software" family and domain includes Software => +1

  const reasons: string[] = [];

  let level = update.impactLevel;
  const impactedRoles = new Set(update.impactedRoles);

  if (!impactedRoles.has(profile.economicRole)) {
    reasons.push("Rôle entreprise non directement ciblé (réduction d’un niveau)");
    level = downgrade(level);
  }

  if (profile.deviceClass === "III" && level === "High") {
    reasons.push("Classe III : exigence d’audit / criticité accrue");
    level = "Critical";
  }

  if (profile.deviceFamilies.includes("software") && update.impactedDomains.includes("Software")) {
    reasons.push("Famille logiciel : exposition directe (augmentation d’un niveau)");
    level = upgrade(level);
  }

  // Prioritized 30/60/90 based on dueDays
  const plan30 = update.recommendedActions.filter((a) => a.dueDays <= 30);
  const plan60 = update.recommendedActions.filter((a) => a.dueDays > 30 && a.dueDays <= 60);
  const plan90 = update.recommendedActions.filter((a) => a.dueDays > 60);

  const sopDocsToUpdate = Array.from(
    new Set(
      update.expectedEvidence
        .filter((e) => /SOP|PROC|procedure|plan|template/i.test(e))
        .slice(0, 20),
    ),
  );

  const auditReadinessChecklist = [
    "Change control complété (impact assessment + approbations)",
    "Documents contrôlés mis à jour (SOP/Plans/Templates)",
    "Enregistrements de formation disponibles",
    "Échantillons de preuves prêts (ex: PSUR, vigilance logs, traceability)",
  ];

  return {
    impactLevel: level,
    reasons: reasons.length ? reasons : ["Profil entreprise : aucun ajustement spécifique"],
    plan30,
    plan60,
    plan90,
    sopDocsToUpdate,
    auditReadinessChecklist,
  };
}

function downgrade(level: RegulatoryUpdate["impactLevel"]): RegulatoryUpdate["impactLevel"] {
  switch (level) {
    case "Critical":
      return "High";
    case "High":
      return "Medium";
    case "Medium":
      return "Low";
    default:
      return "Low";
  }
}

function upgrade(level: RegulatoryUpdate["impactLevel"]): RegulatoryUpdate["impactLevel"] {
  switch (level) {
    case "Low":
      return "Medium";
    case "Medium":
      return "High";
    case "High":
      return "Critical";
    default:
      return "Critical";
  }
}
