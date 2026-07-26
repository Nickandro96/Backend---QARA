/**
 * QARA — Table de correspondance economicRole, validée ligne par ligne par
 * l'utilisateur (voir CORRECTIONS.md). Source unique, consommée par :
 * - scripts/import-corpus.mjs (applique la normalisation à l'import, pour
 *   qu'aucun déploiement ne puisse jamais réécrire une valeur brute) ;
 * - scripts/normalize-economic-roles.mjs (correctif ponctuel historique,
 *   conservé pour rejouer sur une base qui n'aurait pas encore ce correctif).
 *
 * Ne pas dupliquer cette table ailleurs — un seul endroit à modifier si la
 * correspondance évolue.
 *
 *   fabricant                      -> fabricant (inchangé)
 *   finished device manufacturer   -> fabricant
 *   fabricant IVD                  -> fabricant
 *   fabricant participant MDSAP    -> fabricant
 *   assembleur                     -> fabricant + situationTags: ["assemblage"] (Art. 22(3) MDR)
 *   U.S. agent                     -> fabricant + situationTags: ["acces_marche_us"] (21 CFR 807.40 —
 *                                      questions rédigées du point de vue du fabricant étranger qui
 *                                      doit désigner l'agent, jamais du distributeur/importateur)
 *   mandataire                     -> mandataire (inchangé)
 *   importateur                    -> importateur (inchangé)
 *   distributeur                   -> distributeur (inchangé)
 *   organisme DM                   -> NULL (universel — ISO13485 audite l'organisme, pas l'opérateur)
 *   organisme                      -> NULL (universel — ISO9001 s'applique à toute organisation)
 *   direction                      -> NULL (universel — générique, aucun rôle)
 */
export const ECONOMIC_ROLE_MAPPING = {
  fabricant: { role: "fabricant" },
  "finished device manufacturer": { role: "fabricant" },
  "fabricant IVD": { role: "fabricant" },
  "fabricant participant MDSAP": { role: "fabricant" },
  assembleur: { role: "fabricant", situationTags: ["assemblage"] },
  "U.S. agent": { role: "fabricant", situationTags: ["acces_marche_us"] },
  mandataire: { role: "mandataire" },
  importateur: { role: "importateur" },
  distributeur: { role: "distributeur" },
  "organisme DM": { role: null },
  organisme: { role: null },
  direction: { role: null },
};

/**
 * Résout une valeur brute d'economicRole (telle qu'authored dans le corpus)
 * vers { economicRole, economicRoleSource, situationTags } — utilisé à
 * l'import ET par le script de normalisation ponctuelle, pour ne jamais
 * diverger entre les deux chemins.
 */
export function resolveEconomicRole(rawValue) {
  const raw = rawValue || null;
  const mapping = raw ? ECONOMIC_ROLE_MAPPING[raw] : undefined;

  return {
    economicRole: mapping ? mapping.role : raw,
    economicRoleSource: raw,
    situationTags: mapping?.situationTags ?? [],
    unmapped: !!raw && !mapping,
  };
}
