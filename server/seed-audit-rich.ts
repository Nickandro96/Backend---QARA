/**
 * Seed script to create a rich audit with comprehensive data
 * for testing report generation with charts
 * 
 * Run with: pnpm exec tsx server/seed-audit-rich.ts
 */

import { getDb } from "./db";
import { audits, findings, actions, sites, processes, referentials, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function seedRichAudit() {
  console.log("🌱 Starting rich audit seed...\n");

  const db = await getDb();
  if (!db) {
    console.error("❌ Failed to connect to database");
    process.exit(1);
  }

  try {
    // 1. Get or create test user
    console.log("1️⃣ Getting test user...");
    let [user] = await db.select().from(users).where(eq(users.openId, "test-user-openid")).limit(1);
    
    if (!user) {
      console.log("   Creating test user...");
      const [newUser] = await db.insert(users).values({
        openId: "test-user-openid",
        name: "Test User",
        email: "test@example.com",
        role: "user",
      });
      user = { id: newUser.insertId, openId: "test-user-openid", name: "Test User", email: "test@example.com", role: "user" as const };
    }
    console.log(`   ✅ User ID: ${user.id}\n`);

    // 2. Get or create site
    console.log("2️⃣ Getting site...");
    let [site] = await db.select().from(sites).where(eq(sites.name, "Site Paris - Siège")).limit(1);
    
    if (!site) {
      console.log("   Creating site...");
      const [newSite] = await db.insert(sites).values({
        name: "Site Paris - Siège",
        address: "123 Avenue des Champs-Élysées, 75008 Paris",
        userId: user.id,
      });
      site = { id: newSite.insertId, name: "Site Paris - Siège", address: "123 Avenue des Champs-Élysées, 75008 Paris", userId: user.id };
    }
    console.log(`   ✅ Site ID: ${site.id}\n`);

    // 3. Get processes
    console.log("3️⃣ Getting processes...");
    const allProcesses = await db.select().from(processes);
    console.log(`   ✅ Found ${allProcesses.length} processes\n`);

    // 4. Get referentials
    console.log("4️⃣ Getting referentials...");
    const allReferentials = await db.select().from(referentials);
    const mdrRef = allReferentials.find(r => r.code.includes("MDR"));
    const isoRef = allReferentials.find(r => r.code.includes("ISO"));
    console.log(`   ✅ Found ${allReferentials.length} referentials\n`);

    // 5. Create rich audit
    console.log("5️⃣ Creating rich audit...");
    const [auditResult] = await db.insert(audits).values({
      name: "Audit MDR/ISO 13485 - Site Paris",
      auditType: "external",
      status: "completed",
      startDate: new Date("2025-07-05"),
      endDate: new Date("2025-07-06"),
      auditorName: "Marie Martin",
      auditorEmail: "marie.martin@audit-conseil.fr",
      siteId: site.id,
      userId: user.id,
      notes: "Évaluer la conformité du système qualité aux exigences réglementaires applicables et identifier les opportunités d'amélioration.",
      conformityRate: "61.2",
    });
    const auditId = auditResult.insertId;
    console.log(`   ✅ Audit ID: ${auditId}\n`);

    // 6. Create 50+ findings across 5 processes with varied criticalities
    console.log("6️⃣ Creating 50+ findings...");
    
    const findingsData = [
      // Process: Production & validation des procédés (15 findings)
      { title: "Validation des procédés de stérilisation incomplète", description: "Les paramètres critiques de stérilisation ne sont pas tous documentés dans le dossier de validation.", criticality: "critical", findingType: "nc_major", process: "Production & validation des procédés" },
      { title: "Absence de revalidation périodique", description: "Aucune revalidation des procédés de fabrication n'a été effectuée depuis 3 ans.", criticality: "high", findingType: "nc_major", process: "Production & validation des procédés" },
      { title: "Contrôles en cours de fabrication insuffisants", description: "Les contrôles en cours de fabrication ne couvrent pas tous les paramètres critiques.", criticality: "high", findingType: "nc_major", process: "Production & validation des procédés" },
      { title: "Documentation des déviations incomplète", description: "Certaines déviations de production ne sont pas documentées selon la procédure.", criticality: "medium", findingType: "nc_minor", process: "Production & validation des procédés" },
      { title: "Formation du personnel de production", description: "Les enregistrements de formation du personnel de production sont incomplets.", criticality: "medium", findingType: "nc_minor", process: "Production & validation des procédés" },
      { title: "Traçabilité des lots de matières premières", description: "La traçabilité des lots de matières premières pourrait être améliorée.", criticality: "low", findingType: "observation", process: "Production & validation des procédés" },
      { title: "Maintenance préventive des équipements", description: "Le plan de maintenance préventive n'inclut pas tous les équipements critiques.", criticality: "high", findingType: "nc_major", process: "Production & validation des procédés" },
      { title: "Qualification des équipements de mesure", description: "Certains équipements de mesure ne sont pas qualifiés selon les exigences.", criticality: "critical", findingType: "nc_major", process: "Production & validation des procédés" },
      { title: "Gestion des changements de procédés", description: "La procédure de gestion des changements n'est pas systématiquement appliquée.", criticality: "high", findingType: "nc_major", process: "Production & validation des procédés" },
      { title: "Contrôle environnemental des zones de production", description: "Les contrôles environnementaux ne sont pas réalisés à la fréquence définie.", criticality: "medium", findingType: "nc_minor", process: "Production & validation des procédés" },
      { title: "Identification des produits en cours", description: "L'identification des produits en cours de fabrication pourrait être améliorée.", criticality: "low", findingType: "observation", process: "Production & validation des procédés" },
      { title: "Gestion des produits non conformes", description: "La zone de quarantaine des produits non conformes n'est pas clairement identifiée.", criticality: "medium", findingType: "nc_minor", process: "Production & validation des procédés" },
      { title: "Documentation des paramètres de process", description: "Les paramètres de process ne sont pas tous documentés dans les instructions de fabrication.", criticality: "high", findingType: "nc_major", process: "Production & validation des procédés" },
      { title: "Analyse des tendances de production", description: "L'analyse des tendances des indicateurs de production n'est pas systématique.", criticality: "low", findingType: "observation", process: "Production & validation des procédés" },
      { title: "Nettoyage des équipements de production", description: "Les procédures de nettoyage ne spécifient pas tous les agents de nettoyage autorisés.", criticality: "medium", findingType: "nc_minor", process: "Production & validation des procédés" },

      // Process: Non-conformités & CAPA (12 findings)
      { title: "Analyse des causes racines insuffisante", description: "L'analyse des causes racines des NC majeures n'utilise pas de méthodologie structurée.", criticality: "critical", findingType: "nc_major", process: "Non-conformités & CAPA" },
      { title: "Délais de clôture des CAPA dépassés", description: "Plus de 30% des CAPA ne sont pas clôturées dans les délais définis.", criticality: "high", findingType: "nc_major", process: "Non-conformités & CAPA" },
      { title: "Efficacité des actions correctives non évaluée", description: "L'efficacité des actions correctives n'est pas systématiquement évaluée.", criticality: "high", findingType: "nc_major", process: "Non-conformités & CAPA" },
      { title: "Traçabilité des NC clients", description: "La traçabilité entre les réclamations clients et les NC internes est incomplète.", criticality: "medium", findingType: "nc_minor", process: "Non-conformités & CAPA" },
      { title: "Revue périodique des CAPA", description: "Aucune revue périodique des CAPA en cours n'est réalisée par la direction.", criticality: "high", findingType: "nc_major", process: "Non-conformités & CAPA" },
      { title: "Documentation des NC fournisseurs", description: "Les NC fournisseurs ne sont pas toutes documentées dans le système qualité.", criticality: "medium", findingType: "nc_minor", process: "Non-conformités & CAPA" },
      { title: "Analyse de tendances des NC", description: "L'analyse de tendances des NC par type et processus n'est pas réalisée.", criticality: "low", findingType: "observation", process: "Non-conformités & CAPA" },
      { title: "Formation sur la gestion des NC", description: "La formation du personnel sur la gestion des NC pourrait être renforcée.", criticality: "low", findingType: "observation", process: "Non-conformités & CAPA" },
      { title: "Critères de classification des NC", description: "Les critères de classification des NC (majeure/mineure) ne sont pas clairement définis.", criticality: "high", findingType: "nc_major", process: "Non-conformités & CAPA" },
      { title: "Communication des CAPA", description: "La communication des CAPA aux parties concernées n'est pas systématique.", criticality: "medium", findingType: "nc_minor", process: "Non-conformités & CAPA" },
      { title: "Archivage des dossiers de NC", description: "L'archivage des dossiers de NC ne respecte pas toujours la durée de conservation définie.", criticality: "medium", findingType: "nc_minor", process: "Non-conformités & CAPA" },
      { title: "Indicateurs de performance CAPA", description: "Les indicateurs de performance du processus CAPA pourraient être améliorés.", criticality: "low", findingType: "observation", process: "Non-conformités & CAPA" },

      // Process: Achats (10 findings)
      { title: "Évaluation des fournisseurs critiques", description: "L'évaluation des fournisseurs critiques n'est pas réalisée annuellement.", criticality: "critical", findingType: "nc_major", process: "Achats" },
      { title: "Qualification des nouveaux fournisseurs", description: "La procédure de qualification des nouveaux fournisseurs n'est pas appliquée systématiquement.", criticality: "high", findingType: "nc_major", process: "Achats" },
      { title: "Audits fournisseurs", description: "Les audits fournisseurs ne sont pas réalisés selon le plan défini.", criticality: "high", findingType: "nc_major", process: "Achats" },
      { title: "Spécifications d'achat", description: "Certaines spécifications d'achat ne sont pas à jour avec les dernières exigences produit.", criticality: "medium", findingType: "nc_minor", process: "Achats" },
      { title: "Contrôle à réception", description: "Les contrôles à réception ne couvrent pas tous les critères d'acceptation.", criticality: "high", findingType: "nc_major", process: "Achats" },
      { title: "Liste des fournisseurs approuvés", description: "La liste des fournisseurs approuvés n'est pas mise à jour régulièrement.", criticality: "medium", findingType: "nc_minor", process: "Achats" },
      { title: "Gestion des contrats fournisseurs", description: "Les contrats fournisseurs ne spécifient pas toujours les exigences qualité.", criticality: "medium", findingType: "nc_minor", process: "Achats" },
      { title: "Traçabilité des achats", description: "La traçabilité entre les commandes et les réceptions pourrait être améliorée.", criticality: "low", findingType: "observation", process: "Achats" },
      { title: "Revue des performances fournisseurs", description: "La revue des performances fournisseurs n'est pas documentée.", criticality: "high", findingType: "nc_major", process: "Achats" },
      { title: "Gestion des matières premières critiques", description: "Le plan de gestion des matières premières critiques pourrait être renforcé.", criticality: "low", findingType: "observation", process: "Achats" },

      // Process: Conception & développement (8 findings)
      { title: "Validation de la conception", description: "Les activités de validation de la conception ne sont pas toutes documentées.", criticality: "critical", findingType: "nc_major", process: "Conception & développement" },
      { title: "Revues de conception", description: "Les revues de conception ne sont pas réalisées à toutes les phases définies.", criticality: "high", findingType: "nc_major", process: "Conception & développement" },
      { title: "Gestion des risques produit", description: "L'analyse des risques produit n'est pas mise à jour suite aux modifications de conception.", criticality: "high", findingType: "nc_major", process: "Conception & développement" },
      { title: "Transfert vers la production", description: "Le processus de transfert vers la production n'est pas formalisé.", criticality: "medium", findingType: "nc_minor", process: "Conception & développement" },
      { title: "Documentation de conception", description: "Certains documents de conception ne sont pas approuvés par les fonctions concernées.", criticality: "medium", findingType: "nc_minor", process: "Conception & développement" },
      { title: "Traçabilité des exigences", description: "La traçabilité entre les exigences clients et les spécifications produit est incomplète.", criticality: "high", findingType: "nc_major", process: "Conception & développement" },
      { title: "Vérification de la conception", description: "Les activités de vérification de la conception pourraient être mieux documentées.", criticality: "low", findingType: "observation", process: "Conception & développement" },
      { title: "Gestion des modifications de conception", description: "La procédure de gestion des modifications de conception n'est pas toujours respectée.", criticality: "medium", findingType: "nc_minor", process: "Conception & développement" },

      // Process: Surveillance post-commercialisation (5 findings)
      { title: "Système de vigilance", description: "Le système de vigilance ne couvre pas tous les types d'incidents définis par le MDR.", criticality: "critical", findingType: "nc_major", process: "Surveillance post-commercialisation" },
      { title: "Analyse des données de surveillance", description: "L'analyse des données de surveillance post-commercialisation n'est pas systématique.", criticality: "high", findingType: "nc_major", process: "Surveillance post-commercialisation" },
      { title: "Rapport périodique de sécurité", description: "Le rapport périodique de sécurité (PSUR) n'est pas mis à jour selon la fréquence définie.", criticality: "high", findingType: "nc_major", process: "Surveillance post-commercialisation" },
      { title: "Traçabilité des dispositifs", description: "Le système de traçabilité des dispositifs commercialisés pourrait être amélioré.", criticality: "medium", findingType: "nc_minor", process: "Surveillance post-commercialisation" },
      { title: "Communication avec les autorités", description: "La procédure de communication avec les autorités compétentes pourrait être clarifiée.", criticality: "low", findingType: "observation", process: "Surveillance post-commercialisation" },
    ];

    const createdFindings: number[] = [];
    
    for (const finding of findingsData) {
      const processObj = allProcesses.find(p => p.name === finding.process);
      const [result] = await db.insert(findings).values({
        title: finding.title,
        description: finding.description,
        criticality: finding.criticality,
        findingType: finding.findingType,
        status: "open",
        processId: processObj?.id || null,
        auditId: auditId,
      });
      createdFindings.push(result.insertId);
    }
    
    console.log(`   ✅ Created ${createdFindings.length} findings\n`);

    // 7. Create 30 corrective actions
    console.log("7️⃣ Creating 30 corrective actions...");
    
    const actionsData = [
      // Actions for critical findings
      { title: "Compléter la validation de stérilisation", description: "Documenter tous les paramètres critiques de stérilisation et réaliser une revalidation complète.", responsible: "Responsable Production", dueDate: new Date("2025-08-15"), status: "in_progress", findingIndex: 0 },
      { title: "Qualifier les équipements de mesure", description: "Réaliser la qualification de tous les équipements de mesure critiques selon ISO 17025.", responsible: "Responsable Métrologie", dueDate: new Date("2025-08-30"), status: "open", findingIndex: 7 },
      { title: "Structurer l'analyse des causes racines", description: "Déployer la méthodologie 5 Pourquoi et diagramme d'Ishikawa pour toutes les NC majeures.", responsible: "Responsable Qualité", dueDate: new Date("2025-08-10"), status: "in_progress", findingIndex: 15 },
      { title: "Mettre en place un plan d'évaluation fournisseurs", description: "Définir et exécuter un plan d'évaluation annuel pour tous les fournisseurs critiques.", responsible: "Responsable Achats", dueDate: new Date("2025-09-01"), status: "open", findingIndex: 27 },
      { title: "Finaliser la validation de conception", description: "Compléter et documenter toutes les activités de validation de conception manquantes.", responsible: "Chef de Projet R&D", dueDate: new Date("2025-08-20"), status: "in_progress", findingIndex: 37 },
      { title: "Mettre à jour le système de vigilance", description: "Réviser le système de vigilance pour couvrir tous les types d'incidents MDR.", responsible: "Responsable Affaires Réglementaires", dueDate: new Date("2025-07-30"), status: "completed", findingIndex: 45 },

      // Actions for major findings
      { title: "Planifier les revalidations périodiques", description: "Établir un calendrier de revalidation périodique pour tous les procédés critiques.", responsible: "Responsable Production", dueDate: new Date("2025-09-15"), status: "open", findingIndex: 1 },
      { title: "Renforcer les contrôles en cours de fabrication", description: "Réviser et compléter les instructions de contrôle en cours de fabrication.", responsible: "Responsable Production", dueDate: new Date("2025-08-25"), status: "in_progress", findingIndex: 2 },
      { title: "Compléter le plan de maintenance préventive", description: "Ajouter tous les équipements critiques au plan de maintenance préventive.", responsible: "Responsable Maintenance", dueDate: new Date("2025-08-15"), status: "in_progress", findingIndex: 6 },
      { title: "Formaliser la gestion des changements", description: "Former le personnel et auditer l'application de la procédure de gestion des changements.", responsible: "Responsable Qualité", dueDate: new Date("2025-08-30"), status: "open", findingIndex: 8 },
      { title: "Documenter les paramètres de process", description: "Réviser toutes les instructions de fabrication pour inclure tous les paramètres critiques.", responsible: "Responsable Production", dueDate: new Date("2025-09-10"), status: "open", findingIndex: 12 },
      { title: "Réduire les délais de clôture des CAPA", description: "Mettre en place un système de rappel automatique et des revues hebdomadaires des CAPA.", responsible: "Responsable Qualité", dueDate: new Date("2025-08-05"), status: "completed", findingIndex: 16 },
      { title: "Évaluer l'efficacité des actions correctives", description: "Définir et appliquer une procédure d'évaluation de l'efficacité des AC.", responsible: "Responsable Qualité", dueDate: new Date("2025-08-20"), status: "in_progress", findingIndex: 17 },
      { title: "Mettre en place une revue périodique des CAPA", description: "Organiser des revues mensuelles des CAPA en cours avec la direction.", responsible: "Directeur Qualité", dueDate: new Date("2025-08-01"), status: "completed", findingIndex: 19 },
      { title: "Clarifier les critères de classification des NC", description: "Réviser et communiquer les critères de classification des NC.", responsible: "Responsable Qualité", dueDate: new Date("2025-08-15"), status: "in_progress", findingIndex: 23 },
      { title: "Systématiser la qualification des nouveaux fournisseurs", description: "Former les acheteurs et auditer l'application de la procédure de qualification.", responsible: "Responsable Achats", dueDate: new Date("2025-09-05"), status: "open", findingIndex: 28 },
      { title: "Rattraper les audits fournisseurs", description: "Réaliser les audits fournisseurs en retard selon le plan annuel.", responsible: "Auditeur Qualité", dueDate: new Date("2025-10-01"), status: "open", findingIndex: 29 },
      { title: "Renforcer les contrôles à réception", description: "Réviser les instructions de contrôle à réception pour couvrir tous les critères.", responsible: "Responsable Contrôle Qualité", dueDate: new Date("2025-08-30"), status: "open", findingIndex: 31 },
      { title: "Documenter la revue des performances fournisseurs", description: "Créer un modèle de revue des performances fournisseurs et former les acheteurs.", responsible: "Responsable Achats", dueDate: new Date("2025-09-15"), status: "open", findingIndex: 35 },
      { title: "Réaliser toutes les revues de conception", description: "Planifier et réaliser les revues de conception manquantes pour les projets en cours.", responsible: "Chef de Projet R&D", dueDate: new Date("2025-08-25"), status: "in_progress", findingIndex: 38 },
      { title: "Mettre à jour l'analyse des risques produit", description: "Réviser l'analyse des risques produit suite aux modifications de conception récentes.", responsible: "Ingénieur Qualité", dueDate: new Date("2025-08-20"), status: "in_progress", findingIndex: 39 },
      { title: "Compléter la traçabilité des exigences", description: "Mettre à jour la matrice de traçabilité pour tous les projets en cours.", responsible: "Chef de Projet R&D", dueDate: new Date("2025-09-10"), status: "open", findingIndex: 42 },
      { title: "Systématiser l'analyse des données de surveillance", description: "Définir et appliquer une procédure d'analyse trimestrielle des données de surveillance.", responsible: "Responsable Affaires Réglementaires", dueDate: new Date("2025-08-15"), status: "in_progress", findingIndex: 46 },
      { title: "Mettre à jour le PSUR", description: "Compléter et soumettre le rapport périodique de sécurité (PSUR) en retard.", responsible: "Responsable Affaires Réglementaires", dueDate: new Date("2025-08-10"), status: "in_progress", findingIndex: 47 },

      // Actions for minor findings
      { title: "Compléter la documentation des déviations", description: "Former le personnel et auditer l'application de la procédure de gestion des déviations.", responsible: "Responsable Production", dueDate: new Date("2025-09-20"), status: "open", findingIndex: 3 },
      { title: "Compléter les enregistrements de formation", description: "Mettre à jour les enregistrements de formation du personnel de production.", responsible: "Responsable RH", dueDate: new Date("2025-08-30"), status: "open", findingIndex: 4 },
      { title: "Augmenter la fréquence des contrôles environnementaux", description: "Réviser et appliquer le plan de contrôle environnemental des zones de production.", responsible: "Responsable Production", dueDate: new Date("2025-09-10"), status: "open", findingIndex: 9 },
      { title: "Identifier clairement la zone de quarantaine", description: "Installer une signalétique claire pour la zone de quarantaine des produits NC.", responsible: "Responsable Production", dueDate: new Date("2025-08-15"), status: "completed", findingIndex: 11 },
      { title: "Améliorer la traçabilité des NC clients", description: "Mettre en place un système de liaison entre réclamations clients et NC internes.", responsible: "Responsable Qualité", dueDate: new Date("2025-09-01"), status: "open", findingIndex: 18 },
      { title: "Documenter les NC fournisseurs", description: "Former les acheteurs sur la documentation des NC fournisseurs dans le système qualité.", responsible: "Responsable Achats", dueDate: new Date("2025-09-05"), status: "open", findingIndex: 20 },
    ];

    for (const action of actionsData) {
      await db.insert(actions).values({
        title: action.title,
        description: action.description,
        responsibleName: action.responsible,
        actionType: "corrective",
        dueDate: action.dueDate,
        status: action.status,
        findingId: createdFindings[action.findingIndex],
        completedAt: action.status === "completed" ? new Date() : null,
      });
    }
    
    console.log(`   ✅ Created ${actionsData.length} actions\n`);

    // 8. Summary
    console.log("📊 Summary:");
    console.log(`   - Audit ID: ${auditId}`);
    console.log(`   - Site: ${site.name}`);
    console.log(`   - Findings: ${createdFindings.length}`);
    console.log(`     • Critique: ${findingsData.filter(f => f.criticality === "critical").length}`);
    console.log(`     • Majeure: ${findingsData.filter(f => f.criticality === "high").length}`);
    console.log(`     • Mineure: ${findingsData.filter(f => f.criticality === "medium").length}`);
    console.log(`     • Observation: ${findingsData.filter(f => f.criticality === "low").length}`);
    console.log(`   - Actions: ${actionsData.length}`);
    console.log(`     • Completed: ${actionsData.filter(a => a.status === "completed").length}`);
    console.log(`     • InProgress: ${actionsData.filter(a => a.status === "in_progress").length}`);
    console.log(`     • Planned: ${actionsData.filter(a => a.status === "open").length}`);
    console.log(`   - Processes covered: 5`);
    console.log("\n✅ Rich audit seed completed successfully!");
    console.log(`\n🔗 Access audit detail at: /audit/${auditId}`);
    console.log(`🔗 Generate report at: /reports/generate?auditId=${auditId}`);

  } catch (error) {
    console.error("❌ Error seeding rich audit:", error);
    process.exit(1);
  }

  process.exit(0);
}

seedRichAudit();
