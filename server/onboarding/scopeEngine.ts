/**
 * Moteur de personnalisation onboarding — SPEC ONBOARDING Partie 1 (logique)
 * + Partie 2 (écrans). Calcul pur et déterministe : normalise les libellés
 * bruts de rôle du corpus vers les 4 opérateurs économiques réglementaires,
 * et fournit le prédicat de correspondance (`matchesScope`) partagé entre
 * l'aperçu chiffré du wizard (compteur live) et la constitution réelle de
 * l'audit — même règle des deux côtés, comme l'exige la Partie 2 (« ne
 * jamais faire confiance au seul client »). Voir docs/audit/12-onboarding.md.
 */

export type RoleReglementaire = "fabricant" | "mandataire" | "importateur" | "distributeur";
export type SituationTag = "reconditionnement" | "assemblage";
export type Market = "EU" | "US" | "CA" | "BR" | "AU" | "JP";

export interface ScopeSelection {
  referentialCodes: string[];
  economicRoles: RoleReglementaire[];
  markets: Market[];
  situationTags: SituationTag[];
}

/**
 * Mapping des libellés bruts `questions.economicRole` (corpus réel, vérifié
 * en base — voir docs/audit/12-onboarding.md) vers les 4 rôles canoniques.
 * `assembleur` et `direction` ne sont PAS des rôles (spec Partie 1, §Étape B)
 * — ils sont traités comme génériques (roleReglementaire vide) et/ou comme
 * situation particulière (voir SITUATION_FROM_ECONOMIC_ROLE ci-dessous).
 */
export const ROLE_FROM_ECONOMIC_ROLE: Record<string, RoleReglementaire[]> = {
  fabricant: ["fabricant"],
  "finished device manufacturer": ["fabricant"],
  "fabricant ivd": ["fabricant"],
  "fabricant participant mdsap": ["fabricant"],
  "organisme dm": ["fabricant"],
  organisme: ["fabricant"],
  mandataire: ["mandataire"],
  "u.s. agent": ["mandataire"],
  "foreign establishment": ["mandataire"],
  importateur: ["importateur"],
  "initial importer": ["importateur"],
  distributeur: ["distributeur"],
  "distributeur selon rôle": ["distributeur"],
  "distributeur si applicable": ["distributeur"],
};

/** `economicRole` bruts qui dénotent une situation particulière plutôt qu'un rôle. */
export const SITUATION_FROM_ECONOMIC_ROLE: Record<string, SituationTag[]> = {
  assembleur: ["assemblage"],
};

/** Normalise un `economicRole` brut en rôles réglementaires canoniques (peut être vide = générique). */
export function normalizeEconomicRole(raw: string | null | undefined): RoleReglementaire[] {
  if (!raw) return [];
  const key = raw.trim().toLowerCase();
  return ROLE_FROM_ECONOMIC_ROLE[key] ?? [];
}

/**
 * Situation(s) particulière(s) dénotée(s) par un `economicRole` brut (ex.
 * "assembleur"). Note : le corpus ne porte aucun libellé `economicRole`
 * dédié au reconditionnement (Art. 16) — seul "assembleur" (Art. 22) est
 * identifiable de façon fiable. Voir docs/audit/12-onboarding.md : la case
 * "reconditionnement" reste dans l'UI (conforme à la spec) mais n'a
 * aujourd'hui aucun effet sur le filtrage, faute de signal dans le corpus.
 */
export function situationFromEconomicRole(raw: string | null | undefined): SituationTag[] {
  if (!raw) return [];
  const key = raw.trim().toLowerCase();
  return SITUATION_FROM_ECONOMIC_ROLE[key] ?? [];
}

export interface ScopableQuestion {
  roleReglementaire: string[] | null;
  situationTags: string[] | null;
}

/**
 * Prédicat de correspondance question ↔ scope utilisateur. Partagé par
 * `onboardingRouter.previewCount` (compteur live du wizard) et le filtrage
 * réel des questions d'un audit — garantit que le compteur affiché pendant
 * l'onboarding == le nombre de questions réellement servies (Partie 2,
 * « Comportements transverses »).
 *
 * Règles (Partie 1, §"Règles de personnalisation") :
 * - rôle : générique (roleReglementaire vide) OU intersection non vide avec les rôles choisis.
 * - situation : générique (situationTags vide) OU intersection non vide avec les situations cochées
 *   (les cases "reconditionnement"/"assemblage" AJOUTENT des questions, elles ne retirent rien).
 */
export function matchesScope(
  question: ScopableQuestion,
  scope: Pick<ScopeSelection, "economicRoles" | "situationTags">
): boolean {
  const questionRoles = question.roleReglementaire ?? [];
  const roleMatch = questionRoles.length === 0 || questionRoles.some((r) => scope.economicRoles.includes(r as RoleReglementaire));

  const questionSituations = question.situationTags ?? [];
  const situationMatch =
    questionSituations.length === 0 || questionSituations.some((s) => scope.situationTags.includes(s as SituationTag));

  return roleMatch && situationMatch;
}

export const REFERENTIAL_CATALOG = [
  { code: "MDR", label: "Dispositifs médicaux — UE (MDR 2017/745)", aide: "Obligatoire pour vendre des DM dans l'UE" },
  { code: "IVDR", label: "Diagnostic in vitro — UE (IVDR 2017/746)", aide: "Obligatoire pour vendre des DIV dans l'UE" },
  { code: "FDA_QMSR", label: "FDA — États-Unis (QMSR 21 CFR 820)", aide: "Obligatoire pour vendre des DM aux États-Unis" },
  { code: "MDSAP", label: "MDSAP (multi-juridictions)", aide: "Un seul audit reconnu par plusieurs pays" },
  { code: "ISO13485", label: "ISO 13485:2016 (SMQ dispositifs médicaux)", aide: "Système de management qualité de référence pour les DM" },
  { code: "ISO14971", label: "ISO 14971:2019 (gestion des risques)", aide: "Gestion des risques tout au long du cycle de vie" },
  { code: "ISO9001", label: "ISO 9001:2015 (SMQ générique)", aide: "Système de management qualité générique" },
] as const;

export const ECONOMIC_ROLE_CATALOG: Array<{ code: RoleReglementaire; label: string; description: string; exemple: string }> = [
  { code: "fabricant", label: "Fabricant", description: "Vous concevez ou fabriquez le dispositif.", exemple: "ex. : votre société conçoit un lit médicalisé." },
  { code: "mandataire", label: "Mandataire", description: "Vous représentez en UE un fabricant établi hors UE.", exemple: "ex. : vous êtes le représentant autorisé UE d'un fabricant américain." },
  { code: "importateur", label: "Importateur", description: "Vous introduisez sur le marché UE un dispositif d'un pays tiers.", exemple: "ex. : vous importez des DM fabriqués en Asie pour les vendre en UE." },
  { code: "distributeur", label: "Distributeur", description: "Vous mettez à disposition sans être fabricant ni importateur.", exemple: "ex. : vous distribuez des DM déjà mis sur le marché par un tiers." },
];

export const MARKET_CATALOG: Array<{ code: Market; label: string; autorite: string }> = [
  { code: "EU", label: "Union européenne", autorite: "Organismes notifiés UE" },
  { code: "US", label: "États-Unis", autorite: "FDA" },
  { code: "CA", label: "Canada", autorite: "Santé Canada" },
  { code: "BR", label: "Brésil", autorite: "ANVISA" },
  { code: "AU", label: "Australie", autorite: "TGA" },
  { code: "JP", label: "Japon", autorite: "PMDA" },
];

export const SITUATION_CATALOG: Array<{ code: SituationTag; label: string }> = [
  { code: "reconditionnement", label: "Je reconditionne ou ré-étiquette des dispositifs (Art. 16)" },
  { code: "assemblage", label: "J'assemble des dispositifs en systèmes/nécessaires (Art. 22)" },
];

export const SCOPE_SHORTCUTS: Record<string, string[]> = {
  "DM Europe": ["MDR", "ISO13485", "ISO14971"],
  "DIV Europe": ["IVDR", "ISO13485", "ISO14971"],
  USA: ["FDA_QMSR"],
  "Multi-marchés": ["MDSAP"],
};

/** Valide le scope minimal requis pour démarrer un audit (Partie 2, validations par étape). */
export function validateScopeCompletion(scope: ScopeSelection): string | null {
  if (scope.referentialCodes.length === 0) return "Sélectionnez au moins un référentiel.";
  if (scope.economicRoles.length === 0) return "Sélectionnez au moins un rôle.";
  if (scope.referentialCodes.includes("MDSAP") && scope.markets.length === 0) {
    return "Sélectionnez au moins un marché pour MDSAP.";
  }
  return null;
}
