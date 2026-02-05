import { CLASSIFICATION_RULES, type ClassificationRule, type DeviceClass } from "../shared/classification-rules";

export interface ClassificationAnswers {
  // Informations générales
  device_name?: string;
  device_description?: string;
  device_type?: "dm" | "accessoire";
  is_active?: boolean;
  is_software?: boolean;
  contact_nervous_system?: boolean;
  contact_circulatory_system?: boolean;
  provided_sterile?: boolean;
  has_measuring_function?: boolean;
  
  // Invasivité
  invasiveness?: "non-invasif" | "invasif_orifice" | "chirurgical";
  implantable?: boolean;
  
  // Durée
  duration?: "transitoire" | "court_terme" | "long_terme";
  
  // Site anatomique
  contact_site?: string | string[];
  wound_depth?: "superficielle" | "profonde";
  
  // Fonction/énergie
  function?: string[];
  danger_level?: "potentiellement_dangereux" | "normal";
  
  // Substances
  incorporates_drug?: boolean;
  incorporates_blood_derivative?: boolean;
  contains_absorbable_substance?: boolean;
  biological_effect?: boolean;
  
  // Matériaux
  contains_nanomaterials?: boolean;
  high_internal_exposure?: boolean;
  contains_animal_tissue?: boolean;
  
  // Logiciel
  software_purpose?: string[];
  
  // Autres
  reusable_surgical?: boolean;
  target_device?: "invasif" | "non_invasif";
}

export interface ClassificationResult {
  resultingClass: DeviceClass;
  appliedRules: ClassificationRule[];
  allMatchingRules: ClassificationRule[];
  justification: string;
  confidence: "high" | "medium" | "low";
  missingData: string[];
  recommendations: string[];
}

/**
 * Évalue si une condition est remplie
 */
function evaluateCondition(
  answers: ClassificationAnswers,
  field: string,
  operator: string,
  value: any
): boolean {
  const answerValue = (answers as any)[field];
  
  if (answerValue === undefined || answerValue === null) {
    return false;
  }
  
  switch (operator) {
    case "equals":
      return answerValue === value;
    
    case "not_equals":
      return answerValue !== value;
    
    case "includes":
      if (Array.isArray(answerValue)) {
        return answerValue.includes(value);
      }
      if (typeof answerValue === "string") {
        return answerValue.includes(value);
      }
      return false;
    
    case "greater_than":
      return answerValue > value;
    
    case "less_than":
      return answerValue < value;
    
    default:
      return false;
  }
}

/**
 * Évalue si toutes les conditions d'une règle sont remplies
 */
function evaluateRule(answers: ClassificationAnswers, rule: ClassificationRule): boolean {
  return rule.conditions.every(condition =>
    evaluateCondition(answers, condition.field, condition.operator, condition.value)
  );
}

/**
 * Détermine la classe la plus élevée
 */
function getHighestClass(classes: DeviceClass[]): DeviceClass {
  const classOrder: DeviceClass[] = ["I", "Is", "Im", "Ir", "IIa", "IIb", "III"];
  
  let highestClass: DeviceClass = "I";
  let highestIndex = 0;
  
  for (const cls of classes) {
    const index = classOrder.indexOf(cls);
    if (index > highestIndex) {
      highestIndex = index;
      highestClass = cls;
    }
  }
  
  return highestClass;
}

/**
 * Génère une justification détaillée
 */
function generateJustification(
  answers: ClassificationAnswers,
  appliedRules: ClassificationRule[],
  resultingClass: DeviceClass
): string {
  let justification = "## Analyse de classification\n\n";
  
  // Résumé des caractéristiques du dispositif
  justification += "### Caractéristiques du dispositif\n\n";
  
  if (answers.is_software) {
    justification += "- **Type** : Logiciel médical\n";
  } else if (answers.is_active) {
    justification += "- **Type** : Dispositif actif\n";
  } else {
    justification += "- **Type** : Dispositif non actif\n";
  }
  
  if (answers.invasiveness) {
    const invasivenessLabels = {
      "non-invasif": "Non invasif",
      "invasif_orifice": "Invasif par orifice corporel",
      "chirurgical": "Chirurgicalement invasif"
    };
    justification += `- **Invasivité** : ${invasivenessLabels[answers.invasiveness]}\n`;
  }
  
  if (answers.implantable) {
    justification += "- **Implantable** : Oui\n";
  }
  
  if (answers.duration) {
    const durationLabels = {
      "transitoire": "Transitoire (≤ 60 min)",
      "court_terme": "Court terme (> 60 min à ≤ 30 jours)",
      "long_terme": "Long terme (> 30 jours)"
    };
    justification += `- **Durée d'utilisation** : ${durationLabels[answers.duration]}\n`;
  }
  
  justification += "\n### Règles appliquées\n\n";
  
  // Détail des règles appliquées
  for (const rule of appliedRules) {
    justification += `**Règle ${rule.number}** : ${rule.title}\n`;
    justification += `- Classe résultante : **${rule.resultingClass}**\n`;
    justification += `- Justification : ${rule.rationale}\n\n`;
  }
  
  justification += `\n### Classe finale : **${resultingClass}**\n\n`;
  
  if (appliedRules.length > 1) {
    justification += `Plusieurs règles s'appliquent à ce dispositif. Conformément à l'Annexe VIII, la classe la plus élevée est retenue : **${resultingClass}**.\n`;
  }
  
  return justification;
}

/**
 * Génère des recommandations next-step
 */
function generateRecommendations(resultingClass: DeviceClass): string[] {
  const recommendations: string[] = [];
  
  switch (resultingClass) {
    case "I":
    case "Is":
    case "Im":
    case "Ir":
      recommendations.push("✓ Auto-certification possible (pas d'Organisme Notifié requis pour la classe I)");
      recommendations.push("✓ Déclaration de conformité UE à établir");
      recommendations.push("✓ Dossier technique à constituer et conserver");
      recommendations.push("✓ Marquage CE à apposer");
      if (resultingClass === "Is") {
        recommendations.push("⚠️ Dispositif fourni stérile : validation du processus de stérilisation requise");
      }
      if (resultingClass === "Im") {
        recommendations.push("⚠️ Dispositif avec fonction de mesure : validation métrologique requise");
      }
      break;
    
    case "IIa":
      recommendations.push("⚠️ Organisme Notifié (ON) requis pour l'évaluation de conformité");
      recommendations.push("⚠️ Procédure d'évaluation : Annexe IX (Système qualité) ou Annexe X (Examen de type)");
      recommendations.push("✓ Dossier technique complet à soumettre à l'ON");
      recommendations.push("✓ Évaluation clinique approfondie nécessaire");
      recommendations.push("✓ Certificat CE à obtenir avant mise sur le marché");
      break;
    
    case "IIb":
      recommendations.push("⚠️ Organisme Notifié (ON) requis pour l'évaluation de conformité");
      recommendations.push("⚠️ Procédure d'évaluation : Annexe IX (Système qualité avec examen de conception)");
      recommendations.push("✓ Dossier technique très complet requis");
      recommendations.push("✓ Évaluation clinique rigoureuse avec données cliniques substantielles");
      recommendations.push("✓ Plan de surveillance post-commercialisation (PMS) détaillé");
      recommendations.push("✓ Certificat CE à obtenir avant mise sur le marché");
      break;
    
    case "III":
      recommendations.push("🔴 Organisme Notifié (ON) requis - classe la plus stricte");
      recommendations.push("🔴 Procédure d'évaluation : Annexe IX (Système qualité complet avec examen de conception)");
      recommendations.push("🔴 Dossier technique exhaustif avec preuves cliniques robustes");
      recommendations.push("🔴 Évaluation clinique très rigoureuse (essais cliniques souvent requis)");
      recommendations.push("🔴 Plan de surveillance post-commercialisation (PMS) et PMCF obligatoires");
      recommendations.push("🔴 Certificat CE à obtenir avant mise sur le marché");
      recommendations.push("🔴 Consultation d'experts cliniques recommandée");
      break;
  }
  
  return recommendations;
}

/**
 * Identifie les données manquantes critiques
 */
function identifyMissingData(answers: ClassificationAnswers): string[] {
  const missing: string[] = [];
  
  if (!answers.invasiveness) {
    missing.push("Invasivité du dispositif (non invasif, invasif par orifice, chirurgicalement invasif)");
  }
  
  if (!answers.duration && answers.invasiveness !== "non-invasif") {
    missing.push("Durée d'utilisation (transitoire, court terme, long terme)");
  }
  
  if (answers.is_software && !answers.software_purpose) {
    missing.push("Usage du logiciel (support décision, décision critique, situation vitale)");
  }
  
  if (answers.is_active && !answers.function) {
    missing.push("Fonction du dispositif actif (monitoring, énergie, substances)");
  }
  
  return missing;
}

/**
 * Moteur principal de classification
 */
export function classifyDevice(answers: ClassificationAnswers): ClassificationResult {
  // Évaluer toutes les règles
  const matchingRules = CLASSIFICATION_RULES.filter(rule => evaluateRule(answers, rule));
  
  // Si aucune règle ne correspond, retourner classe I par défaut
  if (matchingRules.length === 0) {
    return {
      resultingClass: "I",
      appliedRules: [{
        id: "VIII-R1",
        number: 1,
        title: "Dispositif non invasif (défaut)",
        description: "Aucune règle spécifique ne s'applique",
        resultingClass: "I",
        conditions: [],
        rationale: "Par défaut, les dispositifs sont de classe I sauf si une règle spécifique s'applique"
      }],
      allMatchingRules: [],
      justification: "Aucune règle spécifique ne s'applique. Le dispositif est classé I par défaut.",
      confidence: "low",
      missingData: identifyMissingData(answers),
      recommendations: generateRecommendations("I")
    };
  }
  
  // Déterminer la classe la plus élevée
  const classes = matchingRules.map(r => r.resultingClass);
  const resultingClass = getHighestClass(classes);
  
  // Règles appliquées = règles qui donnent la classe finale
  const appliedRules = matchingRules.filter(r => r.resultingClass === resultingClass);
  
  // Générer la justification
  const justification = generateJustification(answers, appliedRules, resultingClass);
  
  // Déterminer le niveau de confiance
  const missingData = identifyMissingData(answers);
  const confidence: "high" | "medium" | "low" = 
    missingData.length === 0 ? "high" :
    missingData.length <= 2 ? "medium" : "low";
  
  return {
    resultingClass,
    appliedRules,
    allMatchingRules: matchingRules,
    justification,
    confidence,
    missingData,
    recommendations: generateRecommendations(resultingClass)
  };
}
