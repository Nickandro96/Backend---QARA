/**
 * Règles de classification MDR 2017/745 - Annexe VIII
 * Dataset complet des 22 règles de classification
 */

export type DeviceClass = "I" | "IIa" | "IIb" | "III" | "Is" | "Im" | "Ir";

export interface ClassificationRule {
  id: string;
  number: number;
  title: string;
  description: string;
  resultingClass: DeviceClass;
  conditions: RuleCondition[];
  rationale: string;
}

export interface RuleCondition {
  field: string;
  operator: "equals" | "includes" | "not_equals" | "greater_than" | "less_than";
  value: any;
}

/**
 * Règles de classification complètes selon Annexe VIII
 */
export const CLASSIFICATION_RULES: ClassificationRule[] = [
  // RÈGLE 1 - Dispositifs non invasifs
  {
    id: "VIII-R1",
    number: 1,
    title: "Dispositifs non invasifs transitoires",
    description: "Tous les dispositifs non invasifs sont de classe I, sauf si l'une des règles suivantes s'applique",
    resultingClass: "I",
    conditions: [
      { field: "invasiveness", operator: "equals", value: "non-invasif" },
      { field: "duration", operator: "equals", value: "transitoire" }
    ],
    rationale: "Dispositif non invasif à usage transitoire - Classe I par défaut"
  },

  // RÈGLE 2 - Dispositifs canalisant/stockant sang, liquides corporels
  {
    id: "VIII-R2",
    number: 2,
    title: "Dispositifs canalisant/stockant sang ou liquides corporels",
    description: "Dispositifs destinés à canaliser ou stocker du sang, liquides corporels, tissus ou cellules",
    resultingClass: "IIa",
    conditions: [
      { field: "invasiveness", operator: "equals", value: "non-invasif" },
      { field: "function", operator: "includes", value: "canaliser_stocker_sang" }
    ],
    rationale: "Dispositif canalisant ou stockant du sang/liquides corporels - Classe IIa"
  },

  // RÈGLE 3 - Dispositifs modifiant composition biologique/chimique
  {
    id: "VIII-R3",
    number: 3,
    title: "Dispositifs modifiant composition biologique/chimique",
    description: "Dispositifs destinés à modifier la composition biologique ou chimique du sang, liquides corporels ou autres liquides destinés à être perfusés",
    resultingClass: "IIb",
    conditions: [
      { field: "invasiveness", operator: "equals", value: "non-invasif" },
      { field: "function", operator: "includes", value: "modifier_composition" }
    ],
    rationale: "Dispositif modifiant la composition biologique/chimique - Classe IIb"
  },

  // RÈGLE 4 - Dispositifs en contact avec peau lésée
  {
    id: "VIII-R4",
    number: 4,
    title: "Dispositifs en contact avec peau lésée",
    description: "Dispositifs en contact avec une peau lésée",
    resultingClass: "I",
    conditions: [
      { field: "invasiveness", operator: "equals", value: "non-invasif" },
      { field: "contact_site", operator: "equals", value: "peau_lesee" },
      { field: "function", operator: "not_equals", value: "barr iere_mecanique" }
    ],
    rationale: "Dispositif en contact avec peau lésée (usage simple) - Classe I"
  },

  {
    id: "VIII-R4b",
    number: 4,
    title: "Dispositifs en contact avec peau lésée (barrière mécanique)",
    description: "Dispositifs destinés à être utilisés principalement comme barrière mécanique, pour la compression ou l'absorption d'exsudats",
    resultingClass: "IIa",
    conditions: [
      { field: "invasiveness", operator: "equals", value: "non-invasif" },
      { field: "contact_site", operator: "equals", value: "peau_lesee" },
      { field: "function", operator: "equals", value: "barriere_mecanique" }
    ],
    rationale: "Dispositif en contact avec peau lésée (barrière mécanique/compression) - Classe IIa"
  },

  {
    id: "VIII-R4c",
    number: 4,
    title: "Dispositifs en contact avec peau lésée (plaies profondes)",
    description: "Dispositifs destinés à être utilisés principalement pour des plaies qui ont pénétré le derme et ne peuvent cicatriser que par seconde intention",
    resultingClass: "IIb",
    conditions: [
      { field: "invasiveness", operator: "equals", value: "non-invasif" },
      { field: "contact_site", operator: "equals", value: "peau_lesee" },
      { field: "wound_depth", operator: "equals", value: "profonde" }
    ],
    rationale: "Dispositif pour plaies profondes (derme pénétré) - Classe IIb"
  },

  // RÈGLE 5 - Dispositifs invasifs par orifice corporel
  {
    id: "VIII-R5",
    number: 5,
    title: "Dispositifs invasifs par orifice corporel (transitoire)",
    description: "Dispositifs invasifs par un orifice corporel, à usage transitoire",
    resultingClass: "I",
    conditions: [
      { field: "invasiveness", operator: "equals", value: "invasif_orifice" },
      { field: "duration", operator: "equals", value: "transitoire" },
      { field: "contact_site", operator: "not_equals", value: "muqueuse" }
    ],
    rationale: "Dispositif invasif par orifice, usage transitoire - Classe I"
  },

  {
    id: "VIII-R5b",
    number: 5,
    title: "Dispositifs invasifs par orifice corporel (court terme)",
    description: "Dispositifs invasifs par un orifice corporel, à court terme",
    resultingClass: "IIa",
    conditions: [
      { field: "invasiveness", operator: "equals", value: "invasif_orifice" },
      { field: "duration", operator: "equals", value: "court_terme" }
    ],
    rationale: "Dispositif invasif par orifice, court terme - Classe IIa"
  },

  {
    id: "VIII-R5c",
    number: 5,
    title: "Dispositifs invasifs par orifice corporel (long terme)",
    description: "Dispositifs invasifs par un orifice corporel, à long terme",
    resultingClass: "IIb",
    conditions: [
      { field: "invasiveness", operator: "equals", value: "invasif_orifice" },
      { field: "duration", operator: "equals", value: "long_terme" }
    ],
    rationale: "Dispositif invasif par orifice, long terme - Classe IIb"
  },

  // RÈGLE 6 - Dispositifs chirurgicalement invasifs (usage transitoire)
  {
    id: "VIII-R6",
    number: 6,
    title: "Dispositifs chirurgicalement invasifs transitoires",
    description: "Dispositifs chirurgicalement invasifs destinés à un usage transitoire",
    resultingClass: "IIa",
    conditions: [
      { field: "invasiveness", operator: "equals", value: "chirurgical" },
      { field: "duration", operator: "equals", value: "transitoire" }
    ],
    rationale: "Dispositif chirurgicalement invasif, usage transitoire - Classe IIa"
  },

  {
    id: "VIII-R6b",
    number: 6,
    title: "Dispositifs chirurgicalement invasifs transitoires (énergie/substances dangereuses)",
    description: "Dispositifs administrant de l'énergie ou des substances de manière potentiellement dangereuse",
    resultingClass: "IIb",
    conditions: [
      { field: "invasiveness", operator: "equals", value: "chirurgical" },
      { field: "duration", operator: "equals", value: "transitoire" },
      { field: "function", operator: "includes", value: "energie_dangereuse" }
    ],
    rationale: "Dispositif chirurgical transitoire administrant énergie/substances dangereuses - Classe IIb"
  },

  // RÈGLE 7 - Dispositifs chirurgicalement invasifs (court/long terme)
  {
    id: "VIII-R7",
    number: 7,
    title: "Dispositifs chirurgicalement invasifs court terme",
    description: "Dispositifs chirurgicalement invasifs destinés à un usage à court terme",
    resultingClass: "IIa",
    conditions: [
      { field: "invasiveness", operator: "equals", value: "chirurgical" },
      { field: "duration", operator: "equals", value: "court_terme" }
    ],
    rationale: "Dispositif chirurgicalement invasif, court terme - Classe IIa"
  },

  {
    id: "VIII-R7b",
    number: 7,
    title: "Dispositifs chirurgicalement invasifs long terme",
    description: "Dispositifs chirurgicalement invasifs destinés à un usage à long terme",
    resultingClass: "IIb",
    conditions: [
      { field: "invasiveness", operator: "equals", value: "chirurgical" },
      { field: "duration", operator: "equals", value: "long_terme" }
    ],
    rationale: "Dispositif chirurgicalement invasif, long terme - Classe IIb"
  },

  // RÈGLE 8 - Dispositifs implantables
  {
    id: "VIII-R8",
    number: 8,
    title: "Dispositifs implantables",
    description: "Tous les dispositifs implantables et les dispositifs invasifs à long terme sont de classe IIb",
    resultingClass: "IIb",
    conditions: [
      { field: "implantable", operator: "equals", value: true }
    ],
    rationale: "Dispositif implantable - Classe IIb par défaut"
  },

  {
    id: "VIII-R8b",
    number: 8,
    title: "Dispositifs implantables (contact système circulatoire/nerveux central)",
    description: "Dispositifs implantables en contact avec le cœur, système circulatoire central ou système nerveux central",
    resultingClass: "III",
    conditions: [
      { field: "implantable", operator: "equals", value: true },
      { field: "contact_site", operator: "includes", value: "systeme_circulatoire_central" }
    ],
    rationale: "Dispositif implantable en contact avec système circulatoire/nerveux central - Classe III"
  },

  // RÈGLE 9 - Dispositifs actifs thérapeutiques
  {
    id: "VIII-R9",
    number: 9,
    title: "Dispositifs actifs thérapeutiques administrant énergie",
    description: "Dispositifs actifs thérapeutiques destinés à administrer ou échanger de l'énergie",
    resultingClass: "IIa",
    conditions: [
      { field: "active", operator: "equals", value: true },
      { field: "function", operator: "includes", value: "administrer_energie" }
    ],
    rationale: "Dispositif actif thérapeutique administrant énergie - Classe IIa"
  },

  {
    id: "VIII-R9b",
    number: 9,
    title: "Dispositifs actifs thérapeutiques (énergie potentiellement dangereuse)",
    description: "Dispositifs administrant de l'énergie de manière potentiellement dangereuse",
    resultingClass: "IIb",
    conditions: [
      { field: "active", operator: "equals", value: true },
      { field: "function", operator: "includes", value: "energie_dangereuse" }
    ],
    rationale: "Dispositif actif administrant énergie potentiellement dangereuse - Classe IIb"
  },

  // RÈGLE 10 - Dispositifs actifs de diagnostic/monitoring
  {
    id: "VIII-R10",
    number: 10,
    title: "Dispositifs actifs de diagnostic/monitoring",
    description: "Dispositifs actifs destinés au diagnostic et au monitoring de fonctions vitales",
    resultingClass: "IIa",
    conditions: [
      { field: "active", operator: "equals", value: true },
      { field: "function", operator: "includes", value: "diagnostic_monitoring" }
    ],
    rationale: "Dispositif actif de diagnostic/monitoring - Classe IIa"
  },

  {
    id: "VIII-R10b",
    number: 10,
    title: "Dispositifs actifs monitoring fonctions vitales",
    description: "Dispositifs destinés au monitoring de paramètres vitaux dont les variations peuvent présenter un danger immédiat",
    resultingClass: "IIb",
    conditions: [
      { field: "active", operator: "equals", value: true },
      { field: "function", operator: "includes", value: "monitoring_vital" }
    ],
    rationale: "Dispositif actif monitoring fonctions vitales critiques - Classe IIb"
  },

  // RÈGLE 11 - Dispositifs administrant médicaments/liquides
  {
    id: "VIII-R11",
    number: 11,
    title: "Dispositifs administrant médicaments/liquides",
    description: "Dispositifs destinés à administrer des médicaments, liquides corporels ou autres substances",
    resultingClass: "IIa",
    conditions: [
      { field: "function", operator: "includes", value: "administrer_medicament" }
    ],
    rationale: "Dispositif administrant médicaments/liquides - Classe IIa"
  },

  {
    id: "VIII-R11b",
    number: 11,
    title: "Dispositifs administrant substances potentiellement dangereuses",
    description: "Dispositifs administrant des substances de manière potentiellement dangereuse",
    resultingClass: "IIb",
    conditions: [
      { field: "function", operator: "includes", value: "administrer_medicament" },
      { field: "danger_level", operator: "equals", value: "potentiellement_dangereux" }
    ],
    rationale: "Dispositif administrant substances potentiellement dangereuses - Classe IIb"
  },

  // RÈGLE 12 - Dispositifs incorporant substance médicamenteuse
  {
    id: "VIII-R12",
    number: 12,
    title: "Dispositifs incorporant substance médicamenteuse",
    description: "Dispositifs incorporant une substance médicamenteuse comme partie intégrante",
    resultingClass: "III",
    conditions: [
      { field: "incorporates_drug", operator: "equals", value: true }
    ],
    rationale: "Dispositif incorporant substance médicamenteuse - Classe III"
  },

  // RÈGLE 13 - Dispositifs incorporant dérivé sang/plasma humain
  {
    id: "VIII-R13",
    number: 13,
    title: "Dispositifs incorporant dérivé sang/plasma humain",
    description: "Dispositifs incorporant un dérivé de sang ou de plasma humain",
    resultingClass: "III",
    conditions: [
      { field: "incorporates_blood_derivative", operator: "equals", value: true }
    ],
    rationale: "Dispositif incorporant dérivé de sang/plasma humain - Classe III"
  },

  // RÈGLE 14 - Dispositifs contraceptifs/prévention IST
  {
    id: "VIII-R14",
    number: 14,
    title: "Dispositifs contraceptifs implantables/long terme",
    description: "Dispositifs contraceptifs implantables ou invasifs à long terme",
    resultingClass: "III",
    conditions: [
      { field: "function", operator: "includes", value: "contraception" },
      { field: "implantable", operator: "equals", value: true }
    ],
    rationale: "Dispositif contraceptif implantable/long terme - Classe III"
  },

  {
    id: "VIII-R14b",
    number: 14,
    title: "Dispositifs contraceptifs autres",
    description: "Autres dispositifs contraceptifs",
    resultingClass: "IIb",
    conditions: [
      { field: "function", operator: "includes", value: "contraception" },
      { field: "implantable", operator: "equals", value: false }
    ],
    rationale: "Dispositif contraceptif non implantable - Classe IIb"
  },

  // RÈGLE 15 - Dispositifs de nettoyage/désinfection/stérilisation
  {
    id: "VIII-R15",
    number: 15,
    title: "Dispositifs de nettoyage/désinfection/stérilisation",
    description: "Dispositifs destinés au nettoyage, désinfection ou stérilisation d'autres dispositifs médicaux",
    resultingClass: "IIa",
    conditions: [
      { field: "function", operator: "includes", value: "sterilisation_dm" }
    ],
    rationale: "Dispositif de nettoyage/désinfection/stérilisation - Classe IIa"
  },

  {
    id: "VIII-R15b",
    number: 15,
    title: "Dispositifs de désinfection/stérilisation (dispositifs invasifs)",
    description: "Dispositifs destinés à désinfecter ou stériliser des dispositifs invasifs",
    resultingClass: "IIb",
    conditions: [
      { field: "function", operator: "includes", value: "sterilisation_dm" },
      { field: "target_device", operator: "equals", value: "invasif" }
    ],
    rationale: "Dispositif désinfectant/stérilisant dispositifs invasifs - Classe IIb"
  },

  // RÈGLE 16 - Dispositifs de diagnostic in vitro
  {
    id: "VIII-R16",
    number: 16,
    title: "Dispositifs enregistrant images diagnostiques (radiations ionisantes)",
    description: "Dispositifs destinés à enregistrer des images diagnostiques par radiations ionisantes",
    resultingClass: "IIb",
    conditions: [
      { field: "function", operator: "includes", value: "radiations_ionisantes" }
    ],
    rationale: "Dispositif émettant radiations ionisantes pour diagnostic - Classe IIb"
  },

  // RÈGLE 17 - Dispositifs incorporant nanomatériaux
  {
    id: "VIII-R17",
    number: 17,
    title: "Dispositifs incorporant nanomatériaux",
    description: "Dispositifs fabriqués à partir de nanomatériaux ou en incorporant",
    resultingClass: "III",
    conditions: [
      { field: "contains_nanomaterials", operator: "equals", value: true },
      { field: "high_internal_exposure", operator: "equals", value: true }
    ],
    rationale: "Dispositif incorporant nanomatériaux avec exposition interne élevée - Classe III"
  },

  // RÈGLE 18 - Dispositifs invasifs chirurgicalement (instruments réutilisables)
  {
    id: "VIII-R18",
    number: 18,
    title: "Instruments chirurgicaux réutilisables",
    description: "Instruments chirurgicaux réutilisables",
    resultingClass: "I",
    conditions: [
      { field: "reusable_surgical", operator: "equals", value: true }
    ],
    rationale: "Instrument chirurgical réutilisable - Classe I"
  },

  // RÈGLE 19 - Dispositifs incorporant tissus/cellules d'origine animale
  {
    id: "VIII-R19",
    number: 19,
    title: "Dispositifs incorporant tissus/cellules d'origine animale",
    description: "Dispositifs incorporant des tissus ou cellules d'origine animale rendus non viables",
    resultingClass: "III",
    conditions: [
      { field: "contains_animal_tissue", operator: "equals", value: true }
    ],
    rationale: "Dispositif incorporant tissus/cellules d'origine animale - Classe III"
  },

  // RÈGLE 20 - Dispositifs actifs thérapeutiques avec effet biologique
  {
    id: "VIII-R20",
    number: 20,
    title: "Dispositifs actifs thérapeutiques avec effet biologique",
    description: "Dispositifs actifs destinés à avoir un effet biologique ou à être absorbés",
    resultingClass: "III",
    conditions: [
      { field: "active", operator: "equals", value: true },
      { field: "biological_effect", operator: "equals", value: true }
    ],
    rationale: "Dispositif actif avec effet biologique/absorbé - Classe III"
  },

  // RÈGLE 21 - Dispositifs incorporant substance absorbable/résorbable
  {
    id: "VIII-R21",
    number: 21,
    title: "Dispositifs incorporant substance absorbable/résorbable",
    description: "Dispositifs incorporant une substance qui, si elle était utilisée séparément, serait considérée comme un médicament et qui est susceptible d'agir sur le corps humain par une action accessoire à celle du dispositif",
    resultingClass: "III",
    conditions: [
      { field: "contains_absorbable_substance", operator: "equals", value: true }
    ],
    rationale: "Dispositif incorporant substance absorbable/résorbable - Classe III"
  },

  // RÈGLE 22 - Logiciels
  {
    id: "VIII-R22",
    number: 22,
    title: "Logiciels (information diagnostique/thérapeutique)",
    description: "Logiciels destinés à fournir des informations utilisées pour prendre des décisions à des fins diagnostiques ou thérapeutiques",
    resultingClass: "IIa",
    conditions: [
      { field: "is_software", operator: "equals", value: true },
      { field: "software_purpose", operator: "includes", value: "decision_support" }
    ],
    rationale: "Logiciel fournissant informations pour décisions diagnostiques/thérapeutiques - Classe IIa"
  },

  {
    id: "VIII-R22b",
    number: 22,
    title: "Logiciels (décisions critiques)",
    description: "Logiciels destinés à fournir des informations pour des décisions ayant un impact sur le diagnostic, le monitoring ou le traitement de patients",
    resultingClass: "IIb",
    conditions: [
      { field: "is_software", operator: "equals", value: true },
      { field: "software_purpose", operator: "includes", value: "critical_decision" }
    ],
    rationale: "Logiciel pour décisions critiques (diagnostic/traitement) - Classe IIb"
  },

  {
    id: "VIII-R22c",
    number: 22,
    title: "Logiciels (décisions causant décès/détérioration grave)",
    description: "Logiciels destinés à fournir des informations pour des décisions pouvant causer le décès ou une détérioration grave de l'état de santé",
    resultingClass: "III",
    conditions: [
      { field: "is_software", operator: "equals", value: true },
      { field: "software_purpose", operator: "includes", value: "life_threatening" }
    ],
    rationale: "Logiciel pour décisions pouvant causer décès/détérioration grave - Classe III"
  }
];

/**
 * Règles spéciales pour les dispositifs stériles
 */
export const STERILE_RULES = {
  "Is": "Dispositif fourni stérile",
  "Im": "Dispositif avec fonction de mesure",
  "Ir": "Instrument chirurgical réutilisable"
};
