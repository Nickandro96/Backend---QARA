import { randomUUID } from "node:crypto";

export type ChecklistSeed = { id: string; category: string; item: string; exigence: string | null };
const item = (category: string, label: string, exigence: string | null = null): ChecklistSeed => ({ id: randomUUID(), category, item: label, exigence });

const MDR = [
  item("Documentation technique", "Dossier technique à jour", "Annexe II MDR"), item("Documentation technique", "Évaluation clinique ou PMCF", "Article 61 MDR"),
  item("Documentation technique", "Rapport de gestion des risques", "ISO 14971"), item("Documentation technique", "Instructions d'utilisation conformes", "Article 10(11) MDR"),
  item("Documentation technique", "Étiquetage conforme UDI", "Article 27 MDR"), item("Documentation technique", "Déclaration de conformité UE", "Article 19 MDR"),
  item("SMQ", "Manuel qualité à jour", "ISO 13485"), item("SMQ", "Procédures applicables validées et diffusées", "ISO 13485"),
  item("SMQ", "Enregistrements de formation du personnel", "ISO 13485 §6.2"), item("SMQ", "Audits internes réalisés depuis moins de 12 mois", "ISO 13485 §8.2.4"),
  item("SMQ", "Revue de direction réalisée depuis moins de 12 mois", "ISO 13485 §5.6"), item("SMQ", "CAPA ouvertes avec plan d'action", "ISO 13485 §8.5"),
  item("Vigilance et PMS", "Plan PMS documenté et actif", "MDR Article 83"), item("Vigilance et PMS", "Rapports PSUR/PSR à jour", "MDR Article 86"),
  item("Vigilance et PMS", "Registre des incidents et FSCA", "MDR Articles 87-89"), item("Vigilance et PMS", "Rapports de vigilance soumis si requis", "MDR Article 87"),
];
const FDA = [item("QMSR / 21 CFR 820", "Quality Manual", "21 CFR 820.20"), item("QMSR / 21 CFR 820", "Design History File", "21 CFR 820.30"), item("QMSR / 21 CFR 820", "Device Master Record", "21 CFR 820.181"), item("QMSR / 21 CFR 820", "Device History Record", "21 CFR 820.184"), item("QMSR / 21 CFR 820", "CAPA records", "21 CFR 820.100"), item("QMSR / 21 CFR 820", "Complaint files", "21 CFR 820.198"), item("QMSR / 21 CFR 820", "MDR records", "21 CFR Part 803")];
const MDSAP = ["Regulatory Authority Requirements", "Dispositif médical", "Conception et développement", "Maîtrise des fournisseurs", "Fabrication et réalisation du produit", "Actions correctives et préventives", "Actions correctives mesurées"].map((x, i) => item("MDSAP", `Chapitre ${i + 1} : ${x}`, "MDSAP Audit Model"));

export function generatePreparationChecklist(organisme: string): ChecklistSeed[] {
  const normalized = organisme.toUpperCase();
  if (normalized === "FDA") return FDA;
  if (normalized === "MDSAP") return MDSAP;
  return MDR;
}
