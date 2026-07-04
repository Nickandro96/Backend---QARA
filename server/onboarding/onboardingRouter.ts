import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, safeJsonParse } from "../db";
import { questions, referentiels, userAuditScope } from "../../drizzle/schema";
import { createAudit } from "../db";
import {
  REFERENTIAL_CATALOG,
  ECONOMIC_ROLE_CATALOG,
  MARKET_CATALOG,
  SITUATION_CATALOG,
  SCOPE_SHORTCUTS,
  matchesScope,
  validateScopeCompletion,
} from "./scopeEngine";
import type { Market, RoleReglementaire, ScopeSelection, SituationTag } from "./scopeEngine";

const scopeSelectionInput = z.object({
  referentialCodes: z.array(z.string()).default([]),
  economicRoles: z.array(z.enum(["fabricant", "mandataire", "importateur", "distributeur"])).default([]),
  markets: z.array(z.enum(["EU", "US", "CA", "BR", "AU", "JP"])).default([]),
  situationTags: z.array(z.enum(["reconditionnement", "assemblage"])).default([]),
});

interface QuestionForCount {
  referentialCode: string;
  roleReglementaire: string[] | null;
  situationTags: string[] | null;
}

async function loadQuestionsForCounting(db: NonNullable<Awaited<ReturnType<typeof getDb>>>): Promise<QuestionForCount[]> {
  const rows = await db
    .select({
      referentialId: questions.referentialId,
      roleReglementaire: questions.roleReglementaire,
      situationTags: questions.situationTags,
    })
    .from(questions);

  const referentialRows = await db.select().from(referentiels);
  const codeById = new Map(referentialRows.map((r) => [r.id, r.code ?? String(r.id)]));

  return rows.map((r) => ({
    referentialCode: r.referentialId !== null ? codeById.get(r.referentialId) ?? "?" : "?",
    roleReglementaire: safeJsonParse<string[]>(r.roleReglementaire, []),
    situationTags: safeJsonParse<string[]>(r.situationTags, []),
  }));
}

function countMatching(allQuestions: QuestionForCount[], scope: ScopeSelection) {
  const inScope = allQuestions.filter((q) => scope.referentialCodes.includes(q.referentialCode));
  const matched = inScope.filter((q) => matchesScope(q, scope));

  const parReferentiel: Record<string, number> = {};
  for (const q of matched) {
    parReferentiel[q.referentialCode] = (parReferentiel[q.referentialCode] ?? 0) + 1;
  }

  return { total: matched.length, parReferentiel };
}

export const onboardingRouter = router({
  /** Catalogue statique (référentiels + volumes réels, rôles, marchés, situations, raccourcis). */
  getScopeOptions: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const allQuestions = await loadQuestionsForCounting(db);
    const volumeByReferential: Record<string, number> = {};
    for (const q of allQuestions) {
      volumeByReferential[q.referentialCode] = (volumeByReferential[q.referentialCode] ?? 0) + 1;
    }

    return {
      referentials: REFERENTIAL_CATALOG.map((r) => ({ ...r, volume: volumeByReferential[r.code] ?? 0 })),
      economicRoles: ECONOMIC_ROLE_CATALOG,
      markets: MARKET_CATALOG,
      situations: SITUATION_CATALOG,
      shortcuts: SCOPE_SHORTCUTS,
    };
  }),

  /** Scope de l'utilisateur courant (brouillon en cours ou complété), ou defaults si aucun. */
  getMyScope: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const [row] = await db.select().from(userAuditScope).where(eq(userAuditScope.userId, ctx.user.id)).limit(1);

    return {
      referentialCodes: safeJsonParse<string[]>(row?.referentialCodes, []),
      economicRoles: safeJsonParse<RoleReglementaire[]>(row?.economicRoles, []),
      markets: safeJsonParse<Market[]>(row?.markets, []),
      situationTags: safeJsonParse<SituationTag[]>(row?.situationTags, []),
      currentStep: row?.currentStep ?? "referentiels",
      completedAt: row?.completedAt ? row.completedAt.toISOString() : null,
    };
  }),

  /** Statut du gate (utilisé au login pour rediriger vers /onboarding ou le dashboard). */
  getGateStatus: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const [row] = await db
      .select({ completedAt: userAuditScope.completedAt, currentStep: userAuditScope.currentStep })
      .from(userAuditScope)
      .where(eq(userAuditScope.userId, ctx.user.id))
      .limit(1);

    return {
      onboardingComplete: !!row?.completedAt,
      onboardingStarted: !!row,
      currentStep: row?.currentStep ?? "referentiels",
    };
  }),

  /** Sauvegarde continue (autosave) de l'état du wizard, sans validation — reprise possible. */
  saveProgress: protectedProcedure
    .input(scopeSelectionInput.partial().extend({ currentStep: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [existing] = await db.select().from(userAuditScope).where(eq(userAuditScope.userId, ctx.user.id)).limit(1);

      const values = {
        referentialCodes: input.referentialCodes ?? safeJsonParse(existing?.referentialCodes, []),
        economicRoles: input.economicRoles ?? safeJsonParse(existing?.economicRoles, []),
        markets: input.markets ?? safeJsonParse(existing?.markets, []),
        situationTags: input.situationTags ?? safeJsonParse(existing?.situationTags, []),
        currentStep: input.currentStep ?? existing?.currentStep ?? "referentiels",
      };

      if (existing) {
        await db.update(userAuditScope).set(values).where(eq(userAuditScope.userId, ctx.user.id));
      } else {
        await db.insert(userAuditScope).values({ userId: ctx.user.id, ...values });
      }

      return { saved: true };
    }),

  /** Compteur live (§ "Comportements transverses") — même règle que le filtrage réel des audits. */
  previewCount: protectedProcedure.input(scopeSelectionInput).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const allQuestions = await loadQuestionsForCounting(db);
    return countMatching(allQuestions, input);
  }),

  /**
   * Finalise l'onboarding : valide le scope minimal, l'enregistre comme
   * source de vérité (`user_audit_scope`), et crée un audit réellement
   * filtré (§ "ne jamais faire confiance au seul client" — revalidation
   * serveur complète, même moteur que previewCount).
   */
  complete: protectedProcedure
    .input(scopeSelectionInput.extend({ siteId: z.number().int().positive().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const error = validateScopeCompletion(input);
      if (error) throw new TRPCError({ code: "BAD_REQUEST", message: error });

      const allQuestions = await loadQuestionsForCounting(db);
      const { total } = countMatching(allQuestions, input);
      if (total === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cette combinaison ne cible aucune question — ajoutez un référentiel.",
        });
      }

      const [existing] = await db.select().from(userAuditScope).where(eq(userAuditScope.userId, ctx.user.id)).limit(1);
      const scopeValues = {
        referentialCodes: input.referentialCodes,
        economicRoles: input.economicRoles,
        markets: input.markets,
        situationTags: input.situationTags,
        currentStep: "apercu",
        completedAt: new Date(),
      };
      if (existing) {
        await db.update(userAuditScope).set(scopeValues).where(eq(userAuditScope.userId, ctx.user.id));
      } else {
        await db.insert(userAuditScope).values({ userId: ctx.user.id, ...scopeValues });
      }

      const referentialRows = await db.select().from(referentiels);
      const idByCode = new Map(referentialRows.map((r) => [r.code, r.id]));
      const referentialIds = input.referentialCodes.map((code) => idByCode.get(code)).filter((id): id is number => !!id);

      const created = await createAudit({
        userId: ctx.user.id,
        name: `Audit ${input.referentialCodes.join(" + ")}`,
        type: input.referentialCodes[0] ?? "MDR",
        siteId: input.siteId ?? null,
        status: "draft",
        economicRole: input.economicRoles[0] ?? null,
        economicRoles: input.economicRoles,
        markets: input.markets,
        situationTags: input.situationTags,
        processIds: null,
        referentialIds,
        auditorName: null,
        auditorEmail: null,
        startDate: null,
        endDate: null,
      });

      return { auditId: created.id, questionCount: total };
    }),
});
