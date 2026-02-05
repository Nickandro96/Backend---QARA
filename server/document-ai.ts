import { invokeLLM } from "./_core/llm";

export interface DocumentAIResponse {
  explanation: string;
  idealStructure: string;
  template: string;
  coherenceCheck: string;
  recommendations: string[];
}

/**
 * Génère une explication complète d'un document obligatoire
 */
export async function explainDocument(
  documentName: string,
  documentDescription: string,
  referential: string,
  process: string,
  role: string
): Promise<DocumentAIResponse> {
  const prompt = `Tu es un expert en conformité réglementaire des dispositifs médicaux (MDR 2017/745, ISO 13485, ISO 9001).

**Document à analyser :**
- Nom : ${documentName}
- Description : ${documentDescription}
- Référentiel : ${referential}
- Processus : ${process}
- Rôle économique : ${role}

**Mission :**
Fournis une analyse complète et professionnelle de ce document obligatoire en 5 sections :

1. **Explication détaillée** (200-300 mots) :
   - Objectif réglementaire du document
   - Contenu attendu et sections principales
   - Erreurs fréquentes à éviter
   - Importance pour la conformité

2. **Structure idéale** (format liste numérotée) :
   - Sections principales du document
   - Sous-sections recommandées
   - Informations clés à inclure dans chaque section

3. **Modèle personnalisé** (format Markdown) :
   - Template adapté au rôle ${role}
   - Sections pré-remplies avec instructions
   - Exemples concrets pour chaque section

4. **Vérification de cohérence** :
   - Documents connexes à consulter
   - Points de cohérence à vérifier
   - Risques d'incohérence

5. **Recommandations** (3-5 points) :
   - Conseils pratiques pour rédiger le document
   - Bonnes pratiques du secteur
   - Pièges à éviter

Sois précis, professionnel et orienté action. Utilise un ton expert mais accessible.`;

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "Tu es un expert en conformité réglementaire des dispositifs médicaux avec 15 ans d'expérience en audits MDR et ISO 13485."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const messageContent = response.choices[0]?.message?.content;
    const content = typeof messageContent === 'string' ? messageContent : "";

    // Parser la réponse structurée
    const sections = content.split(/\n(?=\d+\.\s+\*\*)/);
    
    return {
      explanation: extractSection(content, "Explication détaillée") || content.substring(0, 500),
      idealStructure: extractSection(content, "Structure idéale") || "Structure à définir",
      template: extractSection(content, "Modèle personnalisé") || "Template à générer",
      coherenceCheck: extractSection(content, "Vérification de cohérence") || "Vérifications à effectuer",
      recommendations: extractRecommendations(content)
    };
  } catch (error) {
    console.error("[Document AI] Error:", error);
    return {
      explanation: "Erreur lors de la génération de l'explication. Veuillez réessayer.",
      idealStructure: "",
      template: "",
      coherenceCheck: "",
      recommendations: []
    };
  }
}

/**
 * Extrait une section spécifique du contenu généré par l'IA
 */
function extractSection(content: string, sectionTitle: string): string {
  const regex = new RegExp(`\\d+\\.\\s+\\*\\*${sectionTitle}\\*\\*[:\\s]*([\\s\\S]*?)(?=\\n\\d+\\.\\s+\\*\\*|$)`, "i");
  const match = content.match(regex);
  return match ? match[1].trim() : "";
}

/**
 * Extrait les recommandations du contenu généré
 */
function extractRecommendations(content: string): string[] {
  const recommendationsSection = extractSection(content, "Recommandations");
  if (!recommendationsSection) return [];

  const lines = recommendationsSection.split("\n");
  return lines
    .filter(line => line.trim().match(/^[-•*]\s+/))
    .map(line => line.trim().replace(/^[-•*]\s+/, ""))
    .filter(line => line.length > 0);
}

/**
 * Vérifie la cohérence d'un document avec d'autres documents
 */
export async function checkDocumentCoherence(
  documentName: string,
  relatedDocuments: string[]
): Promise<string> {
  const prompt = `Tu es un expert en conformité réglementaire des dispositifs médicaux.

**Document principal :** ${documentName}

**Documents connexes :**
${relatedDocuments.map((doc, i) => `${i + 1}. ${doc}`).join("\n")}

**Mission :**
Identifie les points de cohérence critiques à vérifier entre le document principal et les documents connexes.

Pour chaque document connexe, liste :
1. Les informations qui doivent être cohérentes
2. Les risques d'incohérence fréquents
3. Comment vérifier la cohérence

Sois précis et orienté action.`;

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "Tu es un expert en conformité réglementaire des dispositifs médicaux."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const messageContent = response.choices[0]?.message?.content;
    return typeof messageContent === 'string' ? messageContent : "Vérifications de cohérence à définir";
  } catch (error) {
    console.error("[Document AI] Coherence check error:", error);
    return "Erreur lors de la vérification de cohérence.";
  }
}
