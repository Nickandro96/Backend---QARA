import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";

/**
 * MDR Device Classification helper (Annex VIII – simplified rule engine)
 *
 * Goal: provide a reliable backend endpoint for the frontend wizard:
 *   trpc.classification.classify
 *
 * This is NOT a legal opinion. It is an assistive tool that explains the logic and
 * outputs a proposed class + applied rule hints.
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

function maxClass(a: MdrClass, b: MdrClass): MdrClass {
  const order: MdrClass[] = ["I", "IIa", "IIb", "III"];
  return order.indexOf(b) > order.indexOf(a) ? b : a;
}

function classifyAnswers(answers: z.infer<typeof AnswersSchema>) {
  const appliedRules: string[] = [];
  const notes: string[] = [];

  // Default
  let resultingClass: MdrClass = "I";

  // ----- High risk special cases (simplified) -----
  const specialHigh =
    answers.incorporates_drug ||
    answers.incorporates_blood_derivative ||
    answers.contains_animal_tissue ||
    (answers.contains_nanomaterials && answers.high_internal_exposure) ||
    answers.biological_effect;

  if (specialHigh) {
    resultingClass = "III";
    appliedRules.push("Règles spéciales (substances / tissus / nano / effet biologique) → Classe III (à confirmer Annex VIII)");
    notes.push(
      "Présence de substances/matériaux à risque (médicament, dérivés sanguins, tissus animaux, nanomatériaux avec exposition interne, effet biologique)."
    );
  }

  // Implantable / CNS / circulatory
  if (answers.implantable) {
    resultingClass = maxClass(resultingClass, "IIb");
    appliedRules.push("Règle 8 (implantables et dispositifs invasifs de longue durée) → au moins IIb");
    notes.push("Dispositif déclaré implantable.");
  }
  if (answers.contact_nervous_system) {
    resultingClass = maxClass(resultingClass, "III");
    appliedRules.push("Règle 8 (contact système nerveux central) → Classe III");
    notes.push("Contact avec le système nerveux central.");
  }
  if (answers.contact_circulatory_system) {
    resultingClass = maxClass(resultingClass, "IIb");
    appliedRules.push("Règle 8 (contact système circulatoire central) → IIb / III selon cas");
    notes.push("Contact avec le système circulatoire central.");
  }

  // ----- Software (very simplified: based on 'danger_level') -----
  if (answers.is_software) {
    // If software drives/impacts decisions with potentially serious impact
    if (answers.danger_level === "potentiellement_dangereux") {
      resultingClass = maxClass(resultingClass, "IIb");
      appliedRules.push("Règle 11 (logiciels) → IIb (si décisions pouvant causer préjudice grave)");
      notes.push("Logiciel potentiellement dangereux (impact clinique significatif).");
    } else {
      resultingClass = maxClass(resultingClass, "IIa");
      appliedRules.push("Règle 11 (logiciels) → IIa (si influence sur décisions cliniques non critiques)");
      notes.push("Logiciel à impact clinique non critique (à confirmer).");
    }
  }

  // ----- Invasiveness / duration (simplified) -----
  if (answers.invasiveness === "chirurgical") {
    if (answers.duration === "long_terme") {
      resultingClass = maxClass(resultingClass, "IIb");
      appliedRules.push("Règle 8 (chirurgical long terme) → IIb (voire III selon contact CNS/circulatoire)");
      notes.push("Dispositif chirurgical avec durée long terme.");
    } else if (answers.duration === "court_terme") {
      resultingClass = maxClass(resultingClass, "IIa");
      appliedRules.push("Règle 6/7 (chirurgical court terme) → IIa (selon usage)");
      notes.push("Dispositif chirurgical court terme.");
    } else if (answers.duration === "transitoire") {
      resultingClass = maxClass(resultingClass, "IIa");
      appliedRules.push("Règle 6 (chirurgical transitoire) → IIa (selon cas)");
      notes.push("Dispositif chirurgical transitoire.");
    }
  } else if (answers.invasiveness === "invasif_orifice") {
    if (answers.duration === "long_terme") {
      resultingClass = maxClass(resultingClass, "IIa");
      appliedRules.push("Règle 5 (orifices, long terme) → IIa (voire IIb selon cas)");
      notes.push("Dispositif invasif via orifice – long terme.");
    } else {
      resultingClass = maxClass(resultingClass, "I");
      appliedRules.push("Règle 5 (orifices, transitoire/court terme) → I / IIa selon cas");
      notes.push("Dispositif invasif via orifice – transitoire/court terme.");
    }
  } else if (answers.invasiveness === "non-invasif") {
    // Wounds: crude mapping
    if (answers.contact_site?.some((s) => s.toLowerCase().includes("peau")) || answers.wound_depth) {
      if (answers.wound_depth === "profonde") {
        resultingClass = maxClass(resultingClass, "IIa");
        appliedRules.push("Règle 4 (contact peau lésée profonde) → IIa (voire IIb selon cas)");
        notes.push("Contact peau lésée profonde.");
      } else if (answers.wound_depth === "superficielle") {
        resultingClass = maxClass(resultingClass, "I");
        appliedRules.push("Règle 4 (contact peau lésée superficielle) → I");
        notes.push("Contact peau lésée superficielle.");
      }
    } else {
      appliedRules.push("Règle 1 (non invasif) → I (par défaut, sous réserve d’autres caractéristiques)");
      notes.push("Non invasif (par défaut classe I).");
    }
  }

  // ----- Sterile / measuring / reusable surgical (class I sub-classes) -----
  // These do not change the base class if it's IIa/IIb/III, but we annotate.
  const modifiers: string[] = [];
  if (answers.provided_sterile) modifiers.push("Is (stérile)");
  if (answers.has_measuring_function) modifiers.push("Im (fonction de mesure)");
  if (answers.reusable_surgical) modifiers.push("Ir (réutilisable – chirurgical)");

  const classModifier = resultingClass === "I" && modifiers.length ? ` (${modifiers.join(", ")})` : "";
  const resultingClassLabel = `${resultingClass}${classModifier}`;

  const justification =
    [
      `Proposition de classe MDR: ${resultingClassLabel}`,
      "",
      "Justification (outil d'aide, à confirmer Annex VIII):",
      ...appliedRules.map((r) => `- ${r}`),
      "",
      "Éléments pris en compte:",
      ...notes.map((n) => `- ${n}`),
      "",
      "⚠️ Important: cette classification est indicative. Une revue réglementaire complète est nécessaire (Annex VIII + MDCG applicables).",
    ].join("\n");

  return {
    resultingClass: resultingClassLabel,
    appliedRules,
    justification,
  };
}

export const classificationRouter = router({
  classify: protectedProcedure.input(AnswersSchema).mutation(async ({ input }) => {
    return classifyAnswers(input);
  }),
});
