/**
 * Server-side subscription capability matrix.
 *
 * ⚠️ Mirror of the frontend's per-page gating (`subscriptionTier === "free"`
 * checks in client/src/pages/*.tsx — there is no single frontend plans.ts
 * today). Any change here MUST be reflected on the frontend side too, until
 * the AppRouter type-sharing lot ("Lot 2" historique) lets both sides share
 * one source of truth.
 *
 * Plan model: `users.subscriptionTier` is "free" | "pro" | "expert" | "entreprise".
 * Every paid tier (pro/expert/entreprise) unlocks the same capabilities as
 * "pro" today — there is no per-tier differentiation yet beyond free/paid.
 */

export type SubscriptionTier = "free" | "pro" | "expert" | "entreprise";

export type Capability =
  | "canUseClassification"
  | "canUseFDA"
  | "canUseVeille"
  | "canExportReports"
  | "canUseAI";

export interface PlanUser {
  role?: string | null;
  subscriptionTier?: string | null;
}

const FREE_PLAN_CAPABILITIES: Record<Capability, boolean> = {
  canUseClassification: false,
  canUseFDA: false,
  canUseVeille: false,
  canExportReports: false,
  canUseAI: false,
};

const PAID_PLAN_CAPABILITIES: Record<Capability, boolean> = {
  canUseClassification: true,
  canUseFDA: true,
  canUseVeille: true,
  canExportReports: true,
  canUseAI: true,
};

export const FREE_PLAN_MAX_REFERENTIELS = 1;
export const PAID_PLAN_MAX_REFERENTIELS = 7;

export function isAdmin(user: PlanUser | null | undefined): boolean {
  return user?.role === "admin";
}

export function isPaidTier(user: PlanUser | null | undefined): boolean {
  const tier = (user?.subscriptionTier ?? "free") as SubscriptionTier;
  return tier !== "free";
}

export function hasCapability(user: PlanUser | null | undefined, capability: Capability): boolean {
  if (isAdmin(user)) return true;
  const capabilities = isPaidTier(user) ? PAID_PLAN_CAPABILITIES : FREE_PLAN_CAPABILITIES;
  return capabilities[capability];
}

export function maxReferentiels(user: PlanUser | null | undefined): number {
  if (isAdmin(user)) return PAID_PLAN_MAX_REFERENTIELS;
  return isPaidTier(user) ? PAID_PLAN_MAX_REFERENTIELS : FREE_PLAN_MAX_REFERENTIELS;
}

const CAPABILITY_LABELS: Record<Capability, string> = {
  canUseClassification: "la classification MDR",
  canUseFDA: "la détermination de voie FDA",
  canUseVeille: "la veille réglementaire",
  canExportReports: "l'export de rapports",
  canUseAI: "les fonctionnalités IA réglementaire",
};

export function capabilityLabel(capability: Capability): string {
  return CAPABILITY_LABELS[capability];
}
