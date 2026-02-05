import { drizzle } from "drizzle-orm/mysql2";
import { fdaRegulatoryUpdates } from "../../drizzle/schema";

const db = drizzle(process.env.DATABASE_URL!);

const fdaUpdates = [
  {
    title: "QMSR (Quality Management System Regulation) - Date d'effet : 2 février 2026",
    category: "qmsr" as const,
    content: "La FDA a publié le QMSR (Quality Management System Regulation) qui remplace le 21 CFR Part 820. Le QMSR est aligné sur ISO 13485:2016 et entre en vigueur le 2 février 2026.",
    impactLevel: "high" as const,
    affectedRoles: JSON.stringify(["manufacturer_us", "specification_developer", "contract_manufacturer"]),
    actionRequired: "Les fabricants doivent planifier la transition de leur QMS du Part 820 vers le QMSR avant le 2 février 2026. Cela inclut la mise à jour du Quality Manual, des procédures, et la formation des équipes.",
    sourceUrl: "https://www.fda.gov/medical-devices/quality-system-regulation/quality-management-system-regulation-qmsr",
    publishedAt: new Date("2024-02-02"),
  },
  {
    title: "Transition Part 820 → QMSR : Plan d'action recommandé",
    category: "qmsr" as const,
    content: "La FDA recommande aux fabricants de commencer la transition dès maintenant. Le QMSR introduit de nouvelles exigences alignées sur ISO 13485, notamment en matière de gestion des risques, de conception, et de surveillance post-commercialisation.",
    impactLevel: "high" as const,
    affectedRoles: JSON.stringify(["manufacturer_us", "specification_developer", "contract_manufacturer"]),
    actionRequired: "1. Gap analysis Part 820 vs QMSR. 2. Mise à jour du Quality Manual. 3. Révision des procédures QMS. 4. Formation des équipes. 5. Audit interne de préparation. 6. Mise en œuvre avant février 2026.",
    sourceUrl: "https://www.fda.gov/medical-devices/quality-system-regulation/quality-management-system-regulation-qmsr",
    publishedAt: new Date("2024-03-15"),
  },
  {
    title: "Guidance FDA : Software as a Medical Device (SaMD) - Mise à jour 2024",
    category: "guidance" as const,
    content: "La FDA a mis à jour sa guidance sur les logiciels en tant que dispositifs médicaux (SaMD). Cette guidance clarifie les exigences de validation, de cybersécurité, et de gestion des mises à jour logicielles.",
    impactLevel: "high" as const,
    affectedRoles: JSON.stringify(["manufacturer_us", "specification_developer"]),
    actionRequired: "Les fabricants de SaMD doivent revoir leurs processus de développement logiciel, renforcer la cybersécurité, et établir un processus de gestion des mises à jour conforme à la guidance FDA.",
    sourceUrl: "https://www.fda.gov/medical-devices/digital-health-center-excellence/software-medical-device-samd",
    publishedAt: new Date("2024-05-10"),
  },
  {
    title: "Cybersecurity in Medical Devices : Nouvelles exigences FDA",
    category: "guidance" as const,
    content: "La FDA a publié de nouvelles exigences de cybersécurité pour les dispositifs médicaux connectés. Les fabricants doivent démontrer que leurs dispositifs sont conçus avec la cybersécurité intégrée (security by design).",
    impactLevel: "high" as const,
    affectedRoles: JSON.stringify(["manufacturer_us", "specification_developer"]),
    actionRequired: "1. Conduire une évaluation des risques de cybersécurité. 2. Intégrer la cybersécurité dans le design (threat modeling). 3. Établir un plan de gestion des vulnérabilités. 4. Documenter dans le premarket submission.",
    sourceUrl: "https://www.fda.gov/medical-devices/digital-health-center-excellence/cybersecurity",
    publishedAt: new Date("2024-06-20"),
  },
  {
    title: "510(k) Modernization : Nouveau programme de pré-soumission",
    category: "510k" as const,
    content: "La FDA a lancé un nouveau programme de pré-soumission 510(k) pour aider les fabricants à préparer leurs soumissions. Ce programme permet de discuter avec la FDA avant la soumission formelle.",
    impactLevel: "medium" as const,
    affectedRoles: JSON.stringify(["manufacturer_us", "specification_developer"]),
    actionRequired: "Les fabricants préparant un 510(k) peuvent bénéficier d'une pré-soumission pour clarifier les exigences, les données nécessaires, et les comparaisons au predicate.",
    sourceUrl: "https://www.fda.gov/medical-devices/premarket-submissions-selecting-and-preparing-correct-submission/premarket-notification-510k",
    publishedAt: new Date("2024-07-15"),
  },
  {
    title: "De Novo Pathway : Guidance sur les Special Controls",
    category: "de_novo" as const,
    content: "La FDA a publié une guidance sur la définition des special controls dans les demandes De Novo. Cette guidance aide les fabricants à définir des contrôles appropriés pour les dispositifs nouveaux.",
    impactLevel: "medium" as const,
    affectedRoles: JSON.stringify(["manufacturer_us", "specification_developer"]),
    actionRequired: "Les fabricants préparant une demande De Novo doivent définir des special controls robustes et justifiés. La guidance FDA fournit des exemples et des bonnes pratiques.",
    sourceUrl: "https://www.fda.gov/medical-devices/premarket-submissions-selecting-and-preparing-correct-submission/de-novo-classification-request",
    publishedAt: new Date("2024-08-01"),
  },
  {
    title: "PMA Supplements : Nouvelles catégories et délais de review",
    category: "pma" as const,
    content: "La FDA a révisé les catégories de PMA supplements et les délais de review. Les fabricants doivent déterminer si un changement nécessite un 30-day notice, 135-day supplement, ou 180-day supplement.",
    impactLevel: "medium" as const,
    affectedRoles: JSON.stringify(["manufacturer_us"]),
    actionRequired: "Les fabricants de dispositifs Class III doivent revoir leur processus de gestion des changements pour déterminer correctement le type de PMA supplement requis.",
    sourceUrl: "https://www.fda.gov/medical-devices/premarket-submissions-selecting-and-preparing-correct-submission/premarket-approval-pma",
    publishedAt: new Date("2024-09-10"),
  },
  {
    title: "MDR Reporting : Clarifications sur les critères de reportabilité",
    category: "postmarket" as const,
    content: "La FDA a publié des clarifications sur les critères de reportabilité MDR. Cette guidance aide les fabricants à déterminer si un événement est reportable et dans quels délais (5-day vs 30-day).",
    impactLevel: "high" as const,
    affectedRoles: JSON.stringify(["manufacturer_us", "initial_importer"]),
    actionRequired: "Les fabricants doivent revoir leur MDR Reporting Procedure pour s'assurer que tous les événements reportables sont identifiés et reportés dans les délais FDA.",
    sourceUrl: "https://www.fda.gov/medical-devices/postmarket-requirements-devices/medical-device-reporting-mdr-how-report-medical-device-problems",
    publishedAt: new Date("2024-10-05"),
  },
  {
    title: "UDI : Extension des exigences aux dispositifs Class I",
    category: "labeling_udi" as const,
    content: "La FDA étend progressivement les exigences UDI aux dispositifs de Class I. Les fabricants doivent attribuer un UDI et enregistrer leurs dispositifs dans GUDID.",
    impactLevel: "medium" as const,
    affectedRoles: JSON.stringify(["manufacturer_us"]),
    actionRequired: "Les fabricants de dispositifs Class I doivent vérifier si leurs dispositifs sont concernés par les nouvelles échéances UDI et planifier l'attribution UDI et l'enregistrement GUDID.",
    sourceUrl: "https://www.fda.gov/medical-devices/unique-device-identification-system-udi-system/udi-basics",
    publishedAt: new Date("2024-11-01"),
  },
  {
    title: "Registration & Listing : Mise à jour annuelle obligatoire (Oct 1 - Dec 31)",
    category: "part_807" as const,
    content: "Rappel : Tous les établissements enregistrés auprès de la FDA doivent effectuer leur mise à jour annuelle entre le 1er octobre et le 31 décembre. Le non-respect peut entraîner la suspension de l'enregistrement.",
    impactLevel: "high" as const,
    affectedRoles: JSON.stringify(["manufacturer_us", "specification_developer", "contract_manufacturer", "initial_importer"]),
    actionRequired: "Effectuer la mise à jour annuelle de l'enregistrement FDA et du device listing avant le 31 décembre. Vérifier que toutes les informations sont à jour (adresse, contacts, dispositifs listés).",
    sourceUrl: "https://www.fda.gov/medical-devices/device-registration-and-listing/how-register-and-list",
    publishedAt: new Date("2024-09-15"),
  },
];

async function seedFdaRegulatoryUpdates() {
  console.log("🔄 Seeding FDA regulatory updates...");

  let inserted = 0;
  for (const update of fdaUpdates) {
    await db.insert(fdaRegulatoryUpdates).values({
      title: update.title,
      category: update.category,
      content: update.content + "\n\n**Action requise :** " + update.actionRequired,
      impactLevel: update.impactLevel,
      affectedRoles: update.affectedRoles,
      status: "acte" as const,
      sourceUrl: update.sourceUrl,
      publishedAt: update.publishedAt,
    });

    inserted++;
  }

  console.log(`✅ Inserted ${inserted} FDA regulatory updates`);
}

async function main() {
  console.log("🚀 Starting FDA regulatory updates seed...");
  
  await seedFdaRegulatoryUpdates();
  
  console.log("✅ FDA regulatory updates seed completed!");
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ FDA regulatory updates seed failed:", error);
  process.exit(1);
});
