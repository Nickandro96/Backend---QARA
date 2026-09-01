import assert from "node:assert/strict";
import test from "node:test";
import { CAPA_SYSTEM_PROMPT, CapaAIResultSchema, buildCapaPrompt, generateCapaAnalysis, serializeSelectedActions } from "./capaAI";

const valid = {
  contexteSituation: "La gestion des risques n'est pas démontrée par les preuves fournies dans l'audit.",
  nonConformiteIdentifiee: "Absence de preuve documentée démontrant l'application du processus de gestion des risques selon ISO 14971.",
  analyse5Pourquoi: {
    pourquoi1:{question:"Pourquoi la preuve est-elle absente ?",reponse:"Le dossier présenté ne contient pas cette preuve."},
    pourquoi2:{question:"Pourquoi le dossier ne la contient-il pas ?",reponse:"L'organisation documentaire doit être vérifiée."},
    pourquoi3:{question:"Pourquoi doit-elle être vérifiée ?",reponse:"Les données d'audit ne précisent pas le mécanisme de classement."},
    pourquoi4:{question:"Pourquoi le mécanisme est-il inconnu ?",reponse:"Aucune information complémentaire n'a été fournie."},
    pourquoi5:{question:"Pourquoi aucune information n'est-elle fournie ?",reponse:"À confirmer avec le pilote du processus."},
    causeRacineIdentifiee:"Cause racine non démontrée ; investigation requise."
  },
  correctionImmediate:"Rassembler les preuves existantes et ouvrir une investigation documentée sous 30 jours.",
  actionsCorrectivesProposees:[1,2,3].map((n)=>({id:String(n),titre:`Action ${n}`,description:"Vérifier et documenter le processus avec les responsables concernés.",exigenceReglementaire:"ISO 14971 §4.4",delaiSuggeree:"30 jours",indicateurEfficacite:"Dossier vérifié et approuvé",complexite:"faible",priorite:"immediate"})),
  pointsVigilance:["Ne pas conclure sans preuve objective.","Maintenir la traçabilité des décisions."],
  referenceReglementaire:"ISO 14971 §4.4",niveauConfiance:"faible",raisonNiveauConfiance:"Les preuves et le constat sont insuffisants."
};

test("CAPA prompt contains mandatory anti-hallucination safeguards",()=>{
  assert.match(CAPA_SYSTEM_PROMPT,/n'inventes/); assert.match(CAPA_SYSTEM_PROMPT,/UNIQUEMENT les données fournies/);
  assert.match(buildCapaPrompt({questionText:"Gestion des risques ?",questionKey:"RISK-1",criticality:"high",processSlug:"risques",referentialCode:"ISO14971",articleReference:"§4.4",responseValue:"non_conforme",responseComment:"Aucune preuve présentée",objectiveEvidence:null},{organisationName:"Medtech",economicRole:"fabricant",referentialCode:"ISO14971",processName:"Gestion des risques"}),/Aucune preuve présentée/);
});
test("prompt without auditor comment forces regulatory-only analysis and low confidence",()=>{
  const prompt=buildCapaPrompt({questionText:"Le fabricant maîtrise-t-il son SMQ ?",questionKey:"MDR-1",criticality:"high",processSlug:"smq",referentialCode:"MDR",articleReference:"MDR Art. 10(9)",responseValue:"non_conforme",responseComment:"   ",objectiveEvidence:null},{organisationName:"Medtech",economicRole:"fabricant",referentialCode:"MDR",processName:"SMQ"});
  assert.match(prompt,/Aucun commentaire d'auditeur disponible/);
  assert.match(prompt,/uniquement sur l'exigence réglementaire/);
  assert.match(prompt,/niveauConfiance à 'faible'/);
});
test("CapaAIResult schema validates a grounded ISO 14971 result",()=>assert.equal(CapaAIResultSchema.safeParse(valid).success,true));
test("invalid AI response is never returned",async()=>{
  const client:any={messages:{create:async()=>({content:[{type:"text",text:'{"invented":true}'}]})}};
  const result=await generateCapaAnalysis({questionText:"Q",questionKey:"K",criticality:"high",processSlug:null,referentialCode:"MDR",articleReference:"Art. 10(9)",responseValue:"partiel",responseComment:null,objectiveEvidence:null},{organisationName:null,economicRole:null,referentialCode:"MDR",processName:null},client);
  assert.equal(result,null);
});
test("seules les actions sélectionnées sont préparées pour la sauvegarde",()=>{
  const saved=serializeSelectedActions([valid.actionsCorrectivesProposees[0],valid.actionsCorrectivesProposees[2]] as any);
  assert.deepEqual(saved.selectedActionIds,["1","3"]);
  assert.match(saved.actionRetenue,/Action 1/);
  assert.doesNotMatch(saved.actionRetenue,/Action 2/);
  assert.match(saved.actionRetenue,/Action 3/);
});
