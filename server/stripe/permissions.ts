import { UserProfile } from "../../drizzle/schema";
import { STRIPE_PRODUCTS, SubscriptionTier } from "./products";

/**
 * Nouvelle logique de permissions B2B Premium
 * 
 * Principes :
 * - Tous les modules experts sont inclus dès le plan SOLO
 * - Différenciation basée uniquement sur :
 *   * Nombre d'utilisateurs
 *   * Nombre de sites/entités
 *   * Fonctionnalités de pilotage (dashboards, sprints)
 *   * Mode cabinet (multi-clients)
 *   * Niveau d'IA (standard vs illimité)
 */

/**
 * Check if a user has access to a specific feature based on their subscription tier
 * ADMIN has TOTAL BYPASS - access to everything
 */
export function hasFeatureAccess(
  userProfile: UserProfile | null | undefined,
  feature: keyof typeof FEATURE_ACCESS
): boolean {
  // ADMIN BYPASS: Admin has access to EVERYTHING
  if (userProfile?.user?.role === "admin") {
    return true;
  }

  const tier = (userProfile?.subscriptionTier?.toUpperCase() ||
    "FREE") as SubscriptionTier;

  const requiredTiers = FEATURE_ACCESS[feature];
  return requiredTiers.includes(tier);
}

/**
 * Feature access matrix - B2B Premium Structure
 * 
 * ✅ TOUS les modules experts sont accessibles dès SOLO
 * ❌ Seules les fonctionnalités de pilotage et multi-utilisateurs sont restreintes
 */
export const FEATURE_ACCESS = {
  // ========================================
  // MODULES EXPERTS (INCLUS DÈS SOLO)
  // ========================================
  
  // Référentiels complets (PRO+)
  iso_9001: ["PRO", "EXPERT", "ENTREPRISE"],
  iso_13485: ["PRO", "EXPERT", "ENTREPRISE"],
  mdr_complete: ["PRO", "EXPERT", "ENTREPRISE"],
  mdr_annexe_1: ["PRO", "EXPERT", "ENTREPRISE"],
  mdr_annexe_2: ["PRO", "EXPERT", "ENTREPRISE"],
  mdr_annexe_3: ["PRO", "EXPERT", "ENTREPRISE"],
  mdr_pms_psur: ["PRO", "EXPERT", "ENTREPRISE"],
  mdr_vigilance: ["PRO", "EXPERT", "ENTREPRISE"],
  
  // FDA complet (PRO+)
  fda_qmsr: ["PRO", "EXPERT", "ENTREPRISE"],
  fda_cfr_820: ["PRO", "EXPERT", "ENTREPRISE"],
  fda_510k: ["PRO", "EXPERT", "ENTREPRISE"],
  fda_de_novo: ["PRO", "EXPERT", "ENTREPRISE"],
  fda_pma: ["PRO", "EXPERT", "ENTREPRISE"],
  
  // Fonctions cœur (PRO+)
  full_audit: ["PRO", "EXPERT", "ENTREPRISE"],
  multi_referential_audit: ["PRO", "EXPERT", "ENTREPRISE"],
  mdr_classification: ["PRO", "EXPERT", "ENTREPRISE"],
  fda_classification: ["PRO", "EXPERT", "ENTREPRISE"],
  unlimited_exports: ["PRO", "EXPERT", "ENTREPRISE"],
  pdf_export: ["PRO", "EXPERT", "ENTREPRISE"],
  excel_export: ["PRO", "EXPERT", "ENTREPRISE"],
  mandatory_documents_checklist: ["PRO", "EXPERT", "ENTREPRISE"],
  document_status_tracking: ["PRO", "EXPERT", "ENTREPRISE"],
  audit_history: ["PRO", "EXPERT", "ENTREPRISE"],
  regulatory_alerts: ["PRO", "EXPERT", "ENTREPRISE"],
  
  // IA réglementaire (PRO+)
  ai_assistance: ["PRO", "EXPERT", "ENTREPRISE"],
  ai_standard: ["PRO", "EXPERT", "ENTREPRISE"],
  
  // ========================================
  // FONCTIONNALITÉS AVANCÉES (EXPERT+)
  // ========================================
  
  // IA illimitée (EXPERT+)
  ai_unlimited: ["EXPERT", "ENTREPRISE"],
  ai_detailed_explanations: ["EXPERT", "ENTREPRISE"],
  ai_audit_response_help: ["EXPERT", "ENTREPRISE"],
  ai_corrective_action_plans: ["EXPERT", "ENTREPRISE"],
  ai_document_coherence_analysis: ["EXPERT", "ENTREPRISE"],
  
  // Pilotage & suivi (EXPERT+)
  compliance_dashboards: ["EXPERT", "ENTREPRISE"],
  compliance_tracking_over_time: ["EXPERT", "ENTREPRISE"],
  compliance_sprints: ["EXPERT", "ENTREPRISE"],
  audit_ready_badges: ["EXPERT", "ENTREPRISE"],
  realtime_regulatory_alerts: ["EXPERT", "ENTREPRISE"],
  advanced_multi_process_audit: ["EXPERT", "ENTREPRISE"],
  fda_extended_watch: ["EXPERT", "ENTREPRISE"],
  regulatory_impact_analysis: ["EXPERT", "ENTREPRISE"],
  
  // Multi-utilisateurs (EXPERT+)
  multi_user_management: ["EXPERT", "ENTREPRISE"],
  role_management: ["EXPERT", "ENTREPRISE"],
  
  // ========================================
  // FONCTIONNALITÉS ENTREPRISE
  // ========================================
  
  // Multi-sites et multi-clients (ENTREPRISE uniquement)
  multi_site_management: ["ENTREPRISE"],
  multi_client_mode: ["ENTREPRISE"],
  shared_document_library: ["ENTREPRISE"],
  advanced_permissions: ["ENTREPRISE"],
  internal_audit_planning: ["ENTREPRISE"],
  bulk_import_export: ["ENTREPRISE"],
  consolidated_history: ["ENTREPRISE"],
  priority_support: ["ENTREPRISE"],
  early_access_features: ["ENTREPRISE"],
  custom_branding: ["ENTREPRISE"],
  custom_referentials: ["ENTREPRISE"],
  custom_processes: ["ENTREPRISE"],
} as const;

/**
 * Get the maximum number of users allowed for a tier
 */
export function getMaxUsers(tier: SubscriptionTier): number {
  const product = STRIPE_PRODUCTS[tier];
  return product.limitations.maxUsers;
}

/**
 * Get the maximum number of sites allowed for a tier
 */
export function getMaxSites(tier: SubscriptionTier): number {
  const product = STRIPE_PRODUCTS[tier];
  return product.limitations.maxSites;
}

/**
 * Get the maximum number of entities allowed for a tier
 */
export function getMaxEntities(tier: SubscriptionTier): number {
  const product = STRIPE_PRODUCTS[tier];
  return product.limitations.maxEntities;
}

/**
 * Check if a user can use unlimited AI
 */
export function canUseUnlimitedAI(
  userProfile: UserProfile | null | undefined
): boolean {
  return hasFeatureAccess(userProfile, "ai_unlimited");
}

/**
 * Check if a user can access compliance dashboards
 */
export function canAccessDashboards(
  userProfile: UserProfile | null | undefined
): boolean {
  return hasFeatureAccess(userProfile, "compliance_dashboards");
}

/**
 * Check if a user can manage multiple users
 */
export function canManageMultipleUsers(
  userProfile: UserProfile | null | undefined
): boolean {
  return hasFeatureAccess(userProfile, "multi_user_management");
}

/**
 * Check if a user can access multi-client mode (cabinet)
 */
export function canAccessMultiClientMode(
  userProfile: UserProfile | null | undefined
): boolean {
  return hasFeatureAccess(userProfile, "multi_client_mode");
}

/**
 * Get a user-friendly message for feature access denial
 */
export function getUpgradeMessage(feature: keyof typeof FEATURE_ACCESS): string {
  const requiredTiers = FEATURE_ACCESS[feature];
  const lowestTier = requiredTiers[0];

  const tierNames: Record<string, string> = {
    PME: "PME / Responsable QARA",
    ENTREPRISE: "Entreprise / Cabinet",
  };

  return `Cette fonctionnalité nécessite un abonnement ${tierNames[lowestTier] || lowestTier}. Passez à un plan supérieur pour y accéder.`;
}

/**
 * Check if a user's subscription is active
 */
export function hasActiveSubscription(
  userProfile: UserProfile | null | undefined
): boolean {
  if (!userProfile) return false;
  
  const status = userProfile.subscriptionStatus;
  return status === "active" || status === "trialing";
}

/**
 * Get tier display name
 */
export function getTierDisplayName(tier: string | null | undefined): string {
  const normalizedTier = tier?.toUpperCase();
  
  const displayNames: Record<string, string> = {
    FREE: "Gratuit",
    SOLO: "Solo / Startup MedTech",
    PME: "PME / Responsable QARA",
    ENTREPRISE: "Entreprise / Cabinet",
  };
  
  return displayNames[normalizedTier || "FREE"] || "Gratuit";
}
