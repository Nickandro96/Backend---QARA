/**
 * Matrice de capacités par plan — miroir serveur de ce que le frontend
 * (client/src/lib/plans.ts, déjà déployé sur bo77ju) applique côté client
 * pour le gating visuel. Aucun contrôle serveur n'existait jusqu'ici sur
 * qitbxl (confirmé par recherche exhaustive : requireCapability,
 * maxReferentiels, canUseClassification, PAID_PLAN, isPaidTier — zéro
 * résultat dans server/) : un compte Free pouvait appeler directement les
 * endpoints classification/FDA/veille/export via l'API, sans blocage.
 *
 * Même tiers et mêmes noms de capacité que le frontend (free/pro/expert/
 * entreprise ; canUseClassification/canUseFDA/canUseVeille/
 * canExportReports) pour rester cohérent avec ce qui est déjà en
 * production côté client — ce n'est pas repris du lot sécurité de la
 * branche main (abandonnée), juste aligné sur le modèle de plans déjà
 * déployé.
 */

export type PlanTier = "free" | "pro" | "expert" | "entreprise";

export interface PlanCapabilities {
  canUseClassification: boolean;
  canUseFDA: boolean;
  canUseVeille: boolean;
  canExportReports: boolean;
}

const FREE_CAPABILITIES: PlanCapabilities = {
  canUseClassification: false,
  canUseFDA: false,
  canUseVeille: false,
  canExportReports: false,
};

const PAID_CAPABILITIES: PlanCapabilities = {
  canUseClassification: true,
  canUseFDA: true,
  canUseVeille: true,
  canExportReports: true,
};

export function normalizePlanTier(value: unknown): PlanTier {
  const normalized = typeof value === "string" ? value.toLowerCase() : "free";
  if (normalized === "pro" || normalized === "expert" || normalized === "entreprise") {
    return normalized;
  }
  return "free";
}

export function getPlanCapabilities(subscriptionTier: unknown): PlanCapabilities {
  return normalizePlanTier(subscriptionTier) === "free" ? FREE_CAPABILITIES : PAID_CAPABILITIES;
}

export function isAdmin(user: { role?: unknown } | null | undefined): boolean {
  return user?.role === "admin";
}

/**
 * Un admin passe toujours (comme adminProcedure/protectedProcedure déjà en
 * place, server/_core/trpc.ts) — sert aussi de compte de test/support sans
 * dépendre du plan.
 */
export function hasCapability(
  capability: keyof PlanCapabilities,
  user: { role?: unknown; subscriptionTier?: unknown } | null | undefined
): boolean {
  if (isAdmin(user)) return true;
  return getPlanCapabilities(user?.subscriptionTier)[capability];
}
