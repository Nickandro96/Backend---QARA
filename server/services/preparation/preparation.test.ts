import test from "node:test";
import assert from "node:assert/strict";
import { generatePreparationChecklist } from "./checklistGenerator";
import { PreparationPlanSchema, PREPARATION_WARNING, AuditorQuestionsSchema, SIMULATION_WARNING } from "./preparationAI";

test("la checklist MDR contient UDI, évaluation clinique et gestion des risques",()=>{const labels=generatePreparationChecklist("BSI").map(x=>x.item.toLowerCase()).join(" ");assert.match(labels,/udi/);assert.match(labels,/évaluation clinique/);assert.match(labels,/gestion des risques/);});
test("les checklists FDA et MDSAP sont spécifiques",()=>{assert.ok(generatePreparationChecklist("FDA").some(x=>x.item.includes("Design History File")));assert.equal(generatePreparationChecklist("MDSAP").length,7);});
test("le schéma impose un avertissement au plan",()=>{const base={semainesRestantes:3,niveauRisque:"critique",raisonNiveauRisque:"CAPA ouvertes avant audit",pointsForce:[],pointsVigilance:[],documentsAVerifier:[],simulationQuestionsAuditeur:[],calendrierPreparation:[],niveauConfiance:"moyen"};assert.equal(PreparationPlanSchema.safeParse(base).success,false);assert.equal(PreparationPlanSchema.parse({...base,avertissement:PREPARATION_WARNING}).niveauRisque,"critique");});
test("la simulation impose au moins trois questions et l'avertissement exact",()=>{const q={question:"Pouvez-vous démontrer la maîtrise du risque ?",contexte:"ISO 14971",orientationReponse:"Présenter le dossier de risques",preuvesAttendues:["Rapport de gestion des risques"],criticite:"haute"};assert.equal(AuditorQuestionsSchema.safeParse({questions:[q,q],avertissement:SIMULATION_WARNING}).success,false);assert.equal(AuditorQuestionsSchema.parse({questions:[q,q,q],avertissement:SIMULATION_WARNING}).questions.length,3);});
