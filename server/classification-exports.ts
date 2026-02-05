import type { ClassificationResult, ClassificationAnswers } from "./classification-engine";

/**
 * Génère un rapport Excel de classification
 */
export function generateClassificationExcel(
  answers: ClassificationAnswers,
  result: ClassificationResult
): string {
  // Format CSV pour Excel (compatible avec tous les tableurs)
  let csv = "";
  
  // Tab 1: Résumé
  csv += "=== RAPPORT DE CLASSIFICATION MDR ===\n";
  csv += `Date de génération,${new Date().toLocaleDateString("fr-FR")}\n`;
  csv += `Classe résultante,${result.resultingClass}\n`;
  csv += `Niveau de confiance,${result.confidence === "high" ? "Élevé" : result.confidence === "medium" ? "Moyen" : "Faible"}\n`;
  csv += "\n";
  
  // Tab 2: Inputs
  csv += "=== CARACTÉRISTIQUES DU DISPOSITIF ===\n";
  csv += "Paramètre,Valeur\n";
  
  if (answers.device_name) csv += `Nom du dispositif,"${answers.device_name}"\n`;
  if (answers.device_description) csv += `Description,"${answers.device_description}"\n`;
  if (answers.device_type) csv += `Type,${answers.device_type === "dm" ? "Dispositif médical" : "Accessoire"}\n`;
  if (answers.is_active !== undefined) csv += `Dispositif actif,${answers.is_active ? "Oui" : "Non"}\n`;
  if (answers.is_software !== undefined) csv += `Logiciel médical,${answers.is_software ? "Oui" : "Non"}\n`;
  if (answers.invasiveness) {
    const invasivenessLabels = {
      "non-invasif": "Non invasif",
      "invasif_orifice": "Invasif par orifice corporel",
      "chirurgical": "Chirurgicalement invasif"
    };
    csv += `Invasivité,${invasivenessLabels[answers.invasiveness]}\n`;
  }
  if (answers.implantable !== undefined) csv += `Implantable,${answers.implantable ? "Oui" : "Non"}\n`;
  if (answers.duration) {
    const durationLabels = {
      "transitoire": "Transitoire (≤ 60 min)",
      "court_terme": "Court terme (> 60 min à ≤ 30 jours)",
      "long_terme": "Long terme (> 30 jours)"
    };
    csv += `Durée d'utilisation,${durationLabels[answers.duration]}\n`;
  }
  if (answers.contact_site) {
    const sites = Array.isArray(answers.contact_site) ? answers.contact_site.join(", ") : answers.contact_site;
    csv += `Sites anatomiques,"${sites}"\n`;
  }
  if (answers.function && answers.function.length > 0) {
    csv += `Fonctions,"${answers.function.join(", ")}"\n`;
  }
  csv += "\n";
  
  // Tab 3: Règles appliquées
  csv += "=== RÈGLES APPLIQUÉES ===\n";
  csv += "Numéro,Titre,Classe,Justification\n";
  for (const rule of result.appliedRules) {
    csv += `Règle ${rule.number},"${rule.title}",${rule.resultingClass},"${rule.rationale}"\n`;
  }
  csv += "\n";
  
  // Tab 4: Recommandations
  csv += "=== RECOMMANDATIONS NEXT-STEP ===\n";
  for (let i = 0; i < result.recommendations.length; i++) {
    csv += `${i + 1},"${result.recommendations[i]}"\n`;
  }
  csv += "\n";
  
  // Tab 5: Données manquantes
  if (result.missingData.length > 0) {
    csv += "=== DONNÉES MANQUANTES ===\n";
    for (const missing of result.missingData) {
      csv += `"${missing}"\n`;
    }
    csv += "\n";
  }
  
  // Tab 6: Justification complète
  csv += "=== JUSTIFICATION DÉTAILLÉE ===\n";
  csv += `"${result.justification.replace(/"/g, '""')}"\n`;
  
  return csv;
}

/**
 * Génère un rapport PDF de classification (format Markdown pour conversion)
 */
export function generateClassificationPDF(
  answers: ClassificationAnswers,
  result: ClassificationResult
): string {
  let markdown = "";
  
  // En-tête
  markdown += "# RAPPORT DE CLASSIFICATION MDR\n\n";
  markdown += `**Règlement (UE) 2017/745 - Annexe VIII**\n\n`;
  markdown += `Date de génération : ${new Date().toLocaleDateString("fr-FR", { 
    year: "numeric", 
    month: "long", 
    day: "numeric" 
  })}\n\n`;
  markdown += "---\n\n";
  
  // Résultat principal
  markdown += "## CLASSE DU DISPOSITIF\n\n";
  markdown += `### **Classe ${result.resultingClass}**\n\n`;
  markdown += `**Niveau de confiance** : ${
    result.confidence === "high" ? "Élevé ✓" : 
    result.confidence === "medium" ? "Moyen ⚠" : 
    "Faible ⚠"
  }\n\n`;
  markdown += "---\n\n";
  
  // Caractéristiques du dispositif
  markdown += "## CARACTÉRISTIQUES DU DISPOSITIF\n\n";
  
  if (answers.device_name) {
    markdown += `**Nom** : ${answers.device_name}\n\n`;
  }
  
  if (answers.device_description) {
    markdown += `**Description** : ${answers.device_description}\n\n`;
  }
  
  markdown += "### Informations générales\n\n";
  if (answers.device_type) {
    markdown += `- **Type** : ${answers.device_type === "dm" ? "Dispositif médical" : "Accessoire de dispositif médical"}\n`;
  }
  if (answers.is_active !== undefined) {
    markdown += `- **Dispositif actif** : ${answers.is_active ? "Oui" : "Non"}\n`;
  }
  if (answers.is_software !== undefined) {
    markdown += `- **Logiciel médical** : ${answers.is_software ? "Oui" : "Non"}\n`;
  }
  markdown += "\n";
  
  if (answers.invasiveness) {
    markdown += "### Invasivité\n\n";
    const invasivenessLabels = {
      "non-invasif": "Non invasif",
      "invasif_orifice": "Invasif par un orifice corporel",
      "chirurgical": "Chirurgicalement invasif"
    };
    markdown += `- **Niveau d'invasivité** : ${invasivenessLabels[answers.invasiveness]}\n`;
    if (answers.implantable !== undefined) {
      markdown += `- **Implantable** : ${answers.implantable ? "Oui" : "Non"}\n`;
    }
    markdown += "\n";
  }
  
  if (answers.duration) {
    markdown += "### Durée d'utilisation\n\n";
    const durationLabels = {
      "transitoire": "Transitoire (≤ 60 minutes)",
      "court_terme": "Court terme (> 60 minutes à ≤ 30 jours)",
      "long_terme": "Long terme (> 30 jours)"
    };
    markdown += `- **Durée** : ${durationLabels[answers.duration]}\n\n`;
  }
  
  if (answers.contact_site && answers.contact_site.length > 0) {
    markdown += "### Sites anatomiques\n\n";
    for (const site of answers.contact_site) {
      markdown += `- ${site.replace(/_/g, " ")}\n`;
    }
    markdown += "\n";
  }
  
  if (answers.function && answers.function.length > 0) {
    markdown += "### Fonctions\n\n";
    for (const func of answers.function) {
      markdown += `- ${func.replace(/_/g, " ")}\n`;
    }
    markdown += "\n";
  }
  
  markdown += "---\n\n";
  
  // Règles appliquées
  markdown += "## RÈGLES APPLIQUÉES\n\n";
  
  for (const rule of result.appliedRules) {
    markdown += `### Règle ${rule.number} : ${rule.title}\n\n`;
    markdown += `**Classe résultante** : ${rule.resultingClass}\n\n`;
    markdown += `**Justification** : ${rule.rationale}\n\n`;
  }
  
  if (result.appliedRules.length > 1) {
    markdown += `> **Note** : Plusieurs règles s'appliquent à ce dispositif. Conformément à l'Annexe VIII, la classe la plus élevée est retenue : **${result.resultingClass}**.\n\n`;
  }
  
  markdown += "---\n\n";
  
  // Justification détaillée
  markdown += "## JUSTIFICATION DÉTAILLÉE\n\n";
  markdown += result.justification + "\n\n";
  markdown += "---\n\n";
  
  // Recommandations
  markdown += "## RECOMMANDATIONS NEXT-STEP\n\n";
  
  for (let i = 0; i < result.recommendations.length; i++) {
    markdown += `${i + 1}. ${result.recommendations[i]}\n`;
  }
  markdown += "\n";
  
  // Données manquantes
  if (result.missingData.length > 0) {
    markdown += "---\n\n";
    markdown += "## DONNÉES MANQUANTES\n\n";
    markdown += "> Les informations suivantes n'ont pas été fournies. Compléter ces données pourrait améliorer la précision de la classification.\n\n";
    for (const missing of result.missingData) {
      markdown += `- ${missing}\n`;
    }
    markdown += "\n";
  }
  
  // Pied de page
  markdown += "---\n\n";
  markdown += "*Ce rapport a été généré automatiquement par la plateforme MDR Compliance. Il est fourni à titre indicatif et ne constitue pas un avis juridique ou réglementaire. La responsabilité finale de la classification incombe au fabricant.*\n";
  
  return markdown;
}
