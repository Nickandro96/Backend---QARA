import { sql } from "drizzle-orm";
import { processus } from "../../drizzle/schema";
import { CANONICAL_PROCESSES } from "../processes-catalog";

/**
 * Résout une liste de sélections de processus (slugs canoniques comme
 * "gov_strat"/"qms", ou ids numériques déjà en base) vers les ids réels de
 * la table `processus`.
 *
 * Extrait de mdr-router.ts (resolveProcessDbIds) pour être partagé par tous
 * les référentiels : c'est la seule des deux stratégies de résolution qui
 * s'appuie sur `questions.processId` (colonne fiable, peuplée à 100% pour
 * les 7 référentiels — vérifié 2026-07-24), contrairement à l'ancienne
 * approche `applicableProcesses`/JSON_CONTAINS qui matchait cette colonne
 * comme si elle contenait des noms de processus alors qu'elle stocke des
 * rôles économiques (voir CORRECTIONS.md).
 */
export async function resolveProcessDbIds(db: any, selected: string[]): Promise<number[]> {
  const sel = (selected || []).map((x) => String(x)).filter(Boolean);
  if (sel.length === 0) return [];

  const isNumericString = (v: string) => /^[0-9]+$/.test(v);

  // 1) IDs numériques directement fournis
  const numericIds = sel.filter((x) => isNumericString(x)).map((x) => Number(x));

  // 2) slugs canoniques -> noms (via CANONICAL_PROCESSES)
  const slugs = sel.filter((x) => !isNumericString(x) && x !== "all");
  const names = slugs
    .map((slug) => CANONICAL_PROCESSES.find((p) => p.id === slug)?.name)
    .filter(Boolean) as string[];

  let dbIds: number[] = [...numericIds];

  // 3) noms -> ids via DB (processus)
  if (names.length > 0) {
    try {
      const rows = await db
        .select({
          id: (processus as any).id,
          name: (processus as any).name,
        })
        .from(processus)
        .where(
          sql`${(processus as any).name} in (${sql.join(
            names.map((n) => sql`${n}`),
            sql`, `
          )})`
        );

      dbIds.push(...(rows || []).map((r: any) => Number(r.id)));
    } catch (e) {
      console.warn("[processResolution] resolveProcessDbIds failed (names->ids):", e);
    }
  }

  dbIds = Array.from(new Set(dbIds)).filter((n) => Number.isFinite(n));
  return dbIds;
}
