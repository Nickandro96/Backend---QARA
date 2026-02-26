import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";

/**
 * MDR Device Classification helper (EU MDR 2017/745 – Annex VIII rules)
 *
 * ⚠️ Assistive tool only. Final classification must be validated by RA/PRRC.
 * Outputs:
 * - resultingClass (incl. Is/Im/Ir if class I)
 * - appliedRules (human-readable + audit-ready references)
 * - justification (structured narrative for DT / audit trail)
 * - meta: confidence, decisionPath, assumptions, missingData, nextSteps
 *
 * This router is designed to be compatible with your existing frontend:
 * it still returns { resultingClass, appliedRules, justification }.
 *
 * Your current version was simplified and produced generic justification. 
 */

const AnswersSchema = z.object({
  // General
  device_name: z.string().optional(),
  device_description: z.string().optional(),
  device_type: z.enum(["dm", "accessoire"]).optional(),
  is_active: z.boolean().optional(),
  is_software: z.boolean().optional(),

  // Invasiveness
  invasiveness: z.enum(["non-invasif", "invasif_orifice", "chirurgical"]).optional(),
  implantable: z.boolean().optional(),
  contact_nervous_system: z.boolean().optional(),
  contact_circulatory_system: z.boolean().optional(),

  // Duration
  duration: z.enum(["transitoire", "court_terme", "long_terme"]).optional(),

  // Anatomical site
  contact_site: z.array(z.string()).optional(),
  wound_depth: z.enum(["superficielle", "profonde"]).optional(),

  // Function / energy
  function: z.array(z.string()).optional(),
  danger_level: z.enum(["potentiellement_dangereux", "normal"]).optional(),

  // Sterility / measuring
  provided_sterile: z.boolean().optional(),
  has_measuring_function: z.boolean().optional(),
  reusable_surgical: z.boolean().optional(),

  // Special cases
  incorporates_drug: z.boolean().optional(),
  incorporates_blood_derivative: z.boolean().optional(),
  contains_absorbable_substance: z.boolean().optional(),
  contains_nanomaterials: z.boolean().optional(),
  high_internal_exposure: z.boolean().optional(),
  contains_animal_tissue: z.boolean().optional(),
  biological_effect: z.boolean().optional(),

  // Software
  software_purpose: z.array(z.string()).optional(),
});

type MdrClass = "I" | "IIa" | "IIb" | "III";

type RuleRef = {
  annex: "MDR Annex VIII";
  ruleNumber: string; // "1".."22" etc.
  title: string;
  rationale: string; // why applied
  references: string[]; // textual references for audit report
};

function maxClass(a: MdrClass, b: MdrClass): MdrClass {
  const order: MdrClass[] = ["I", "IIa", "IIb", "III"];
  return order.indexOf(b) > order.indexOf(a) ? b : a;
}

function classRank(c: MdrClass): number {
  const order: MdrClass[] = ["I", "IIa", "IIb", "III"];
  return order.indexOf(c);
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function boolLabel(v: boolean | undefined) {
  if (v === true) return "Oui";
  if (v === false) return "Non";
  return "Non renseigné";
}

function durationLabel(d: z.infer<typeof AnswersSchema>["duration"]) {
  if (!d) return "Non renseignée";
  if (d === "transitoire") return "Transitoire (< 60 min)";
  if (d === "court_terme") return "Court terme (≤ 30 jours)";
  return "Long terme (> 30 jours)";
}

function invasivenessLabel(i: z.infer<typeof AnswersSchema>["invasiveness"]) {
  if (!i) return "Non renseigné";
  if (i === "non-invasif") return "Non invasif";
  if (i === "invasif_orifice") return "Invasif via orifice corporel";
  return "Invasif chirurgical";
}

function formatRuleLine(r: RuleRef) {
  // Human readable and audit-ready
  return `MDR 2017/745 — Annexe VIII — Règle ${r.ruleNumber} (${r.title}) : ${r.rationale}`;
}

function buildRule(
  ruleNumber: string,
  title: string,
  rationale: string,
  extraRefs?: string[],
): RuleRef {
  return {
    annex: "MDR Annex VIII",
    ruleNumber,
    title,
    rationale,
    references: uniq([
      "Règlement (UE) 2017/745 (MDR) — Article 51 (Classification)",
      "Règlement (UE) 2017/745 (MDR) — Annexe VIII (Règles de classification)",
      "Règlement (UE) 2017/745 (MDR) — Article 52 (Procédure d’évaluation de conformité selon classe)",
      `MDR — Annexe VIII — Règle ${ruleNumber}`,
      ...(extraRefs ?? []),
    ]),
  };
}

function classifyAnswers(answers: z.infer<typeof AnswersSchema>) {
  // Output containers
  const rules: RuleRef[] = [];
  const decisionPath: string[] = [];
  const assumptions: string[] = [];
  const missingData: string[] = [];
  const nextSteps: string[] = [];
  const notes: string[] = [];

  // Basic required fields for a confident classification
  if (!answers.invasiveness) missingData.push("Caractère invasif (non-invasif / orifice / chirurgical)");
  if (!answers.duration) missingData.push("Durée de contact (transitoire / court terme / long terme)");
  if (answers.is_software && !answers.danger_level)
    missingData.push("Impact du logiciel (danger_level / impact clinique)");

  // Default class
  let resultingClass: MdrClass = "I";

  // ---------- Decision framing (audit trail) ----------
  decisionPath.push(`Type: ${answers.device_type ?? "Non renseigné"} | Actif: ${boolLabel(answers.is_active)} | Logiciel: ${boolLabel(answers.is_software)}`);
  decisionPath.push(`Invasivité: ${invasivenessLabel(answers.invasiveness)} | Durée: ${durationLabel(answers.duration)}`);
  decisionPath.push(`Implantable: ${boolLabel(answers.implantable)} | Contact SNC: ${boolLabel(answers.contact_nervous_system)} | Contact circulatoire central: ${boolLabel(answers.contact_circulatory_system)}`);

  // ---------- High risk special cases (simplified but audit structured) ----------
  const specialHigh =
    answers.incorporates_drug ||
    answers.incorporates_blood_derivative ||
    answers.contains_animal_tissue ||
    (answers.contains_nanomaterials && answers.high_internal_exposure) ||
    answers.biological_effect;

  if (specialHigh) {
    resultingClass = "III";
    rules.push(
      buildRule(
        "21/22",
        "Dispositifs intégrant substances / matériaux spécifiques (cas spéciaux)",
        "Le dispositif déclare l’intégration de substance/matériau à risque (médicament, dérivés sanguins, tissus animaux, nanomatériaux avec exposition interne ou effet biologique) → classification élevée (souvent III) à confirmer au cas par cas.",
        ["MDR — Annexe VIII — Règles 21/22 (cas spéciaux selon substances/matériaux)"],
      ),
    );
    notes.push(
      "Cas spécial : substance/matériau à risque déclaré (médicament / dérivé sanguin / tissu animal / nanomatériau avec exposition interne / effet biologique).",
    );
  }

  // ---------- Implantable / CNS / circulatory central (Rule 8 orientation) ----------
  if (answers.implantable) {
    resultingClass = maxClass(resultingClass, "IIb");
    rules.push(
      buildRule(
        "8",
        "Dispositifs implantables et invasifs de longue durée (principes)",
        "Dispositif déclaré implantable → Règle 8 : au minimum IIb (puis rehaussement si SNC / circulatoire central).",
      ),
    );
    notes.push("Dispositif déclaré implantable.");
  }

  if (answers.contact_nervous_system) {
    resultingClass = maxClass(resultingClass, "III");
    rules.push(
      buildRule(
        "8",
        "Contact avec le système nerveux central",
        "Contact avec le système nerveux central → Règle 8 : tendance Classe III (selon cas).",
      ),
    );
    notes.push("Contact avec le système nerveux central déclaré.");
  }

  if (answers.contact_circulatory_system) {
    resultingClass = maxClass(resultingClass, "IIb");
    rules.push(
      buildRule(
        "8",
        "Contact avec le système circulatoire central",
        "Contact avec le système circulatoire central → Règle 8 : IIb / III selon cas (ex. contact direct structures centrales).",
      ),
    );
    notes.push("Contact avec le système circulatoire central déclaré.");
  }

  // ---------- Software (Rule 11) ----------
  if (answers.is_software) {
    if (answers.danger_level === "potentiellement_dangereux") {
      resultingClass = maxClass(resultingClass, "IIb");
      rules.push(
        buildRule(
          "11",
          "Logiciels",
          "Le dispositif est un logiciel influençant des décisions pouvant causer un préjudice grave (danger_level=potentiellement_dangereux) → Règle 11 : IIb (à confirmer selon l’impact réel).",
        ),
      );
      notes.push("Logiciel : impact clinique significatif déclaré (potentiellement dangereux).");
    } else if (answers.danger_level === "normal") {
      resultingClass = maxClass(resultingClass, "IIa");
      rules.push(
        buildRule(
          "11",
          "Logiciels",
          "Le dispositif est un logiciel influençant une décision clinique sans impact critique déclaré (danger_level=normal) → Règle 11 : IIa (à confirmer selon l’usage prévu).",
        ),
      );
      notes.push("Logiciel : impact clinique non critique déclaré (à confirmer).");
    } else {
      // missing danger_level already collected in missingData
      assumptions.push(
        "Logiciel déclaré mais impact clinique non renseigné : la règle 11 nécessite une évaluation de l’impact (préjudice possible, gravité, rôle dans la décision).",
      );
    }
  }

  // ---------- Invasiveness / duration (Rules 1, 4, 5, 6, 7, 8 simplified orientation) ----------
  if (answers.invasiveness === "chirurgical") {
    if (answers.duration === "long_terme") {
      resultingClass = maxClass(resultingClass, "IIb");
      rules.push(
        buildRule(
          "8",
          "Dispositifs invasifs chirurgicaux de longue durée",
          "Dispositif invasif chirurgical avec durée long terme (>30 jours) → orientation Règle 8 : IIb (voire III si SNC/circulatoire central).",
        ),
      );
      notes.push("Invasif chirurgical long terme.");
    } else if (answers.duration === "court_terme") {
      resultingClass = maxClass(resultingClass, "IIa");
      rules.push(
        buildRule(
          "6/7",
          "Dispositifs invasifs chirurgicaux (transitoire/court terme)",
          "Dispositif invasif chirurgical court terme (≤30 jours) → orientation Règles 6/7 : IIa (rehaussement possible selon site/énergie/usage).",
        ),
      );
      notes.push("Invasif chirurgical court terme.");
    } else if (answers.duration === "transitoire") {
      resultingClass = maxClass(resultingClass, "IIa");
      rules.push(
        buildRule(
          "6",
          "Dispositifs invasifs chirurgicaux transitoires",
          "Dispositif invasif chirurgical transitoire (<60 min) → orientation Règle 6 : IIa (selon cas).",
        ),
      );
      notes.push("Invasif chirurgical transitoire.");
    } else {
      assumptions.push("Invasif chirurgical déclaré mais durée non renseignée : impossible de discriminer règles 6/7/8 correctement.");
    }
  } else if (answers.invasiveness === "invasif_orifice") {
    if (answers.duration === "long_terme") {
      resultingClass = maxClass(resultingClass, "IIa");
      rules.push(
        buildRule(
          "5",
          "Dispositifs invasifs via orifice corporel",
          "Dispositif invasif via orifice corporel long terme (>30 jours) → orientation Règle 5 : IIa (rehaussement selon site critique/risque).",
        ),
      );
      notes.push("Invasif via orifice long terme.");
    } else if (answers.duration === "court_terme" || answers.duration === "transitoire") {
      resultingClass = maxClass(resultingClass, "I");
      rules.push(
        buildRule(
          "5",
          "Dispositifs invasifs via orifice corporel",
          "Dispositif invasif via orifice corporel transitoire/court terme → orientation Règle 5 : I ou IIa selon cas (ex. absorption, risque, site).",
        ),
      );
      notes.push("Invasif via orifice transitoire/court terme.");
    } else {
      assumptions.push("Invasif via orifice déclaré mais durée non renseignée : impossible d’appliquer la règle 5 correctement.");
    }
  } else if (answers.invasiveness === "non-invasif") {
    const contactPeau = answers.contact_site?.some((s) => s.toLowerCase().includes("peau")) ?? false;

    if (contactPeau || answers.wound_depth) {
      if (answers.wound_depth === "profonde") {
        resultingClass = maxClass(resultingClass, "IIa");
        rules.push(
          buildRule(
            "4",
            "Dispositifs en contact avec peau lésée",
            "Contact avec peau lésée profonde → orientation Règle 4 : IIa (voire IIb selon cas).",
          ),
        );
        notes.push("Non invasif mais contact peau lésée profonde.");
      } else if (answers.wound_depth === "superficielle") {
        resultingClass = maxClass(resultingClass, "I");
        rules.push(
          buildRule(
            "4",
            "Dispositifs en contact avec peau lésée",
            "Contact avec peau lésée superficielle → orientation Règle 4 : Classe I (selon cas).",
          ),
        );
        notes.push("Non invasif mais contact peau lésée superficielle.");
      } else {
        assumptions.push("Contact peau lésée suspecté mais profondeur non renseignée : règle 4 nécessite superficialité/profondeur.");
      }
    } else {
      // default non-invasive
      rules.push(
        buildRule(
          "1",
          "Dispositifs non invasifs",
          "Dispositif non invasif, sans caractéristiques particulières déclarées → Règle 1 : Classe I (sous réserve d’autres règles spécifiques).",
        ),
      );
      notes.push("Non invasif : classification par défaut Règle 1.");
    }
  }

  // ---------- Sterile / measuring / reusable surgical (class I sub-classes) ----------
  // Only annotate if base class is I
  const modifiers: string[] = [];
  if (answers.provided_sterile) modifiers.push("Is (stérile)");
  if (answers.has_measuring_function) modifiers.push("Im (fonction de mesure)");
  if (answers.reusable_surgical) modifiers.push("Ir (réutilisable – chirurgical)");

  if (resultingClass === "I" && modifiers.length) {
    notes.push(`Spécificité Classe I: ${modifiers.join(", ")} (impact sur sous-catégorie de classe I).`);
  }

  const classModifier = resultingClass === "I" && modifiers.length ? ` (${modifiers.join(", ")})` : "";
  const resultingClassLabel = `${resultingClass}${classModifier}`;

  // ---------- Confidence scoring (simple but useful) ----------
  // Start at 0.85, penalize missing critical fields and "assumptions"
  let confidence = 0.85;
  confidence -= missingData.length * 0.12;
  confidence -= assumptions.length * 0.08;
  // clamp
  confidence = Math.max(0.2, Math.min(0.95, confidence));

  // ---------- Next steps (audit/DT-ready) ----------
  nextSteps.push("Valider la classification via revue RA/PRRC (signature et traçabilité).");
  nextSteps.push("Documenter la justification dans le dossier technique (Annexe II/III) – section 'Classification rationale'.");
  nextSteps.push("Vérifier les règles Annex VIII alternatives pertinentes (cas d’usage spécifiques, site critique, énergie, substances).");
  nextSteps.push("Déduire la voie d’évaluation de conformité (MDR Article 52) en fonction de la classe retenue.");

  // ---------- Build structured justification narrative (audit-ready) ----------
  const uniqueRules = uniq(
    rules
      .sort((a, b) => {
        // try to keep numeric order when possible
        const an = parseInt(a.ruleNumber.split("/")[0], 10);
        const bn = parseInt(b.ruleNumber.split("/")[0], 10);
        if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
        return a.ruleNumber.localeCompare(b.ruleNumber);
      })
      .map((r) => formatRuleLine(r)),
  );

  const refs = uniq(rules.flatMap((r) => r.references));

  const headerLines: string[] = [];
  headerLines.push("JUSTIFICATION DE CLASSIFICATION — MDR (UE) 2017/745");
  headerLines.push(`Dispositif : ${answers.device_name ?? "Non renseigné"}`);
  if (answers.device_description) headerLines.push(`Description : ${answers.device_description}`);
  headerLines.push("");
  headerLines.push("1) Référentiel réglementaire");
  headerLines.push("- MDR 2017/745 — Article 51 (Classification)");
  headerLines.push("- MDR 2017/745 — Annexe VIII (Règles de classification)");
  headerLines.push("- MDR 2017/745 — Article 52 (Procédure d’évaluation de conformité selon classe)");
  headerLines.push("");

  const scopeLines: string[] = [];
  scopeLines.push("2) Données d’entrée utilisées (wizard)");
  scopeLines.push(`- Type : ${answers.device_type ?? "Non renseigné"} | Actif : ${boolLabel(answers.is_active)} | Logiciel : ${boolLabel(answers.is_software)}`);
  scopeLines.push(`- Invasivité : ${invasivenessLabel(answers.invasiveness)}`);
  scopeLines.push(`- Durée : ${durationLabel(answers.duration)}`);
  scopeLines.push(`- Implantable : ${boolLabel(answers.implantable)}`);
  scopeLines.push(`- Contact SNC : ${boolLabel(answers.contact_nervous_system)} | Contact circulatoire central : ${boolLabel(answers.contact_circulatory_system)}`);
  scopeLines.push(`- Stérile : ${boolLabel(answers.provided_sterile)} | Mesure : ${boolLabel(answers.has_measuring_function)} | Réutilisable chirurgical : ${boolLabel(answers.reusable_surgical)}`);
  scopeLines.push("");

  const decisionLines: string[] = [];
  decisionLines.push("3) Chemin de décision (Annexe VIII)");
  decisionLines.push(...decisionPath.map((d, idx) => `- Étape ${idx + 1} : ${d}`));
  decisionLines.push("");

  const rulesLines: string[] = [];
  rulesLines.push("4) Règle(s) de classification appliquée(s)");
  if (uniqueRules.length) {
    rulesLines.push(...uniqueRules.map((r) => `- ${r}`));
  } else {
    rulesLines.push("- Aucune règle n’a pu être appliquée (données insuffisantes).");
  }
  rulesLines.push("");

  const conclusionLines: string[] = [];
  conclusionLines.push("5) Conclusion");
  conclusionLines.push(`- Classe MDR proposée : ${resultingClassLabel}`);
  conclusionLines.push(`- Niveau de confiance (outil) : ${(confidence * 100).toFixed(0)}%`);
  conclusionLines.push("");

  const limitsLines: string[] = [];
  limitsLines.push("6) Hypothèses / limites & données manquantes");
  if (missingData.length) limitsLines.push(...missingData.map((m) => `- Donnée manquante : ${m}`));
  if (assumptions.length) limitsLines.push(...assumptions.map((a) => `- Hypothèse : ${a}`));
  if (!missingData.length && !assumptions.length) limitsLines.push("- Aucune (données suffisantes pour une proposition cohérente).");
  limitsLines.push("");

  const actionsLines: string[] = [];
  actionsLines.push("7) Actions requises (audit-ready)");
  actionsLines.push(...nextSteps.map((s) => `- ${s}`));
  actionsLines.push("");

  const refsLines: string[] = [];
  refsLines.push("8) Références (trace)");
  refsLines.push(...refs.map((r) => `- ${r}`));
  refsLines.push("");

  const disclaimerLines: string[] = [];
  disclaimerLines.push("⚠️ Avertissement");
  disclaimerLines.push(
    "Cette proposition est indicative et doit être validée par une revue réglementaire complète (Annexe VIII + guides MDCG applicables) et approuvée par RA/PRRC.",
  );

  const justification = [
    ...headerLines,
    ...scopeLines,
    ...decisionLines,
    ...rulesLines,
    ...conclusionLines,
    ...limitsLines,
    ...actionsLines,
    ...refsLines,
    ...disclaimerLines,
  ].join("\n");

  // Keep backward-compatible string list for your current UI section "Règles appliquées"
  const appliedRules = uniqueRules.length ? uniqueRules : [];

  return {
    // Existing fields (frontend expects these)
    resultingClass: resultingClassLabel,
    appliedRules,
    justification,

    // Extra fields (optional to use in frontend)
    confidence,
    decisionPath,
    assumptions,
    missingData,
    nextSteps,
    notes,
  };
}

export const classificationRouter = router({
  classify: protectedProcedure.input(AnswersSchema).mutation(async ({ input }) => {
    return classifyAnswers(input);
  }),
});
