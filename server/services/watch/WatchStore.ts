import { desc, eq } from "drizzle-orm";
import type { RegulatoryUpdate, CompanyProfile } from "./types";
import crypto from "crypto";
import * as db from "../../db";
import {
  regulatoryUpdates,
  watchRefreshRuns,
  regulatoryUpdateVersions,
  watchCompanyProfiles,
} from "../../../drizzle/schema";

export async function getLastRefresh(): Promise<Date | null> {
  const database = await db.getDb();
  if (!database) return null;

  const [row] = await database.select().from(watchRefreshRuns).orderBy(desc(watchRefreshRuns.startedAt)).limit(1);
  return row?.finishedAt ?? row?.startedAt ?? null;
}

export async function listUpdates(opts: {
  limit: number;
  offset: number;
  type?: string;
  impactLevel?: string;
  status?: string;
  search?: string;
}): Promise<RegulatoryUpdate[]> {
  const database = await db.getDb();
  if (!database) return [];

  // Minimal filtering done in memory for JSON fields.
  // Keep SQL simple to avoid fragile JSON operators across MySQL versions.
  const rows = await database
    .select()
    .from(regulatoryUpdates)
    .orderBy(desc(regulatoryUpdates.publishedAt))
    .limit(opts.limit)
    .offset(opts.offset);

  const filtered = rows.filter((r: any) => {
    if (opts.type && r.type !== opts.type) return false;
    if (opts.impactLevel && r.impactLevel !== opts.impactLevel) return false;
    if (opts.status && r.status !== opts.status) return false;
    if (opts.search) {
      const q = opts.search.toLowerCase();
      const hay = `${r.title ?? ""} ${r.summaryShort ?? ""} ${r.summaryLong ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return filtered.map((r: any) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    summaryShort: r.summaryShort,
    summaryLong: r.summaryLong,
    publishedAt: new Date(r.publishedAt),
    effectiveAt: r.effectiveAt ? new Date(r.effectiveAt) : null,
    status: r.status,
    sourceName: r.sourceName,
    sourceUrl: r.sourceUrl,
    sourceId: r.sourceId,
    jurisdiction: r.jurisdiction,
    tags: r.tags ?? [],
    impactedMdr: r.impactedMdr ?? { articles: [], annexes: [] },
    impactedDomains: r.impactedDomains ?? [],
    impactedRoles: r.impactedRoles ?? [],
    impactLevel: r.impactLevel,
    risks: r.risks ?? [],
    recommendedActions: r.recommendedActions ?? [],
    expectedEvidence: r.expectedEvidence ?? [],
    hash: r.hash,
    retrievedAt: new Date(r.retrievedAt),
  }));
}

export async function upsertUpdates(runId: string, items: RegulatoryUpdate[]): Promise<{ inserted: number; updated: number }> {
  const database = await db.getDb();
  if (!database) return { inserted: 0, updated: 0 };

  let inserted = 0;
  let updated = 0;

  for (const it of items) {
    const [existing] = await database
      .select()
      .from(regulatoryUpdates)
      .where(eq(regulatoryUpdates.hash, it.hash))
      .limit(1);

    if (!existing) {
      await database.insert(regulatoryUpdates).values({
        id: it.id,
        type: it.type,
        title: it.title,
        summaryShort: it.summaryShort,
        summaryLong: it.summaryLong,
        publishedAt: it.publishedAt,
        effectiveAt: it.effectiveAt,
        status: it.status,
        sourceName: it.sourceName,
        sourceUrl: it.sourceUrl,
        sourceId: it.sourceId,
        jurisdiction: it.jurisdiction,
        tags: it.tags,
        impactedMdr: it.impactedMdr,
        impactedDomains: it.impactedDomains,
        impactedRoles: it.impactedRoles,
        impactLevel: it.impactLevel,
        risks: it.risks,
        recommendedActions: it.recommendedActions,
        expectedEvidence: it.expectedEvidence,
        hash: it.hash,
        retrievedAt: it.retrievedAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await database.insert(regulatoryUpdateVersions).values({
        id: cryptoRandomUuid(),
        updateId: it.id,
        runId,
        snapshot: it,
        createdAt: new Date(),
      });

      inserted++;
    } else {
      // Update fields if changed
      await database
        .update(regulatoryUpdates)
        .set({
          title: it.title,
          summaryShort: it.summaryShort,
          summaryLong: it.summaryLong,
          publishedAt: it.publishedAt,
          effectiveAt: it.effectiveAt,
          status: it.status,
          sourceName: it.sourceName,
          sourceUrl: it.sourceUrl,
          sourceId: it.sourceId,
          jurisdiction: it.jurisdiction,
          tags: it.tags,
          impactedMdr: it.impactedMdr,
          impactedDomains: it.impactedDomains,
          impactedRoles: it.impactedRoles,
          impactLevel: it.impactLevel,
          risks: it.risks,
          recommendedActions: it.recommendedActions,
          expectedEvidence: it.expectedEvidence,
          retrievedAt: it.retrievedAt,
          updatedAt: new Date(),
        })
        .where(eq(regulatoryUpdates.hash, it.hash));

      await database.insert(regulatoryUpdateVersions).values({
        id: cryptoRandomUuid(),
        updateId: existing.id,
        runId,
        snapshot: it,
        createdAt: new Date(),
      });

      updated++;
    }
  }

  return { inserted, updated };
}

export async function createRefreshRun(input: {
  startedAt: Date;
  trigger: "page_open" | "job" | "manual";
}): Promise<string> {
  const database = await db.getDb();
  if (!database) return cryptoRandomUuid();

  const runId = cryptoRandomUuid();
  await database.insert(watchRefreshRuns).values({
    id: runId,
    startedAt: input.startedAt,
    finishedAt: null,
    success: false,
    trigger: input.trigger,
    newCount: 0,
    updatedCount: 0,
    errors: [],
    sourceHealth: [],
    createdAt: new Date(),
  });
  return runId;
}

export async function finishRefreshRun(input: {
  id: string;
  finishedAt: Date;
  success: boolean;
  newCount: number;
  updatedCount: number;
  errors: string[];
  sourceHealth: any[];
}): Promise<void> {
  const database = await db.getDb();
  if (!database) return;

  await database
    .update(watchRefreshRuns)
    .set({
      finishedAt: input.finishedAt,
      success: input.success,
      newCount: input.newCount,
      updatedCount: input.updatedCount,
      errors: input.errors,
      sourceHealth: input.sourceHealth,
    })
    .where(eq(watchRefreshRuns.id, input.id));
}

export async function getCompanyProfile(userId: number): Promise<CompanyProfile | null> {
  const database = await db.getDb();
  if (!database) return null;

  const [row] = await database
    .select()
    .from(watchCompanyProfiles)
    .where(eq(watchCompanyProfiles.userId, userId))
    .limit(1);
  if (!row) return null;

  return {
    economicRole: row.economicRole as any,
    deviceClass: row.deviceClass as any,
    deviceFamilies: (row.deviceFamilies ?? []) as any,
    markets: (row.markets ?? ["EU"]) as any,
  };
}

export async function upsertCompanyProfile(userId: number, profile: CompanyProfile): Promise<void> {
  const database = await db.getDb();
  if (!database) return;

  const [existing] = await database
    .select()
    .from(watchCompanyProfiles)
    .where(eq(watchCompanyProfiles.userId, userId))
    .limit(1);

  const values = {
    userId,
    economicRole: profile.economicRole,
    deviceClass: profile.deviceClass,
    deviceFamilies: profile.deviceFamilies,
    markets: profile.markets,
    updatedAt: new Date(),
  };

  if (!existing) {
    await database.insert(watchCompanyProfiles).values({
      ...values,
      createdAt: new Date(),
    });
  } else {
    await database.update(watchCompanyProfiles).set(values).where(eq(watchCompanyProfiles.userId, userId));
  }
}

function cryptoRandomUuid(): string {
  // Node 18+ supports crypto.randomUUID
  // Keep a fallback for older runtimes.
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}-${Math.random()}`;
}
