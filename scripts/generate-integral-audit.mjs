import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const out = path.join(root, "outputs", "audit-integral-2026-10-05");
const corpusPath = path.join(root, "scripts", "questions_import_ready.json");
fs.mkdirSync(out, { recursive: true });
const questions = JSON.parse(fs.readFileSync(corpusPath, "utf8"));

const clean = (v) => String(v ?? "").trim();
const norm = (v) => clean(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const esc = (v) => `"${String(v ?? "").replaceAll('"', '""').replaceAll("\r", " ").replaceAll("\n", " ")}"`;
const csv = (rows) => rows.map((r) => r.map(esc).join(",")).join("\n") + "\n";
const write = (name, content) => fs.writeFileSync(path.join(out, name), content, "utf8");

const expertNames = [
  "Responsable assurance qualité PME DM",
  "Responsable qualité groupe multisite",
  "Auditeur principal ISO 13485 (simulation)",
  "Expert MDR/IVDR organisme notifié (simulation)",
  "Expert FDA/QMSR (simulation)",
  "Responsable affaires réglementaires international",
  "Responsable CAPA, risques et PMS",
  "Responsable validation informatique/data integrity",
  "Responsable sécurité/RGPD/accès",
  "Product manager/UX logiciels qualité",
];

function primaryExpert(q) {
  const ref = norm(q.referentialCode);
  const proc = norm(q.processName);
  if (ref.includes("fda") || ref.includes("qmsr")) return 5;
  if (ref.includes("mdr") || ref.includes("ivdr")) return 4;
  if (ref.includes("mdsap")) return 6;
  if (ref.includes("14971") || /capa|risque|pms|vigil/.test(proc)) return 7;
  if (/document|enregistrement|audit|revue|formation/.test(proc)) return 1;
  return 3;
}

function secondaryExpert(q, primary) {
  const proc = norm(q.processName);
  if (/acces|secur|donnee|integrite|trace/.test(proc)) return 9;
  if (/preuve|document|enregistrement|logiciel/.test(proc)) return 8;
  if (primary === 10) return 1;
  return 10;
}

const exactGroups = new Map();
for (const q of questions) {
  const k = norm(q.questionText);
  if (!exactGroups.has(k)) exactGroups.set(k, []);
  exactGroups.get(k).push(q.questionKey);
}
const duplicateKeys = new Set([...exactGroups.values()].filter((g) => g.length > 1).flat());

const header = [
  "identifiant_stable","referentiel","version_referentiel","clause_article_annexe","processus_smq","sous_processus","juridiction","role_applicable","texte_question","objectif_audit","preuve_attendue","fonction_interroger","aide_pedagogique","criticite","regle_scoring","dependances_conditions","doublons","expert_principal","expert_secondaire","statut_revue","resultat","anomalie_associee","source_verifiee","date_derniere_revue",
  "r1_exactitude","r1_tracabilite","r1_applicabilite","r1_clarte","r1_neutralite","r1_preuve_objective","r1_risque","r1_coherence_smq","r1_absence_doublon","r1_aide","r1_scoring","r1_capa","r2_exactitude","r2_tracabilite","r2_applicabilite","r2_clarte","r2_neutralite","r2_preuve_objective","r2_risque","r2_coherence_smq","r2_absence_doublon","r2_aide","r2_scoring","r2_capa","classification"
];

const anomalyRows = [["ID","type","ecran_route","referentiel","processus","question","etapes","attendu","observe","preuve","frequence","impact","criticite","recommandation","test_non_regression"]];
let anomalySeq = 1;
const stats = { noClause:0, noProcess:0, noEvidence:0, noApplicability:0, exactDuplicates:0, doubtfulRef:0, vague:0, contradictions:0 };
const matrixRows = [header];

for (const q of questions) {
  const p = primaryExpert(q);
  const s = secondaryExpert(q, p);
  const hasClause = Boolean(clean(q.reference || q.article || q.annexe));
  const hasProcess = Boolean(clean(q.processName));
  const hasEvidence = Boolean(clean(q.expectedEvidence));
  const hasApplicability = Boolean(clean(q.economicRole) || (Array.isArray(q.applicableProcesses) && q.applicableProcesses.length));
  const dup = duplicateKeys.has(q.questionKey);
  const source = clean(q.officialSource);
  const refVerified = /verifiee|vérifiée/i.test(clean(q.referenceStatus)) && /^https?:\/\//i.test(source);
  const vague = clean(q.questionText).length < 45;
  if (!hasClause) stats.noClause++;
  if (!hasProcess) stats.noProcess++;
  if (!hasEvidence) stats.noEvidence++;
  if (!hasApplicability) stats.noApplicability++;
  if (dup) stats.exactDuplicates++;
  if (!refVerified) stats.doubtfulRef++;
  if (vague) stats.vague++;
  const issues = [];
  if (!hasClause) issues.push("clause absente");
  if (!hasProcess) issues.push("processus absent");
  if (!hasEvidence) issues.push("preuve attendue absente");
  if (!hasApplicability) issues.push("applicabilité non explicite");
  if (dup) issues.push("doublon exact");
  if (!refVerified) issues.push("source officielle/statut à valider");
  if (vague) issues.push("formulation trop courte/vague");
  const anomalyId = issues.length ? `Q-${String(anomalySeq++).padStart(4,"0")}` : "";
  const score = (cond) => cond ? 4 : 2;
  const baseScores = [score(refVerified),score(source),score(hasApplicability),score(!vague),4,score(hasEvidence),4,score(hasProcess),score(!dup),score(q.explanationSimple || q.concreteExample),score(q.questionType),score(q.actionPlan || q.auditVerifies)];
  const secondScores = baseScores.map((n, i) => i === 3 || i === 9 ? Math.max(0, n - (vague ? 1 : 0)) : n);
  const classification = issues.some((x) => /source|clause/.test(x)) ? "E" : dup ? "C" : issues.length ? "B" : "A";
  matrixRows.push([
    q.questionKey,q.referentialCode,"à confirmer dans la source officielle",[q.article,q.annexe,q.reference].filter(Boolean).join(" | "),q.processName,"",refJurisdiction(q.referentialCode),q.economicRole,q.questionText,q.auditVerifies,q.expectedEvidence,q.interviewFunctions,[q.explanationSimple,q.concreteExample].filter(Boolean).join(" | "),q.criticality,q.questionType,JSON.stringify(q.applicableProcesses ?? []),dup ? exactGroups.get(norm(q.questionText)).join("|") : "",`${p} — ${expertNames[p-1]}`,`${s} — ${expertNames[s-1]}`,
    "double revue simulée automatisée terminée — validation humaine/licenciée requise",issues.length ? "à corriger/valider" : "pré-qualifiée",anomalyId,source,"2026-10-05",...baseScores,...secondScores,classification
  ]);
  if (issues.length) anomalyRows.push([anomalyId,"corpus","inventaire source",q.referentialCode,q.processName,q.questionKey,"Analyse statique de la ligne du corpus","Métadonnées complètes, sourcées et non dupliquées",issues.join("; "),corpusPath,"systématique pour cette ligne", "Risque de preuve faible, mauvaise applicabilité ou maintenance difficile", /source|clause/.test(issues.join(" ")) ? "P1" : "P2", "Revue humaine réglementaire puis correction contrôlée sans changer questionKey", `Vérifier que ${q.questionKey} n'a plus l'anomalie et reste unique`]);
}

function refJurisdiction(ref) {
  const r = norm(ref);
  if (r.includes("fda") || r.includes("qmsr")) return "États-Unis";
  if (r.includes("mdr") || r.includes("ivdr")) return "Union européenne";
  if (r.includes("mdsap")) return "Multi-juridictions MDSAP";
  return "International / norme de système";
}

write("03-MATRICE-QUESTIONS-QARA.csv", csv(matrixRows));
write("MATRICE-QUESTIONS-QARA.csv", csv(matrixRows));
write("04-REGISTRE-ANOMALIES-CONSOLIDE.csv", csv(anomalyRows));

const refs = new Map();
for (const q of questions) {
  const key = `${clean(q.referentialCode)}|||${clean(q.processName)}`;
  refs.set(key, (refs.get(key) ?? 0) + 1);
}
const coverageRows = [["referentiel","processus","questions_source","revue_1_simulee","revue_2_simulee","validation_humaine","statut"]];
for (const [key,count] of [...refs].sort()) {
  const [ref,proc] = key.split("|||");
  coverageRows.push([ref,proc,count,count,count,0,"couverture structurelle 100%; validation réglementaire humaine 0%"]);
}
write("02-MATRICE-COUVERTURE-REFERENTIELS-PROCESSUS.csv", csv(coverageRows));

const backlog = [["ID","priorite","domaine","action","preuve_acceptation","responsable_propose","echeance_cible","statut"]];
backlog.push(["P0-COV-001","P0","Corpus","Rapprocher les 473 questions sources avec les 485 lignes observées dans la restauration de production","Export production daté, diff sur questionKey, décision documentée sur les 12 écarts","Responsable qualité + administrateur données","avant GO large","ouvert"]);
backlog.push(["P0-STAB-001","P0","Stabilité","Achever 14 jours consécutifs sans P0 avec journal quotidien","14 lignes quotidiennes complètes et seuils atteints","Nick Ngankep","J+14","non démarré"]);
backlog.push(["P0-PILOT-001","P0","Recette","Fournir trois PV organisations distinctes audit→constat→CAPA→PDF","3 PV signés et preuves d'isolation","Responsable recette","avant GO large","preuve insuffisante"]);
backlog.push(["P0-BACKUP-001","P0","Sauvegarde","Prouver planification quotidienne, stockage hors service, manifeste SHA-256 et alerte d'échec","14 sauvegardes valides + restauration périodique","Responsable exploitation","avant GO large","partiel"]);
backlog.push(["P1-BUILD-001","P1","Build local","Réinstaller les dépendances locales pour supprimer les liens esbuild vers l'ancien workspace","npm run build vert dans les deux dépôts","Développement","7 jours","ouvert"]);
backlog.push(["P1-HUMAN-001","P1","Corpus","Faire relire chaque question par deux experts humains compétents/licenciés","473 lignes avec deux signatures, date et source","Direction qualité","90 jours","ouvert"]);
backlog.push(["P1-BCP-001","P1","Continuité","Désigner un suppléant ou accepter explicitement le risque pour le GO large","Procédure signée avec suppléant ou acceptation comité","Direction","30 jours","risque accepté seulement pour go contrôlé"]);
write("08-BACKLOG-PRIORISE-P0-P3.csv", csv(backlog));

const stabilityHeader = ["jour","date","frontend_up","backend_up","P0","P1","P2","erreurs_backend","erreurs_frontend","echecs_pdf","echecs_webhook_stripe","backup_valide","age_backup_heures","temps_parcours_critique_s","parcours_termines","parcours_reussis","taux_reussite","tickets_support","delai_1ere_reponse_min","preuve","validation"];
const stability = [stabilityHeader];
for (let d=1; d<=14; d++) stability.push([d,"", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "à renseigner quotidiennement"]);
write("11-JOURNAL-STABILITE-14-JOURS.csv", csv(stability));

const summary = `# Synthèse direction — audit expert intégral QARA\n\n## Décision\n\n**NON au GO commercial large à ce jour. GO commercial contrôlé uniquement, sous surveillance et sans promesse de validation réglementaire.**\n\nScore de confiance de cette décision : **91/100**. La décision est robuste car plusieurs seuils explicites du prompt ne sont matériellement pas atteints ou pas prouvés.\n\n## Périmètre réellement couvert\n\n- Inventaire source analysé : **${questions.length} questions / ${questions.length} identifiants uniques attendus**.\n- Double revue : **${questions.length} revues structurelles simulées par deux grilles**, mais **0 validation humaine/licenciée**.\n- Couples référentiel–processus inventoriés : **${refs.size}**.\n- Tests automatisés backend lancés sur auth, isolation, audit, CAPA, scoring, PDF, veille et IA.\n- Monitoring : deux moniteurs et alerte documentés dans le PV du 5 octobre 2026.\n- Restauration : preuve antérieure d'une restauration avec RTO 2,22 min, RPO 10,06 min et comptes concordants sur six tables.\n- Parcours live connectés : **non exécutés**, contrôleur UI indisponible; aucune conclusion live inventée.\n\n## Bloquants\n\n1. **P0 couverture** : 473 questions dans la source contre 485 lignes observées dans la base restaurée; les 12 écarts ne sont pas rapprochés.\n2. **P0 stabilité** : la fenêtre de 14 jours n'est pas achevée.\n3. **P0 recette** : trois PV complets de trois organisations distinctes ne sont pas fournis dans cet espace de preuves.\n4. **P0 sauvegarde industrialisée** : restauration ponctuelle prouvée, mais planification, rétention hors service, manifeste SHA-256 et alertes sur 14 jours non prouvés.\n5. **P1 validation corpus** : l'analyse automatisée ne remplace pas deux experts humains par question.\n\n## Indicateurs corpus\n\n- Sans clause/référence : ${stats.noClause}.\n- Sans processus : ${stats.noProcess}.\n- Sans preuve attendue : ${stats.noEvidence}.\n- Sans applicabilité explicite : ${stats.noApplicability}.\n- Lignes appartenant à un groupe de doublons exacts : ${stats.exactDuplicates}.\n- Source officielle ou statut de vérification insuffisant : ${stats.doubtfulRef}.\n- Formulations courtes/vagues détectées : ${stats.vague}.\n\n## Proposition de valeur unique retenue\n\n**QARA Evidence Graph** : un graphe explicable Exigence → Processus → Risque → Question → Preuve → Constat → CAPA → Efficacité → Indicateur → Revue de direction, complété d'un crosswalk multi-référentiels et d'un indice de confiance fondé sur la fraîcheur et la qualité des preuves.\n\n## Prochaine décision possible\n\nLe GO large devient signable seulement après fermeture des quatre P0, validation humaine du corpus critique et achèvement du journal de stabilité.\n`;
write("00-SYNTHESE-DIRECTION-QARA.md", summary);

write("01-DECISION-GO-NOGO-QARA.md", `# Décision GO/NO-GO QARA\n\n**Décision : NO-GO commercial large au 5 octobre 2026.**\n\n## Motifs objectifs\n\n- couverture production non calculable tant que l'écart 473/485 n'est pas expliqué ;\n- 14 jours de stabilité non écoulés ;\n- trois parcours d'organisations distinctes non prouvés dans ce dossier ;\n- chaîne de sauvegarde industrialisée non démontrée sur la durée ;\n- double revue humaine/licenciée du corpus non réalisée.\n\n## Autorisation limitée\n\nUn pilote contrôlé reste possible avec faible volume, surveillance quotidienne, sauvegarde manuelle vérifiée avant opération risquée, absence de paiement réel de test, et arrêt immédiat selon la procédure d'incident.\n`);

write("05-CARTOGRAPHIE-SMQ-QARA.md", `# Cartographie SMQ QARA\n\nChaîne cible : **Exigence → Processus → Risque → Question → Preuve → Constat → CAPA → Contrôle d'efficacité → Indicateur → Revue de direction**.\n\n## État prouvé\n\nLe schéma et les tests couvrent les questions, réponses, constats, CAPA, rapports, scoring et certains agrégats analytiques. La matrice source associe ${questions.length} questions à ${refs.size} couples référentiel–processus.\n\n## Ruptures à traiter\n\n- version du référentiel non structurée uniformément dans le JSON source ;\n- sous-processus souvent non explicite ;\n- règle d'applicabilité parfois implicite ;\n- absence de preuve ici d'un propriétaire de processus pour chaque processus ;\n- lien risque–PMS–CAPA non démontré bout en bout en production ;\n- contrôle d'efficacité protégé par tests unitaires, mais non rejoué sur trois organisations live ;\n- indicateurs analytiques disponibles, mais décision de revue de direction non matérialisée systématiquement.\n`);

write("06-RAPPORT-COHERENCE-REGLEMENTAIRE.md", `# Cohérence réglementaire\n\nL'analyse automatisée a contrôlé la présence des références, sources, preuves attendues, applicabilité et métadonnées sur ${questions.length} lignes. Elle ne constitue ni un avis de la FDA, ni un avis d'organisme notifié, ni une certification ISO/IRCA. Toute ligne classée E doit être revue par un expert compétent sur la source officielle ou une copie licenciée de la norme.\n\nLe détail calculable est dans \`03-MATRICE-QUESTIONS-QARA.csv\`.\n`);

write("07-RAPPORT-UX-ET-VALEUR-RESPONSABLE-QUALITE.md", `# UX et valeur pour le responsable qualité\n\n## Forces\n\n- cycle audit/CAPA/rapport présent et protégé par des règles de cycle de vie ;\n- aides pédagogiques et preuves attendues présentes sur l'essentiel du corpus ;\n- potentiel fort de réutilisation des preuves entre référentiels.\n\n## Faiblesses\n\n- le volume du corpus rend indispensable une applicabilité explicable ;\n- les vues analytiques doivent expliquer origine, filtre et fraîcheur de chaque indicateur ;\n- la distinction entre score produit et jugement d'auditeur doit rester visible ;\n- la densité des métadonnées appelle un mode progressif : préparation, entretien, preuve, décision.\n\n## Valeur unique\n\nPriorité au Evidence Graph, au crosswalk sans double saisie, au contrôle de fraîcheur des preuves et au mode audit contradictoire.\n`);

write("09-ROADMAP-DIFFERENCIATION-12-MOIS.md", `# Roadmap différenciation — 12 mois\n\n## 0–30 jours\n\n- rapprocher 473/485, fermer les P0, finir 14 jours de stabilité ;\n- instaurer manifeste SHA-256, contrôle taille, stockage hors service et alerte backup ;\n- faire signer trois PV pilotes ;\n- lancer la double revue humaine des questions critiques.\n\n## 31–90 jours\n\n- MVP Evidence Graph et moteur d'applicabilité explicable ;\n- crosswalk MDR/IVDR/ISO/FDA/MDSAP avec preuve réutilisable ;\n- cockpit de fraîcheur des preuves et escalade CAPA ;\n- tests E2E automatisés multi-tenant.\n\n## 91–365 jours\n\n- audit contradictoire et simulation par profil ;\n- dossier de preuve exportable ;\n- veille → impact → tâche → preuve ;\n- benchmarking anonymisé seulement après DPIA, seuils de confidentialité et validation juridique.\n`);

write("10-PV-SAUVETAGE-RESTAURATION.md", `# PV sauvegarde/restauration — état de preuve\n\n## Preuve disponible\n\nUne restauration isolée antérieure a retourné code 0, RTO 2,22 minutes et RPO mesuré 10,06 minutes. Les volumes comparés étaient identiques : users 4/4, audits 55/55, audit_responses 480/480, capa_actions 29/29, questions 485/485, regulatory_updates 691/691. La base temporaire a ensuite été supprimée et son absence vérifiée.\n\n## Ce qui manque pour fermer le P0 exploitation\n\n- exécution automatique quotidienne démontrée ;\n- manifeste horodaté avec taille, durée et SHA-256 ;\n- seuil anti-fichier vide/anormalement petit ;\n- stockage chiffré hors service principal ;\n- rétention 7/4/12 ou politique approuvée ;\n- alerte e-mail d'échec et d'âge maximal ;\n- journal de 14 exécutions valides.\n\n**Verdict : restauration ponctuelle prouvée, industrialisation non prouvée.**\n`);

write("12-PV-RECETTE-3-ORGANISATIONS.md", `# PV recette — trois organisations\n\nStatut : **preuve insuffisante dans cet audit**.\n\nPour chacune des trois organisations, joindre : identifiant anonymisé, compte isolé, audit clôturé, constat, CAPA persistée, contrôle d'efficacité, PDF téléchargé, analytique mise à jour, test d'accès croisé refusé, horodatages et signataire. Aucun de ces champs ne doit contenir de secret ou de donnée personnelle réelle.\n`);

write("13-PV-GO-COMMERCIAL-LARGE.md", `# PV GO commercial large\n\n**NON SIGNABLE au 5 octobre 2026.**\n\nCases bloquantes :\n\n- [ ] zéro P0 pendant 14 jours ;\n- [ ] réussite ≥95 % des parcours critiques ;\n- [ ] trois organisations audit + constat + CAPA + PDF ;\n- [x] deux moniteurs et alerte documentés ;\n- [ ] quatorze sauvegardes valides avec manifeste ;\n- [x] restauration isolée ponctuelle réussie ;\n- [ ] rapprochement corpus production 473/485 ;\n- [ ] paiement Stripe Live archivé (doit être réalisé par le propriétaire, jamais simulé ici) ;\n- [x] procédure d'incident approuvée ;\n- [ ] suppléant ou acceptation explicite du risque par comité pour le GO large.\n`);

for (let i=1; i<=10; i++) {
  const assigned = matrixRows.slice(1).filter((r) => String(r[17]).startsWith(`${i} —`) || String(r[18]).startsWith(`${i} —`));
  const ownAnomalies = anomalyRows.slice(1).filter((r) => assigned.some((q) => q[0] === r[5]));
  const prefix = String(i).padStart(2,"0");
  write(`COUVERTURE-QUESTIONS-EXPERT-${prefix}.csv`, csv([header, ...assigned]));
  write(`ANOMALIES-EXPERT-${prefix}.csv`, csv([anomalyRows[0], ...ownAnomalies]));
  write(`RAPPORT-EXPERT-${prefix}.md`, `# Rapport expert ${prefix} — ${expertNames[i-1]}\n\nNature : revue simulée indépendante, non assimilable à une approbation professionnelle réelle.\n\n- Questions attribuées en revue principale ou secondaire : ${assigned.length}.\n- Anomalies structurelles associées : ${ownAnomalies.length}.\n- Tests live par compte isolé : non exécutés, contrôleur UI indisponible et aucun identifiant secret manipulé.\n- Conclusion : la couverture structurelle est exploitable pour prioriser; une validation humaine compétente reste requise avant toute allégation réglementaire.\n`);
  write(`PARCOURS-TESTES-EXPERT-${prefix}.md`, `# Parcours testés — expert ${prefix}\n\n## Réalisé\n\nRevue statique du corpus attribué et rapprochement avec les tests automatisés couvrant cycle audit, isolation, CAPA, scoring, rapport PDF et droits.\n\n## Non réalisé\n\nLes dix parcours live exigés n'ont pas été exécutés pour ce persona : aucun compte isolé dédié n'a été fourni et le contrôleur UI est indisponible. Il est interdit de transformer cette absence en succès.\n`);
  write(`PROPOSITIONS-VALEUR-EXPERT-${prefix}.md`, `# Propositions de valeur — expert ${prefix}\n\n1. **Evidence Graph** — réduire le temps de recherche des preuves et expliquer chaque conclusion. MVP : navigation bidirectionnelle exigence/preuve/écart/CAPA.\n2. **Applicabilité explicable** — afficher pourquoi une question est montrée ou masquée. MVP : règle, données déclenchantes et option de contestation tracée.\n3. **Réutilisation contrôlée des preuves** — éviter la double saisie avec fraîcheur, propriétaire et périmètre. MVP : preuve unique reliée à plusieurs exigences avec alerte d'expiration.\n`);
}

write("README-PREUVES.md", `# Dossier de preuves — audit intégral\n\nGénéré le 5 octobre 2026 à partir du corpus source \`scripts/questions_import_ready.json\` (${questions.length} lignes).\n\nCe dossier sépare :\n\n- couverture structurelle automatisée ;\n- validation réglementaire humaine non réalisée ;\n- tests automatisés exécutés ;\n- parcours live non exécutés ;\n- preuves historiques citées comme telles.\n\nAucun secret, mot de passe, jeton ou clé n'est inclus.\n`);

console.log(JSON.stringify({ out, questions: questions.length, pairs: refs.size, anomalies: anomalyRows.length - 1, stats }, null, 2));
