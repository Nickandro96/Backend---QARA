// Backend---QARA-main/server/audit-router.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq, and, inArray, ne, lt } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import PDFDocument from "pdfkit";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb, createAudit, getAudits, getAuditById, deleteAudit } from "./db";
import { audits, sites, referentiels, questions, auditResponses, preparationChecklist, simulationResults, capa_actions, regulatoryUpdates, sectorBriefings } from "../drizzle/schema";
import { computeGenericAuditStats, computeGenericAuditProgressSafe, computeGenericAuditScoreSafe } from "./audit-scoring";
import { safeParseArray, getAuditContextInternal, fetchAuditScopedQuestions } from "./mdr-router";
import { generatePreparationChecklist } from "./services/preparation/checklistGenerator";
import { generatePreparationPlanAI, generateAuditorQuestionsAI, evaluateAuditorAnswerAI, SIMULATION_WARNING } from "./services/preparation/preparationAI";
import {
  assertAuditCanComplete,
  assertAuditCanReopen,
  assertAuditDeletable,
  assertAuditComplete,
  assertAuditMutable,
  assertQuestionBelongsToAudit,
  resolveAuditProcessId,
} from "./audit-lifecycle";

const externalAuditInput=z.object({ organisme:z.enum(["ON","FDA","MDSAP","Autre"]), organismeNom:z.string().min(2).max(255), datePrevue:z.string().date(), typeExterne:z.enum(["certification_initiale","surveillance","renouvellement","inspection_non_annoncee","audit_cause"]), programmeDocumentRef:z.string().max(255).optional() });
async function ownedPreparationAudit(db:any,userId:number,auditId:number){const [audit]=await db.select().from(audits).where(and(eq(audits.id,auditId),eq(audits.userId,userId))).limit(1);if(!audit)throw new TRPCError({code:"NOT_FOUND",message:"Préparation d'audit introuvable"});return audit;}
export function countdown(date:Date){const days=Math.max(0,Math.ceil((date.getTime()-Date.now())/86400000));return {days,weeks:Math.floor(days/7),remainingDays:days%7};}
// @ts-expect-error PDFKit's event callback chunk is a Node Buffer at runtime.
async function pdfBuffer(data:any){const doc=new PDFDocument({margin:48,size:"A4"});const chunks:Buffer[]=[];doc.on("data",c=>chunks.push(c));const done=new Promise<Buffer>(resolve=>doc.on("end",()=>resolve(Buffer.concat(chunks))));doc.fontSize(22).text("Rapport de préparation à l'audit",{align:"center"}).moveDown();doc.fontSize(12).text(`Organisme : ${data.audit.auditOrganismeNom}`).text(`Type : ${data.audit.auditTypeExterne}`).text(`Date prévue : ${new Date(data.audit.auditDatePrevue).toLocaleDateString("fr-FR")}`).text(`Référence : PREP-${data.audit.id}-${new Date().getUTCFullYear()}`).moveDown();doc.fontSize(16).text("Résumé exécutif");doc.fontSize(11).text(`Niveau de risque : ${data.plan?.niveauRisque??"non généré"}`).text(data.plan?.raisonNiveauRisque??"Plan non généré").moveDown();doc.fontSize(16).text("Checklist");for(const x of data.checklist)doc.fontSize(9).text(`[${x.statut}] ${x.category} — ${x.item}${x.note?` — ${x.note}`:""}`);doc.moveDown().fontSize(16).text("CAPA ouvertes");for(const c of data.capas)doc.fontSize(9).text(`${c.questionKey} — ${c.ecartIdentifie} — ${c.statut}`);doc.end();return done;}

const ResponseValueEnum = z.enum([
  "compliant",
  "non_compliant",
  "not_applicable",
  "partial",
  "in_progress",
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
]);

/**
 * Filtre en mémoire par referentialId : AuditSelector.tsx (frontend) passe
 * `referentialId` à `audit.list`, mais db.getAudits() ne filtre que par
 * status/siteId — le paramètre était silencieusement ignoré (zod sans
 * .strict() ne rejette pas les clés inconnues, donc aucune erreur, juste un
 * filtre qui ne filtrait rien). Le champ `referentialIds` est un JSON stocké
 * en chaîne (voir safeParseArray) ; filtrer en JS ici plutôt qu'en SQL,
 * volumes par utilisateur trop faibles pour que ça compte.
 */
function filterByReferentialId(rows: any[], referentialId?: number) {
  if (referentialId === undefined) return rows;
  return rows.filter((a: any) => safeParseArray(a.referentialIds).map(Number).includes(referentialId));
}

/**
 * AuditsList.tsx/AuditHistory.tsx lisent `audit.auditType` (colonne réelle :
 * `type`) et `audit.conformityRate` (n'existe pas dans le schéma `audits` —
 * jamais écrit pour MDR/ISO, voir audit-scoring.ts). Enrichit chaque ligne
 * avec les noms de champs attendus par ces pages, score recalculé à la volée
 * via la même variante "safe" que le dashboard (null si audit sans réponse
 * exploitable, plutôt que de faire échouer toute la liste).
 */
/**
 * AuditsList.tsx lit `audit.siteName`, absent de `getAudits()` (ligne brute
 * `audits`, pas de jointure) — affichait "Non spécifié" pour des audits
 * ayant pourtant un site réel (même famille de bug que BUG 2 sur
 * /audits/:id, trouvée dans le balayage CORRECTIONS.md LOT 5).
 */
async function enrichWithDisplayFields(db: any, userId: number, rows: any[]) {
  const siteIds = Array.from(new Set(rows.map((a: any) => a.siteId).filter(Boolean)));
  const siteRows = siteIds.length > 0
    ? await db.select({ id: sites.id, name: sites.name }).from(sites).where(inArray(sites.id, siteIds))
    : [];
  const siteNameById = new Map(siteRows.map((s: any) => [s.id, s.name]));

  return Promise.all(
    rows.map(async (audit: any) => {
      const score = await computeGenericAuditScoreSafe(db, userId, audit.id);
      const progress = await computeGenericAuditProgressSafe(db, userId, audit.id);
      return {
        ...audit,
        auditType: audit.type,
        conformityRate: score,
        progression: progress?.percentage ?? 0,
        progress,
        siteName: audit.siteId ? siteNameById.get(audit.siteId) ?? null : null,
      };
    })
  );
}

export const auditRouter = router({
  /**
   * Frontend expects: trpc.audit.getRecentAudits({ limit })
   */
  getRecentAudits: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(5) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const rows = await db
        .select({
          id: audits.id,
          name: audits.name,
          auditType: audits.type,
          status: audits.status,
          startDate: audits.startDate,
          endDate: audits.endDate,
          siteName: sites.name,
        })
        .from(audits)
        .leftJoin(sites, eq(audits.siteId, sites.id))
        .where(eq(audits.userId, ctx.user.id))
        .orderBy(desc(audits.createdAt))
        .limit(input.limit);

      return Promise.all(rows.map(async (audit: any) => {
        const progress = await computeGenericAuditProgressSafe(db, ctx.user.id, audit.id);
        return { ...audit, progression: progress?.percentage ?? 0, progress };
      }));
    }),

  /**
   * IMPORTANT: several frontend pages/components call `trpc.audit.create`.
   * Without this procedure, the UI loops with NOT_FOUND 404.
   *
   * This procedure is a thin wrapper over db.createAudit().
   */
  create: protectedProcedure
    .input(
      z.object({
        auditType: z.string().min(1),
        name: z.string().min(2),
        referentialIds: z.array(z.number()).default([]),
        siteId: z.number().int().positive().optional(),
        economicRole: z.string().optional(),
        // z.union: accepte les ids numériques ET les slugs canoniques
        // (ex. "gov_strat") — resolveProcessDbIds (server/shared/processResolution.ts)
        // résout les deux formats à la lecture, comme pour MDR/ISO.
        processIds: z.array(z.union([z.number(), z.string()])).optional(),
        auditorName: z.string().optional(),
        auditorEmail: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        notes: z.string().optional(),
        externalPreparation: externalAuditInput.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const created = await createAudit({
        userId: ctx.user.id,
        name: input.name,
        type: input.auditType,
        siteId: input.siteId ?? null,
        status: "draft",
        economicRole: input.economicRole ?? null,
        processIds: input.processIds ?? null,
        referentialIds: input.referentialIds ?? null,
        auditorName: input.auditorName ?? null,
        auditorEmail: input.auditorEmail ?? null,
        startDate: input.startDate ? new Date(input.startDate) : null,
        auditOrganisme: input.externalPreparation?.organisme ?? null,
        auditOrganismeNom: input.externalPreparation?.organismeNom ?? null,
        auditDatePrevue: input.externalPreparation ? new Date(input.externalPreparation.datePrevue) : null,
        auditTypeExterne: input.externalPreparation?.typeExterne ?? null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        // notes can be stored later; ignored safely for now
      });

      return { auditId: created.id };
    }),

  // @ts-expect-error Drizzle widens the conditional enum value inside the batch map.

  initializePreparation: protectedProcedure.input(z.object({auditId:z.number().int().positive()})).mutation(async({ctx,input})=>{const database=await getDb();if(!database)throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});const audit=await ownedPreparationAudit(database,ctx.user.id,input.auditId);if(!audit.auditOrganisme)throw new TRPCError({code:"BAD_REQUEST",message:"Cet audit n'est pas une préparation externe"});const existing=await database.select({id:preparationChecklist.id}).from(preparationChecklist).where(and(eq(preparationChecklist.auditId,input.auditId),eq(preparationChecklist.userId,ctx.user.id))).limit(1);if(!existing.length){const openCapas=await database.select().from(capa_actions).where(and(eq(capa_actions.userId,ctx.user.id),ne(capa_actions.statut,"cloturee_efficace")));const seeds=generatePreparationChecklist(audit.auditOrganisme);await database.insert(preparationChecklist).values(seeds.map(seed=>{const linked=openCapas.find((c:any)=>`${seed.item} ${seed.category}`.toLowerCase().includes(String(c.processName??"").toLowerCase())&&c.processName);return {...seed,auditId:input.auditId,userId:ctx.user.id,statut:linked?"attention":"non_verifie",linkedCapaId:linked?.id??null};}));}return {success:true};}),

  generatePreparationPlan: protectedProcedure.input(z.object({auditId:z.number().int().positive()})).mutation(async({ctx,input})=>{const database=await getDb();if(!database)throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});const audit=await ownedPreparationAudit(database,ctx.user.id,input.auditId);if(!audit.auditDatePrevue)throw new TRPCError({code:"BAD_REQUEST",message:"Date d'audit requise"});const [capas,alerts,refs]=await Promise.all([database.select().from(capa_actions).where(and(eq(capa_actions.userId,ctx.user.id),ne(capa_actions.statut,"cloturee_efficace"))),database.select().from(regulatoryUpdates).where(eq(regulatoryUpdates.status,"NEW")).orderBy(desc(regulatoryUpdates.publishedAt)).limit(20),safeParseArray(audit.referentialIds).length?database.select().from(referentiels).where(inArray(referentiels.id,safeParseArray(audit.referentialIds).map(Number))):[]]);const plan=await generatePreparationPlanAI({audit:{organisme:audit.auditOrganisme,nom:audit.auditOrganismeNom,type:audit.auditTypeExterne,date:audit.auditDatePrevue,referentiels:refs.map((r:any)=>({code:r.code,name:r.name})),semainesRestantes:countdown(new Date(audit.auditDatePrevue)).weeks},capaOuvertes:capas.map((c:any)=>({id:c.id,processus:c.processName,ecart:c.ecartIdentifie,statut:c.statut,echeance:c.dueDate})),alertesActives:alerts.map((a:any)=>({source:a.sourceName,titre:a.title,criticite:a.analysisCriticality}))});await database.update(audits).set({preparationPlan:plan,preparationNiveauRisque:plan.niveauRisque,preparationGeneratedAt:new Date()}).where(and(eq(audits.id,input.auditId),eq(audits.userId,ctx.user.id)));return plan;}),

  getPreparationDashboard: protectedProcedure.input(z.object({auditId:z.number().int().positive()})).query(async({ctx,input})=>{const database=await getDb();if(!database)throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});const audit=await ownedPreparationAudit(database,ctx.user.id,input.auditId);const [checklist,capas,simulations]=await Promise.all([database.select().from(preparationChecklist).where(and(eq(preparationChecklist.auditId,input.auditId),eq(preparationChecklist.userId,ctx.user.id))),database.select().from(capa_actions).where(and(eq(capa_actions.userId,ctx.user.id),ne(capa_actions.statut,"cloturee_efficace"))),database.select().from(simulationResults).where(and(eq(simulationResults.auditId,input.auditId),eq(simulationResults.userId,ctx.user.id))).orderBy(desc(simulationResults.createdAt))]);const done=checklist.filter((x:any)=>x.statut==="ok").length;return {audit:{...audit,countdown:audit.auditDatePrevue?countdown(new Date(audit.auditDatePrevue)):null},plan:audit.preparationPlan,checklist,progress:checklist.length?Math.round(done/checklist.length*100):0,capas,simulations,simulationWarning:SIMULATION_WARNING};}),

  updatePreparationItem: protectedProcedure.input(z.object({auditId:z.number().int().positive(),itemId:z.string().uuid(),statut:z.enum(["non_verifie","ok","attention"]).optional(),note:z.string().max(5000).nullable().optional(),documentRef:z.string().max(255).nullable().optional()})).mutation(async({ctx,input})=>{const database=await getDb();if(!database)throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});await ownedPreparationAudit(database,ctx.user.id,input.auditId);const {auditId,itemId,...values}=input;const result=await database.update(preparationChecklist).set(values).where(and(eq(preparationChecklist.id,itemId),eq(preparationChecklist.auditId,auditId),eq(preparationChecklist.userId,ctx.user.id)));return {success:true,result};}),

  simulateAuditorQuestions: protectedProcedure.input(z.object({auditId:z.number().int().positive(),processus:z.string().min(2).max(100)})).mutation(async({ctx,input})=>{const database=await getDb();if(!database)throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});const audit=await ownedPreparationAudit(database,ctx.user.id,input.auditId);const [capas,briefings,refs]=await Promise.all([database.select().from(capa_actions).where(and(eq(capa_actions.userId,ctx.user.id),eq(capa_actions.auditId,input.auditId))),database.select().from(sectorBriefings).orderBy(desc(sectorBriefings.generatedAt)).limit(5),safeParseArray(audit.referentialIds).length?database.select().from(referentiels).where(inArray(referentiels.id,safeParseArray(audit.referentialIds).map(Number))):[]]);const generated=await generateAuditorQuestionsAI({processus:input.processus,referentiels:refs.map((r:any)=>r.code),nonConformites:capas.filter((c:any)=>String(c.processName??"").toLowerCase().includes(input.processus.toLowerCase())),tendances:briefings.map((b:any)=>b.content)});const rows=generated.questions.map(q=>({id:randomUUID(),auditId:input.auditId,userId:ctx.user.id,processus:input.processus,question:q.question,contexte:q.contexte,orientationReponse:q.orientationReponse,preuvesAttendues:q.preuvesAttendues,criticite:q.criticite}));await database.insert(simulationResults).values(rows);return {...generated,results:rows};}),

  evaluateSimulationAnswer: protectedProcedure.input(z.object({auditId:z.number().int().positive(),simulationId:z.string().uuid(),reponse:z.string().min(5).max(10000)})).mutation(async({ctx,input})=>{const database=await getDb();if(!database)throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});await ownedPreparationAudit(database,ctx.user.id,input.auditId);const [question]=await database.select().from(simulationResults).where(and(eq(simulationResults.id,input.simulationId),eq(simulationResults.auditId,input.auditId),eq(simulationResults.userId,ctx.user.id))).limit(1);if(!question)throw new TRPCError({code:"NOT_FOUND"});const evaluation=await evaluateAuditorAnswerAI({question:question.question,contexte:question.contexte,orientation:question.orientationReponse,preuvesAttendues:question.preuvesAttendues,reponseUtilisateur:input.reponse});await database.update(simulationResults).set({reponseUtilisateur:input.reponse,scoreIA:evaluation.score,feedbackIA:evaluation.feedback}).where(eq(simulationResults.id,input.simulationId));return evaluation;}),

  getUpcomingPreparations: protectedProcedure.query(async({ctx})=>{const database=await getDb();if(!database)throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});const rows=await database.select().from(audits).where(and(eq(audits.userId,ctx.user.id),eq(audits.type,"external_preparation"))).orderBy(audits.auditDatePrevue);return Promise.all(rows.map(async(a:any)=>{const checklist=await database.select().from(preparationChecklist).where(and(eq(preparationChecklist.auditId,a.id),eq(preparationChecklist.userId,ctx.user.id)));return {...a,countdown:a.auditDatePrevue?countdown(new Date(a.auditDatePrevue)):null,progress:checklist.length?Math.round(checklist.filter((x:any)=>x.statut==="ok").length/checklist.length*100):0,criticalUnchecked:checklist.filter((x:any)=>x.statut==="attention").length};}));}),

  savePostAudit: protectedProcedure.input(z.object({auditId:z.number().int().positive(),decision:z.enum(["certifie","suspendu","refuse","observation"]),notes:z.string().max(20000).optional(),observationsPositives:z.array(z.string().max(2000)).max(20).default([]),nonConformites:z.array(z.object({processus:z.string().max(255).optional(),description:z.string().min(3).max(5000),gravite:z.enum(["majeur","mineur","observation"]),action:z.string().min(3).max(5000)})).max(50)})).mutation(async({ctx,input})=>{const database=await getDb();if(!database)throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});const audit=await ownedPreparationAudit(database,ctx.user.id,input.auditId);await database.transaction(async(tx:any)=>{await tx.update(audits).set({postAuditDecision:input.decision,postAuditNotes:JSON.stringify({notes:input.notes??null,observationsPositives:input.observationsPositives})}).where(and(eq(audits.id,input.auditId),eq(audits.userId,ctx.user.id)));if(input.nonConformites.length)await tx.insert(capa_actions).values(input.nonConformites.map((nc,i)=>({userId:ctx.user.id,auditId:input.auditId,questionKey:`EXTERNAL-${input.auditId}-${Date.now()}-${i}`,referentialCode:"AUDIT_EXTERNE",processName:nc.processus??null,gravite:nc.gravite,criticality:nc.gravite==="majeur"?"critical":"high",ecartIdentifie:nc.description,actionRecommandee:nc.action,source:"audit",qualificationDecision:"capa_requise",aiContexte:`Audit externe ${audit.auditOrganismeNom??audit.auditOrganisme}`})));});return {success:true,createdNonConformities:input.nonConformites.length};}),

  generatePreparationPDF: protectedProcedure.input(z.object({auditId:z.number().int().positive()})).mutation(async({ctx,input})=>{const database=await getDb();if(!database)throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});const audit=await ownedPreparationAudit(database,ctx.user.id,input.auditId);const [checklist,capas]=await Promise.all([database.select().from(preparationChecklist).where(and(eq(preparationChecklist.auditId,input.auditId),eq(preparationChecklist.userId,ctx.user.id))),database.select().from(capa_actions).where(and(eq(capa_actions.userId,ctx.user.id),eq(capa_actions.auditId,input.auditId)))]);const buffer=await pdfBuffer({audit,plan:audit.preparationPlan,checklist,capas});return {fileName:`rapport-preparation-audit-${input.auditId}.pdf`,mimeType:"application/pdf",base64:buffer.toString("base64"),size:buffer.length};}),

  /**
   * Frontend expects: trpc.audit.list() (AuditSelector.tsx) et
   * trpc.audit.listAudits() (AuditsList.tsx) — deux noms différents pour le
   * même besoin côté frontend legacy. Alias, tous deux vers db.getAudits
   * (déjà utilisée par audits.list, le routeur pluriel).
   */
  list: protectedProcedure
    .input(
      z
        .object({
          status: z.enum(["draft", "planned", "in_progress", "completed", "closed", "cancelled"]).optional(),
          siteId: z.number().int().positive().optional(),
          referentialId: z.number().int().positive().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const rows = await getAudits({ userId: ctx.user.id, status: input?.status, siteId: input?.siteId });
      return enrichWithDisplayFields(db, ctx.user.id, filterByReferentialId(rows, input?.referentialId));
    }),

  listAudits: protectedProcedure
    .input(
      z
        .object({
          status: z.enum(["draft", "planned", "in_progress", "completed", "closed", "cancelled"]).optional(),
          siteId: z.number().int().positive().optional(),
          referentialId: z.number().int().positive().optional(),
          // AuditsList.tsx envoie ce champ (barre de recherche) depuis le
          // début, mais il n'était jamais déclaré ici : zod (non-strict)
          // le supprimait silencieusement, la recherche ne filtrait donc
          // jamais rien (trouvé pendant CORRECTIONS.md LOT 2).
          search: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const rows = await getAudits({ userId: ctx.user.id, status: input?.status, siteId: input?.siteId });
      const scoped = filterByReferentialId(rows, input?.referentialId);
      const search = input?.search?.trim().toLowerCase();
      const searched = search ? scoped.filter((a: any) => String(a.name ?? "").toLowerCase().includes(search)) : scoped;
      return enrichWithDisplayFields(db, ctx.user.id, searched);
    }),

  /**
   * Frontend expects: trpc.audit.getById({ id }) (AuditDetail.tsx) — enrichi
   * avec siteName/referentialNames/auditors, absents de la ligne brute
   * `audits` (CORRECTIONS.md LOT 5, BUG 2 : la page affichait "Non
   * spécifié" pour ces trois champs car ils n'existaient nulle part dans
   * la réponse, pas parce que les données étaient réellement manquantes en
   * base). Référentiels résolus par `code`, jamais par ID en dur.
   */
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const audit = await getAuditById(input.id, ctx.user.id);
      if (!audit) throw new TRPCError({ code: "NOT_FOUND", message: "Audit non trouvé" });

      const [site] = (audit as any).siteId
        ? await db.select({ name: sites.name }).from(sites).where(eq(sites.id, (audit as any).siteId)).limit(1)
        : [null];

      const refIds = safeParseArray((audit as any).referentialIds).map(Number).filter((n: number) => Number.isFinite(n));
      let referentialNames: string | null = null;
      if (refIds.length > 0) {
        const refs = await db.select({ name: referentiels.name }).from(referentiels).where(inArray(referentiels.id, refIds));
        referentialNames = refs.map((r: any) => r.name).filter(Boolean).join(", ") || null;
      }

      return {
        ...audit,
        siteName: (site as any)?.name ?? null,
        referentialNames,
        auditors: (audit as any).auditorName ?? null,
        progression: (await computeGenericAuditProgressSafe(db, ctx.user.id, input.id))?.percentage ?? 0,
      };
    }),

  /**
   * Reopen an audit before returning to its questionnaire. A formally closed
   * audit is immutable; every other lifecycle state can return to in_progress.
   */
  reopen: protectedProcedure
    .input(z.object({ auditId: z.number().int().positive(), reason: z.string().trim().min(3).max(2000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const audit = await getAuditById(input.auditId, ctx.user.id);
      if (!audit) throw new TRPCError({ code: "NOT_FOUND", message: "Audit non trouvé" });
      assertAuditCanReopen(audit, input.reason);

      if ((audit as any).status !== "in_progress") {
        await db
          .update(audits)
          .set({ status: "in_progress", updatedAt: new Date() })
          .where(and(eq(audits.id, input.auditId), eq(audits.userId, ctx.user.id)));
      }

      return { success: true as const, status: "in_progress" as const };
    }),

  /**
   * Champs manquants pour un rapport conforme ISO 19011/17021-1/MDR Annexe IX
   * (Tâche D.7, migration 0027, validé par l'utilisateur le 2026-07-23).
   * Tous facultatifs, éditables à tout moment depuis la fiche d'audit
   * (AuditDetail.tsx) — n'allonge pas le parcours de création. Un champ non
   * renseigné reste `null` ; le rapport affiche alors "Non renseigné",
   * jamais de valeur par défaut inventée.
   */
  updateReportFields: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        auditNature: z.enum(["interne", "fournisseur", "blanc", "revue_conformite"]).optional(),
        auditTeam: z
          .array(z.object({ name: z.string(), role: z.string(), email: z.string().optional() }))
          .optional(),
        auditeesRepresentatives: z
          .array(z.object({ name: z.string(), function: z.string().optional() }))
          .optional(),
        scopeExclusions: z.string().optional(),
        plannedAgenda: z.array(z.object({ date: z.string(), activity: z.string() })).optional(),
        actualAgenda: z.array(z.object({ date: z.string(), activity: z.string() })).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const audit = await getAuditById(input.id, ctx.user.id);
      if (!audit) throw new TRPCError({ code: "NOT_FOUND", message: "Audit non trouvé" });
      assertAuditMutable(audit);

      const { id, ...fields } = input;
      const patch: Record<string, any> = {};
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) patch[key] = value;
      }

      if (Object.keys(patch).length === 0) return { success: true };

      await db.update(audits).set({ ...patch, updatedAt: new Date() }).where(eq(audits.id, input.id));
      return { success: true };
    }),

  /**
   * Frontend expects: trpc.audit.delete({ id }) (AuditHistory.tsx). Vérifie
   * la propriété avant suppression (db.deleteAudit ne filtre pas par
   * userId — voir server/db.ts).
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const audit = await getAuditById(input.id, ctx.user.id);
      if (!audit) throw new TRPCError({ code: "NOT_FOUND", message: "Audit non trouvé" });
      assertAuditMutable(audit);
      const [responses, capas] = await Promise.all([
        db.select({ id: auditResponses.id }).from(auditResponses).where(and(eq(auditResponses.auditId, input.id), eq(auditResponses.userId, ctx.user.id))).limit(1),
        db.select({ id: capa_actions.id }).from(capa_actions).where(and(eq(capa_actions.auditId, input.id), eq(capa_actions.userId, ctx.user.id))).limit(1),
      ]);
      assertAuditDeletable({ responses: responses.length, capas: capas.length });
      await deleteAudit(input.id);
      return { success: true };
    }),

  /**
   * Frontend expects: trpc.audit.get({ auditId }) (AuditResults.tsx) — audit
   * + score calculé à la volée (même barème que mdr/iso getAuditDashboard),
   * scopé dynamiquement par référentiel/rôle (jamais d'ID en dur).
   */
  get: protectedProcedure
    .input(z.object({ auditId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const { audit, stats, score, progress } = await computeGenericAuditStats(db, ctx.user.id, input.auditId);
      return { ...audit, score, stats, progression: progress.percentage, progress };
    }),

  /**
   * Frontend expects: trpc.audit.getStats({ auditId }) (AuditResults.tsx)
   */
  getStats: protectedProcedure
    .input(z.object({ auditId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const { stats, score, progress } = await computeGenericAuditStats(db, ctx.user.id, input.auditId);
      return { ...stats, score, progression: progress.percentage, progress };
    }),

  /**
   * Frontend expects: trpc.audit.getScore({ auditId }) (Reports.tsx) —
   * MAIS l'appel réel (Reports.tsx:18) est `getScore.useQuery({}, ...)`,
   * sans auditId : la page veut un score global agrégé (variable nommée
   * `globalScore`, champs lus ensuite : `.score`, `.conforme`, `.nok`,
   * `.na` — voir Reports.tsx:95-107), pas le score d'un audit précis.
   * auditId rendu optionnel : fourni -> score de cet audit ; omis -> moyenne
   * sur tous les audits de l'utilisateur, agrégée avec les noms de champs
   * exacts attendus par cette page.
   */
  getScore: protectedProcedure
    .input(z.object({ auditId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      if (input?.auditId !== undefined) {
        const { score, stats, progress } = await computeGenericAuditStats(db, ctx.user.id, input.auditId);
        return {
          score,
          total: stats.totalQuestions,
          answered: stats.answered,
          conforme: stats.compliant,
          nok: stats.non_compliant,
          na: stats.not_applicable,
          progress: progress.percentage,
        };
      }

      const userAudits = await getAudits({ userId: ctx.user.id });
      let conforme = 0;
      let nok = 0;
      let na = 0;
      let total = 0;
      let answered = 0;
      let applicable = 0;
      const scores: number[] = [];

      for (const audit of userAudits) {
        try {
          const { score, stats, progress } = await computeGenericAuditStats(db, ctx.user.id, (audit as any).id);
          if (stats.answered === 0) continue;
          scores.push(score);
          conforme += stats.compliant;
          nok += stats.non_compliant;
          na += stats.not_applicable;
          total += stats.totalQuestions;
          answered += progress.finalApplicableResponses;
          applicable += progress.totalApplicableQuestions;
        } catch {
          // audit sans scope résolvable (ex. brouillon jamais rattaché à un
          // référentiel) : exclu de l'agrégat plutôt que de faire échouer
          // toute la page.
        }
      }

      const score = scores.length > 0 ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10 : 0;
      const progress = applicable > 0 ? Math.round((answered / applicable) * 1000) / 10 : 0;
      return { score, conforme, nok, na, total, answered, progress };
    }),

  /**
   * Étape C (routeur d'audit générique — voir CORRECTIONS.md) : équivalent
   * référentiel-agnostique de mdr.getQuestionsForAudit/iso.getQuestionsForAudit.
   * Réutilise fetchAuditScopedQuestions (déjà générique : referentialIds,
   * economicRole, processIds viennent de l'audit lui-même, jamais d'un
   * référentiel en dur) — même mécanique que celle qui alimente déjà
   * computeGenericAuditStats pour le score. Sert IVDR/MDSAP (aucun routeur
   * dédié aujourd'hui) et, à terme, tous les référentiels via le futur
   * wizard unique. N'affecte pas les routeurs mdr/iso/fda existants.
   */
  getAuditContext: protectedProcedure
    .input(z.object({ auditId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const [audit] = await db
        .select()
        .from(audits)
        .where(and(eq(audits.id, input.auditId), eq(audits.userId, ctx.user.id)))
        .limit(1);
      if (!audit) throw new TRPCError({ code: "NOT_FOUND", message: "Audit introuvable" });
      return {
        auditId: audit.id,
        auditName: audit.name,
        userId: audit.userId,
        siteId: audit.siteId,
        status: audit.status,
        economicRole: audit.economicRole,
        processIds: safeParseArray(audit.processIds).map(String),
        referentialIds: safeParseArray(audit.referentialIds).map(Number),
        startDate: audit.startDate,
        endDate: audit.endDate,
      };
    }),

  getResponses: protectedProcedure
    .input(z.object({ auditId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await getAuditContextInternal(db, ctx.user.id, input.auditId);
      return db
        .select()
        .from(auditResponses)
        .where(and(eq(auditResponses.auditId, input.auditId), eq(auditResponses.userId, ctx.user.id)))
        .orderBy(auditResponses.id);
    }),

  completeAudit: protectedProcedure
    .input(z.object({ auditId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const auditContext = await getAuditContextInternal(db, ctx.user.id, input.auditId);
      assertAuditCanComplete(auditContext.audit);
      const scopedQuestions = await fetchAuditScopedQuestions(db, {
        auditId: input.auditId,
        userId: ctx.user.id,
        economicRole: auditContext.economicRole,
        economicRolesFromOnboarding: auditContext.economicRolesFromOnboarding,
        situationTags: auditContext.situationTags,
        processIds: auditContext.processIds,
        referentialIds: auditContext.referentialIds,
        select: { questionKey: (questions as any).questionKey },
      });
      const responses = await db
        .select({ questionKey: auditResponses.questionKey, responseValue: auditResponses.responseValue })
        .from(auditResponses)
        .where(and(eq(auditResponses.auditId, input.auditId), eq(auditResponses.userId, ctx.user.id)));
      assertAuditComplete(scopedQuestions, responses);
      await db
        .update(audits)
        .set({ status: "completed", endDate: new Date(), updatedAt: new Date() })
        .where(and(eq(audits.id, input.auditId), eq(audits.userId, ctx.user.id)));
      return { success: true as const };
    }),

  getQuestionsForAudit: protectedProcedure
    .input(z.object({ auditId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const auditContext = await getAuditContextInternal(db, ctx.user.id, input.auditId);

      const rows = await fetchAuditScopedQuestions(db, {
        auditId: input.auditId,
        userId: ctx.user.id,
        economicRole: auditContext.economicRole,
        economicRolesFromOnboarding: auditContext.economicRolesFromOnboarding,
        situationTags: auditContext.situationTags,
        processIds: auditContext.processIds,
        referentialIds: auditContext.referentialIds,
        select: {
          id: (questions as any).id,
          referentialId: (questions as any).referentialId,
          processId: (questions as any).processId,
          questionKey: (questions as any).questionKey,
          article: (questions as any).article,
          annexe: (questions as any).annexe,
          title: (questions as any).title,
          economicRole: (questions as any).economicRole,
          questionType: (questions as any).questionType,
          questionText: (questions as any).questionText,
          expectedEvidence: (questions as any).expectedEvidence,
          criticality: (questions as any).criticality,
          risk: (questions as any).risk,
          interviewFunctions: (questions as any).interviewFunctions,
          actionPlan: (questions as any).actionPlan,
          aiPrompt: (questions as any).aiPrompt,
          displayOrder: (questions as any).displayOrder,
        },
      });

      return { count: (rows || []).length, questions: rows || [] };
    }),

  /**
   * Étape C : équivalent référentiel-agnostique de mdr.saveResponse/
   * iso.saveResponse — la logique y était déjà identique d'un routeur à
   * l'autre (audit_responses n'a jamais été spécifique à un référentiel),
   * seule la duplication changeait. N'affecte pas les routeurs mdr/iso existants.
   */
  saveResponse: protectedProcedure
    .input(
      z.object({
        auditId: z.number(),
        questionKey: z.string().min(1),
        responseValue: ResponseValueEnum,
        responseComment: z.string().optional().nullable(),
        note: z.string().optional().nullable(),
        role: z.string().optional().nullable(),
        // Le frontend envoie parfois processId en nombre (ex. 2), parfois en
        // chaîne, parfois null quand le processus vaut « all ». On accepte les
        // trois et on normalise en chaîne|null pour le reste de la procédure.
        processId: z
          .union([z.string(), z.number()])
          .nullish()
          .transform((v) => (v === null || v === undefined || v === "" ? null : String(v))),
        evidenceFiles: z.array(z.string()).optional().default([]),
        answeredBy: z.union([z.number(), z.string()]).optional().nullable(),
        answeredAt: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const auditContext = await getAuditContextInternal(db, ctx.user.id, input.auditId);
      assertAuditMutable(auditContext.audit);
      const scopedQuestions = await fetchAuditScopedQuestions(db, {
        auditId: input.auditId,
        userId: ctx.user.id,
        economicRole: auditContext.economicRole,
        economicRolesFromOnboarding: auditContext.economicRolesFromOnboarding,
        situationTags: auditContext.situationTags,
        processIds: auditContext.processIds,
        referentialIds: auditContext.referentialIds,
        select: { questionKey: (questions as any).questionKey, processId: (questions as any).processId },
      });
      assertQuestionBelongsToAudit(input.questionKey, scopedQuestions);

      const now = new Date();
      const normalizedProcessId = resolveAuditProcessId(input.questionKey, input.processId, scopedQuestions);
      const normalizedAnsweredBy =
        input.answeredBy === null || input.answeredBy === undefined || input.answeredBy === ""
          ? ctx.user.id
          : Number(input.answeredBy);

      const parsedAnsweredAt = input.answeredAt ? new Date(input.answeredAt) : null;
      const normalizedAnsweredAt =
        parsedAnsweredAt && !Number.isNaN(parsedAnsweredAt.getTime()) ? parsedAnsweredAt : now;

      const values: any = {
        auditId: input.auditId,
        questionKey: input.questionKey,
        responseValue: input.responseValue,
        responseComment: input.responseComment ?? "",
        note: input.note ?? "",
        evidenceFiles: input.evidenceFiles ?? [],
        role: input.role ?? null,
        processId: normalizedProcessId,
        answeredBy: Number.isFinite(normalizedAnsweredBy) ? normalizedAnsweredBy : ctx.user.id,
        answeredAt: normalizedAnsweredAt,
        updatedAt: now,
        userId: ctx.user.id,
      };

      const whereExpr = and(
        eq((auditResponses as any).auditId, input.auditId),
        eq((auditResponses as any).questionKey, input.questionKey),
        eq((auditResponses as any).userId, ctx.user.id)
      );

      const [existing] = await db
        .select({ id: (auditResponses as any).id })
        .from(auditResponses)
        .where(whereExpr)
        .limit(1);

      if (existing?.id) {
        await db.update(auditResponses).set(values).where(eq((auditResponses as any).id, existing.id));
        return { success: true, mode: "updated" as const };
      }

      await db.insert(auditResponses).values({ ...values, createdAt: now });
      return { success: true, mode: "created" as const };
    }),
});
