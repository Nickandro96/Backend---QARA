
import mysql from "mysql2/promise";
import "dotenv/config";

async function seed() {
  console.log("🌱 Starting Core Data Seed (Direct MySQL)...");
  
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌ DATABASE_URL is not set");
    return;
  }

  try {
    const connection = await mysql.createConnection(connectionString);
    console.log("✅ Connected to MySQL");

    // 1. Referentials
    console.log("1️⃣ Seeding Referentials...");
    const referentials = [
      ['MDR', 'Règlement (UE) 2017/745 (MDR)', 'Règlement relatif aux dispositifs médicaux', '2017/745'],
      ['ISO_13485', 'ISO 13485:2016', 'Dispositifs médicaux - Systèmes de management de la qualité', '2016'],
      ['ISO_9001', 'ISO 9001:2015', 'Systèmes de management de la qualité', '2015'],
      ['FDA_820', 'FDA 21 CFR Part 820 (QSR)', 'Quality System Regulation', 'Part 820'],
      ['FDA_807', 'FDA 21 CFR Part 807', 'Establishment Registration and Device Listing', 'Part 807'],
      ['FDA_510K', '510(k)', 'Premarket Notification', '510(k)'],
      ['FDA_LABELING', 'FDA Labeling', 'Device Labeling Requirements', 'Part 801']
    ];

    for (const ref of referentials) {
      await connection.execute(
        "INSERT INTO referentials (code, name, description, version) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description)",
        ref
      );
    }

    // 2. Processes
    console.log("2️⃣ Seeding Processes...");
    const processes = [
      ["Gouvernance & Management", "Responsabilité de la direction et stratégie", 1, "LayoutDashboard"],
      ["Système de Management de la Qualité", "Documentation et maîtrise du SMQ", 2, "FileText"],
      ["Conception & Développement", "Maîtrise de la conception des dispositifs", 3, "Lightbulb"],
      ["Gestion des Risques", "Analyse et maîtrise des risques", 4, "AlertTriangle"],
      ["Achats & Fournisseurs", "Maîtrise des fournisseurs et sous-traitants", 5, "ShoppingCart"],
      ["Production & Prestation de service", "Maîtrise de la fabrication", 6, "Factory"],
      ["Surveillance Après-Vente", "PMS et vigilance", 7, "Activity"]
    ];

    for (const proc of processes) {
      await connection.execute(
        "INSERT INTO processes (name, description, displayOrder, icon) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE description=VALUES(description), displayOrder=VALUES(displayOrder)",
        proc
      );
    }

    // 3. MDR Questions (Sample from Rapport Audit)
    console.log("3️⃣ Seeding MDR Questions...");
    const mdrQuestions = [
      ["mdr-q1", "Art. 10", "Le fabricant a-t-il établi un système de gestion des risques ?", "fabricant", "critical", "QMS", 1],
      ["mdr-q2", "Art. 15", "La personne chargée du respect de la réglementation est-elle désignée ?", "fabricant", "high", "RA", 2],
      ["mdr-q3", "Annexe IX", "La documentation technique est-elle tenue à jour ?", "fabricant", "critical", "Technical", 3]
    ];

    for (const q of mdrQuestions) {
      await connection.execute(
        "INSERT INTO mdr_questions (externalId, article, questionText, economicRole, criticality, processCategory, displayOrder) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE questionText=VALUES(questionText)",
        q
      );
    }

    // 4. ISO Questions
    console.log("4️⃣ Seeding ISO Questions...");
    const isoQuestions = [
      ["iso-13485-q1", "13485", "Système de management de la qualité", "L'organisme a-t-il établi un SMQ ?", "high", "QMS", "all"],
      ["iso-13485-q2", "13485", "Production", "Les processus de production sont-ils validés ?", "critical", "Production", "manufacturers_only"],
      ["iso-9001-q1", "9001", "Leadership", "La direction démontre-t-elle son engagement ?", "medium", "Management", "all"]
    ];

    for (const q of isoQuestions) {
      await connection.execute(
        "INSERT INTO iso_questions (externalId, standard, clauseTitle, questionText, criticality, processCategory, applicability) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE questionText=VALUES(questionText)",
        q
      );
    }

    // 5. FDA Roles
    console.log("5️⃣ Seeding FDA Roles...");
    const fdaRoles = [
      ['FDA_LM', 'Labeler / Specification Developer', 'Entities that design or put their brand on the device'],
      ['FDA_MFG', 'Manufacturer', 'Entities that manufacture or rework devices'],
      ['FDA_CMO', 'Contract Manufacturer', 'Entities that manufacture for a third party'],
      ['FDA_IMP', 'Initial Importer', 'Entities that first import devices into the US'],
      ['FDA_DIST', 'Distributor', 'Entities that distribute without modification'],
      ['FDA_REL', 'Relabeler / Repackager', 'Entities that relabel or repackage'],
      ['FDA_SRV', 'Remanufacturer / Servicer', 'Entities that service or repair devices'],
      ['FDA_SAMD', 'SaMD Developer', 'Entities that develop Software as a Medical Device']
    ];

    for (const role of fdaRoles) {
      await connection.execute(
        "INSERT INTO fda_roles (code, name, description) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name)",
        role
      );
    }

    // 6. FDA Questions
    console.log("6️⃣ Seeding FDA Questions...");
    const fdaQuestions = [
      ["fda-820-q1", "FDA_820", "QSR Compliance", "Does the manufacturer establish and maintain a quality system?", "critical", "ALL"],
      ["fda-807-q1", "FDA_807", "Establishment Registration", "Is the establishment registered with the FDA?", "high", "ALL"],
      ["fda-820-q2", "FDA_820", "Design Controls", "Are design control procedures established?", "critical", "SPECIFIC"]
    ];

    for (const q of fdaQuestions) {
      await connection.execute(
        "INSERT INTO fda_questions (externalId, frameworkCode, questionShort, questionDetailed, criticality, applicabilityType) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE questionDetailed=VALUES(questionDetailed)",
        q
      );
    }

    console.log("✨ Seed completed successfully!");
    await connection.end();
  } catch (error) {
    console.error("❌ Seed failed:", error);
  }
}

seed();
