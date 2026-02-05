/**
 * Stripe Products Configuration - B2B Premium Structure
 *
 * Principes commerciaux :
 * - Aucun plan gratuit ou "low cost"
 * - Tous les modules experts inclus dès le plan SOLO
 * - Différenciation basée sur : nombre d'utilisateurs, sites, pilotage, mode cabinet
 * - Message clé : "Un abonnement annuel coûte moins qu'une seule journée de consulting"
 */

export type SubscriptionTier = "FREE" | "PRO" | "EXPERT" | "ENTREPRISE";

export interface StripeProduct {
  id: SubscriptionTier;
  name: string;
  description: string;
  priceMonthly: number; // in EUR
  priceYearly: number; // in EUR
  priceId: string; // Stripe Price ID (monthly)
  priceIdYearly: string; // Stripe Price ID (yearly)
  features: string[];
  limitations: {
    maxUsers: number; // -1 = unlimited/configurable
    maxSites: number; // -1 = unlimited/configurable
    maxEntities: number; // -1 = unlimited/configurable
    multiUserManagement: boolean;
    roleManagement: boolean;
    multiClientMode: boolean;
    advancedPermissions: boolean;
    customBranding: boolean;
    aiMode: "standard" | "unlimited";
    complianceDashboards: boolean;
    complianceSprints: boolean;
    prioritySupport: boolean;
  };
  targetAudience: string[];
  positioning: string;
}

/**
 * Stripe Products Configuration
 * Replace these Price IDs with actual IDs from your Stripe Dashboard
 */
export const STRIPE_PRODUCTS: Record<SubscriptionTier, StripeProduct> = {
  FREE: {
    id: "FREE",
    name: "Gratuit",
    description: "Accès limité pour découvrir la plateforme",
    priceMonthly: 0,
    priceYearly: 0,
    priceId: "", // No Stripe Price ID for free tier
    priceIdYearly: "",
    features: [
      "❌ Aucun accès aux audits",
      "❌ Aucun accès à la classification",
      "❌ Aucun accès aux modules FDA",
      "❌ Aucun export",
      "✅ Consultation de la page de tarifs uniquement",
    ],
    limitations: {
      maxUsers: 0,
      maxSites: 0,
      maxEntities: 0,
      multiUserManagement: false,
      roleManagement: false,
      multiClientMode: false,
      advancedPermissions: false,
      customBranding: false,
      aiMode: "standard",
      complianceDashboards: false,
      complianceSprints: false,
      prioritySupport: false,
    },
    targetAudience: ["Nouveaux utilisateurs"],
    positioning: "Découvrez la plateforme avant de souscrire",
  },

  PRO: {
    id: "PRO",
    name: "Pro",
    description:
      "Autonomie réglementaire complète pour consultants indépendants et startups",
    priceMonthly: 99,
    priceYearly: 990,
    priceId: "price_1StooxFGj2NB13tmxoncA0Fx", // Stripe Price ID (monthly) - PRODUCTION
    priceIdYearly: "price_1StopOFGj2NB13tmKMzzb4P8", // Stripe Price ID (yearly) - PRODUCTION
    features: [
      "✅ 1 utilisateur",
      "✅ 1 site / 1 entité",
      "✅ Tous les référentiels (ISO 9001, ISO 13485, MDR complet, FDA complet)",
      "✅ Audit complet multi-référentiels",
      "✅ Classification MDR complète (Annexe VIII)",
      "✅ Classification FDA complète (Class I/II/III)",
      "✅ Exports illimités (PDF, Excel)",
      "✅ Checklist documents obligatoires",
      "✅ Suivi du statut documentaire",
      "✅ Sauvegarde et historique des audits",
      "✅ Alertes réglementaires (évolutions majeures)",
      "✅ IA réglementaire (mode standard, quota raisonnable)",
    ],
    limitations: {
      maxUsers: 1,
      maxSites: 1,
      maxEntities: 1,
      multiUserManagement: false,
      roleManagement: false,
      multiClientMode: false,
      advancedPermissions: false,
      customBranding: false,
      aiMode: "standard",
      complianceDashboards: false,
      complianceSprints: false,
      prioritySupport: false,
    },
    targetAudience: [
      "Consultants indépendants",
      "Startups medtech",
      "TPE",
      "Premiers dispositifs médicaux",
      "Équipes en phase de structuration réglementaire",
    ],
    positioning:
      "Autonomie réglementaire complète pour un solo ou une startup, à un coût inférieur à une journée de consulting.",
  },

  EXPERT: {
    id: "EXPERT",
    name: "Expert",
    description:
      "Plan cœur pour responsables Qualité et PME industrielles avec IA illimitée",
    priceMonthly: 199,
    priceYearly: 1990,
    priceId: "price_1StorLFGj2NB13tmLlpfrgJ2", // Stripe Price ID (monthly) - PRODUCTION
    priceIdYearly: "price_1StorcFGj2NB13tmnsAZo8G9", // Stripe Price ID (yearly) - PRODUCTION
    features: [
      "✅ Tout le plan SOLO, plus :",
      "✅ 3 utilisateurs",
      "✅ 2 sites",
      "✅ Gestion des rôles (Admin, Utilisateur)",
      "✅ IA réglementaire illimitée",
      "✅ Explication détaillée des exigences",
      "✅ Aide à la réponse d'audit",
      "✅ Génération automatique de plans d'actions correctives",
      "✅ Analyse de cohérence documentaire",
      "✅ Tableaux de bord de conformité globaux",
      "✅ Suivi de conformité dans le temps",
      "✅ Compliance sprints (objectifs, jalons, progression)",
      "✅ Badges 'Audit Ready'",
      "✅ Alertes réglementaires temps réel",
      "✅ Audit multi-processus avancé",
      "✅ Veille FDA étendue",
      "✅ Analyse d'impact réglementaire",
    ],
    limitations: {
      maxUsers: 3,
      maxSites: 2,
      maxEntities: 2,
      multiUserManagement: true,
      roleManagement: true,
      multiClientMode: false,
      advancedPermissions: false,
      customBranding: false,
      aiMode: "unlimited",
      complianceDashboards: true,
      complianceSprints: true,
      prioritySupport: false,
    },
    targetAudience: [
      "Responsables Qualité / Affaires Réglementaires",
      "PME industrielles",
      "Fabricants, importateurs, distributeurs",
      "Équipes internes structurées",
    ],
    positioning:
      "Ce plan remplace plusieurs jours de consulting par an et donne une autonomie experte au responsable QARA.",
  },

  ENTREPRISE: {
    id: "ENTREPRISE",
    name: "Entreprise / Cabinet / Multi-sites",
    description:
      "Solution évolutive pour groupes industriels et cabinets de conseil",
    priceMonthly: 390, // Starting price
    priceYearly: 3900, // Starting price (yearly)
    priceId: "price_1Stot3FGj2NB13tmKXosYuQ0", // Stripe Price ID (monthly) - PRODUCTION
    priceIdYearly: "price_1StotKFGj2NB13tmWFhi4s2j", // Stripe Price ID (yearly) - PRODUCTION
    features: [
      "✅ Tout le plan PME, plus :",
      "✅ Utilisateurs configurables (à partir de 3)",
      "✅ Sites configurables (à partir de 2)",
      "✅ Gestion multi-clients (mode cabinet)",
      "✅ Bibliothèque documentaire partagée",
      "✅ Gestion avancée des rôles & permissions",
      "✅ Planification des audits internes",
      "✅ Import / export massif",
      "✅ Historique consolidé",
      "✅ Support prioritaire",
      "✅ Accès anticipé aux nouvelles fonctionnalités",
      "✅ Personnalisation (logo, référentiels, processus internes)",
      "📊 Paliers : 390€ (3 users/2 sites) → 590€ (5 users/5 sites) → 790€ (cabinet)",
    ],
    limitations: {
      maxUsers: -1, // Configurable
      maxSites: -1, // Configurable
      maxEntities: -1, // Configurable
      multiUserManagement: true,
      roleManagement: true,
      multiClientMode: true,
      advancedPermissions: true,
      customBranding: true,
      aiMode: "unlimited",
      complianceDashboards: true,
      complianceSprints: true,
      prioritySupport: true,
    },
    targetAudience: [
      "Groupes industriels",
      "Entreprises multi-sites",
      "Cabinets de conseil QARA",
      "Organisations multi-entités / multi-clients",
    ],
    positioning:
      "Outil stratégique de pilotage de la conformité à l'échelle d'une organisation ou d'un cabinet.",
  },
};

/**
 * Get product configuration by tier
 */
export function getProductByTier(
  tier: string | null | undefined
): StripeProduct {
  const normalizedTier = (tier?.toUpperCase() || "FREE") as SubscriptionTier;
  return (
    STRIPE_PRODUCTS[normalizedTier] ||
    STRIPE_PRODUCTS.FREE
  );
}

/**
 * Get all available products for display
 */
export function getAllProducts(): StripeProduct[] {
  return Object.values(STRIPE_PRODUCTS);
}

/**
 * Check if a tier is valid
 */
export function isValidTier(tier: string): tier is SubscriptionTier {
  return ["SOLO", "PME", "ENTREPRISE"].includes(tier.toUpperCase());
}

/**
 * Commercial message to display globally
 */
export const COMMERCIAL_MESSAGE =
  "Un abonnement annuel coûte moins qu'une seule journée de consulting, et l'outil est disponible toute l'année.";
