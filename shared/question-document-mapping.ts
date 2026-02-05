/**
 * Mapping entre les questions d'audit et les documents obligatoires
 * 
 * Ce fichier définit les relations entre les questions d'audit et les documents
 * obligatoires attendus pour démontrer la conformité.
 */

export type QuestionDocumentMapping = {
  questionId?: number;
  processName?: string;
  referentialName?: string;
  articleReference?: string;
  documentNames: string[];
};

/**
 * Mapping générique par processus et référentiel
 * 
 * Ce mapping est utilisé lorsqu'aucun mapping spécifique par questionId n'existe.
 * Il associe les processus et référentiels aux documents obligatoires attendus.
 */
export const PROCESS_DOCUMENT_MAPPING: QuestionDocumentMapping[] = [
  // Système Qualité (ISO 9001 & ISO 13485)
  {
    processName: "Système de management de la qualité",
    referentialName: "ISO 13485",
    documentNames: [
      "Manuel Qualité",
      "Politique Qualité",
      "Objectifs Qualité",
      "Organigramme et Responsabilités",
      "Procédure de Gestion de la Documentation"
    ]
  },
  
  // Gestion des Risques
  {
    processName: "Gestion des risques",
    referentialName: "ISO 13485",
    documentNames: [
      "Plan de Gestion des Risques",
      "Analyse des Risques (ISO 14971)",
      "Rapport d'Évaluation des Risques",
      "Matrice de Traçabilité des Risques"
    ]
  },
  
  // Conception et Développement
  {
    processName: "Conception et développement",
    referentialName: "ISO 13485",
    documentNames: [
      "Plan de Développement",
      "Spécifications de Conception",
      "Dossier de Conception et Développement",
      "Revues de Conception",
      "Vérification et Validation de la Conception",
      "Transfert de Conception"
    ]
  },
  
  // Dossier Technique MDR
  {
    processName: "Documentation technique",
    referentialName: "MDR",
    documentNames: [
      "Dossier Technique de Dispositif Médical",
      "Description du Dispositif et Variantes",
      "Étiquetage et Notice d'Utilisation",
      "Spécifications de Conception et de Fabrication",
      "Évaluation Biologique et Chimique",
      "Évaluation Clinique",
      "Plan de Surveillance Post-Commercialisation (PMS)"
    ]
  },
  
  // Surveillance Post-Commercialisation
  {
    processName: "Surveillance post-commercialisation",
    referentialName: "MDR",
    documentNames: [
      "Plan de Surveillance Post-Commercialisation (PMS)",
      "Rapport Périodique de Sécurité Actualisé (PSUR)",
      "Procédure de Gestion des Réclamations",
      "Procédure de Vigilance et Rappels",
      "Registre des Incidents"
    ]
  },
  
  // Achats et Fournisseurs
  {
    processName: "Achats",
    referentialName: "ISO 13485",
    documentNames: [
      "Procédure de Gestion des Achats",
      "Liste des Fournisseurs Agréés",
      "Évaluation et Qualification des Fournisseurs",
      "Cahiers des Charges Fournisseurs"
    ]
  },
  
  // Production et Contrôle
  {
    processName: "Production et prestations de service",
    referentialName: "ISO 13485",
    documentNames: [
      "Instructions de Fabrication",
      "Plan de Contrôle Qualité",
      "Procédure de Libération de Lot",
      "Procédure de Traçabilité",
      "Enregistrements de Production"
    ]
  },
  
  // Audits Internes
  {
    processName: "Audit interne",
    referentialName: "ISO 13485",
    documentNames: [
      "Procédure d'Audit Interne",
      "Programme d'Audit Annuel",
      "Rapports d'Audit Interne",
      "Plan d'Actions Correctives"
    ]
  },
  
  // Actions Correctives et Préventives
  {
    processName: "Amélioration",
    referentialName: "ISO 13485",
    documentNames: [
      "Procédure d'Actions Correctives et Préventives (CAPA)",
      "Registre des CAPA",
      "Analyse des Causes Racines",
      "Suivi de l'Efficacité des Actions"
    ]
  },
  
  // Importateur (MDR Art. 13)
  {
    processName: "Obligations de l'importateur",
    referentialName: "MDR",
    documentNames: [
      "Déclaration d'Importation",
      "Vérification de la Conformité CE",
      "Registre des Dispositifs Importés",
      "Procédure de Gestion des Réclamations",
      "Coordonnées de la Personne Responsable"
    ]
  },
  
  // Distributeur (MDR Art. 14)
  {
    processName: "Obligations du distributeur",
    referentialName: "MDR",
    documentNames: [
      "Procédure de Vérification de la Conformité",
      "Registre des Dispositifs Distribués",
      "Conditions de Stockage et Transport",
      "Procédure de Gestion des Réclamations",
      "Traçabilité Amont et Aval"
    ]
  },
  
  // Évaluation Clinique
  {
    processName: "Évaluation clinique",
    referentialName: "MDR",
    documentNames: [
      "Plan d'Évaluation Clinique",
      "Rapport d'Évaluation Clinique (CER)",
      "Plan d'Investigation Clinique (CIP)",
      "Protocole d'Investigation Clinique",
      "Brochure Investigateur"
    ]
  },
  
  // Stérilisation
  {
    processName: "Stérilisation",
    referentialName: "ISO 13485",
    documentNames: [
      "Procédure de Stérilisation",
      "Validation du Procédé de Stérilisation",
      "Certificat de Stérilité",
      "Enregistrements de Stérilisation"
    ]
  },
  
  // Logiciels Médicaux
  {
    processName: "Logiciels médicaux",
    referentialName: "MDR",
    documentNames: [
      "Description du Logiciel Médical",
      "Validation du Logiciel (IEC 62304)",
      "Gestion de Configuration Logicielle",
      "Plan de Maintenance Logicielle",
      "Analyse de Cybersécurité"
    ]
  }
];

/**
 * Obtenir les documents obligatoires pour une question donnée
 * 
 * @param questionId - ID de la question
 * @param processName - Nom du processus
 * @param referentialName - Nom du référentiel
 * @returns Liste des noms de documents obligatoires
 */
export function getRequiredDocumentsForQuestion(
  questionId: number | undefined,
  processName: string | undefined,
  referentialName: string | undefined
): string[] {
  // Chercher d'abord un mapping spécifique par questionId
  // (pour l'instant, on n'en a pas, mais la structure est prête)
  
  // Sinon, chercher par processus et référentiel
  const mappings = PROCESS_DOCUMENT_MAPPING.filter(m => {
    const processMatch = !m.processName || !processName || 
      m.processName.toLowerCase().includes(processName.toLowerCase()) ||
      processName.toLowerCase().includes(m.processName.toLowerCase());
      
    const referentialMatch = !m.referentialName || !referentialName ||
      m.referentialName.toLowerCase().includes(referentialName.toLowerCase()) ||
      referentialName.toLowerCase().includes(m.referentialName.toLowerCase());
      
    return processMatch && referentialMatch;
  });
  
  // Fusionner tous les documents trouvés et dédupliquer
  const documents = new Set<string>();
  mappings.forEach(m => {
    m.documentNames.forEach(doc => documents.add(doc));
  });
  
  return Array.from(documents);
}
