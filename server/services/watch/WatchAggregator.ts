import crypto from "crypto";
import type { RegulatoryUpdate, UpdateSource, WatchMeta, CompanyProfile, PersonalizedImpact } from "./types";
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

const DEFAULT_SOURCES: UpdateSource[] = [EurLexMdrSource, MdcgSource, HarmonisedStandardsSource, IsoNewsSource];

const STALE_HOURS = Number(process.env.WATCH_STALE_HOURS ?? "6");
const FETCH_TIMEOUT_MS = Number(process.env.WATCH_FETCH_TIMEOUT_MS ?? "12000");

let refreshInProgress = false;
let lastHealth: WatchMeta["sourceHealth"] = [];
let lastDegraded = false;

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
}): Promise<{ items: RegulatoryUpdate[]; meta: WatchMeta }>{
  const lastRefresh = await getLastRefresh();
  const items = await listUpdates(input);

  const stale = !lastRefresh || Date.now() - lastRefresh.getTime() > STALE_HOURS * 60 * 60 * 1000;
  const meta: WatchMeta = {
    lastRefresh,
    stale,
    refreshInProgress,
    degraded: lastDegraded,
    sourceHealth: lastHealth,
  };
  return { items, meta };
}

export async function triggerRefresh(trigger: "page_open" | "job" | "manual"): Promise<{ started: boolean }>{
  if (refreshInProgress) return { started: false };

  refreshInProgress = true;
  // Fire and forget (do not block callers)
  void runRefresh(trigger).finally(() => {
    refreshInProgress = false;
  });

  return { started: true };
}

async function runRefresh(trigger: "page_open" | "job" | "manual"): Promise<void> {
  const startedAt = nowUtc();
  const runId = await createRefreshRun({ startedAt, trigger });

  const errors: string[] = [];
  const sources = DEFAULT_SOURCES;

  const results = await Promise.all(
    sources.map(async (s) => {
      const res = await s.fetchUpdates({ timeoutMs: FETCH_TIMEOUT_MS });
      return res;
    })
  );

  const health = results.map((r) => r.health);
  lastHealth = health;
  lastDegraded = health.some((h) => !h.ok);

  const baseItems = results.flatMap((r) => r.items);

  // Enrich + assign IDs
  const enriched: RegulatoryUpdate[] = baseItems.map((b) => {
    const id = crypto.randomUUID();
    const enrichment = enrichUpdate(b as any);
    return {
      id,
      ...b,
      ...enrichment,
    } as RegulatoryUpdate;
  });

  const dd = dedupeByHash(enriched);
  const unique = dd.unique;

  if (dd.duplicates.length) {
    errors.push(`Duplicates dropped: ${dd.duplicates.length}`);
  }

  let inserted = 0;
  let updated = 0;
  try {
    const up = await upsertUpdates(runId, unique);
    inserted = up.inserted;
    updated = up.updated;
  } catch (e: any) {
    errors.push(e?.message ?? "DB upsert failed");
  }

  const success = errors.length === 0 || (inserted + updated) > 0;

  await finishRefreshRun({
    id: runId,
    finishedAt: nowUtc(),
    success,
    newCount: inserted,
    updatedCount: updated,
    errors,
    sourceHealth: health,
  });
}

export async function getOrDefaultCompanyProfile(userId: number): Promise<CompanyProfile> {
  const existing = await getCompanyProfile(userId);
  if (existing) return existing;
  // Default profile: manufacturer, class IIa, EU market
  return {
    economicRole: "fabricant",
    deviceClass: "IIa",
    deviceFamilies: ["non_active"],
    markets: ["EU"],
  };
}

export async function saveCompanyProfile(userId: number, profile: CompanyProfile): Promise<void> {
  await upsertCompanyProfile(userId, profile);
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
        .slice(0, 20)
    )
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
