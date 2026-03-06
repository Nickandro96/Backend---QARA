import { z } from "zod";
import crypto from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb, createAudit } from "./db";
import {
  actions,
  audits,
  audit_responses,
  fdaQualificationAnswers,
  fdaQualificationResults,
  fdaQualificationSessions,
  findings,
  questions,
  referentiels,
  resultats,
} from "../drizzle/schema";

const FDA_AI_PROMPT_TEMPLATE = `You are an FDA medical device compliance copilot. Explain the requirement in plain business language, identify the expected evidence, suggest a CAPA-ready action plan, and highlight inspection risk.`;

const FRAMEWORKS = [
  {
    code: "FDA_QSR_21CFR820",
    name: "FDA QMSR / 21 CFR Part 820",
    description: "Operational audit based on FDA quality system requirements and inspection readiness.",
    chapters: [
      "Management Controls",
      "Design Controls",
      "Document Controls",
      "Purchasing Controls",
      "Production & Process Controls",
      "CAPA",
      "Complaints & MDR",
      "Acceptance Activities",
      "Labeling & UDI",
      "Records",
    ],
  },
  {
    code: "FDA_US_MARKET_ACCESS",
    name: "FDA US Market Access",
    description: "Qualification, classification, UDI, listing, submissions and post-market readiness.",
    chapters: [
      "Qualification",
      "Classification",
      "Pathway",
      "Registration & Listing",
      "UDI",
      "MDR / Vigilance",
    ],
  },
];

const QUALIFICATION_QUESTIONS = [
  { id: "is_medical_purpose", step: 1, label: "The product is intended to diagnose, cure, mitigate, treat, or prevent disease.", kind: "boolean" },
  { id: "acts_on_body_chemically", step: 1, label: "The primary intended effect is achieved through chemical action or metabolism.", kind: "boolean" },
  { id: "is_software", step: 1, label: "The product is software or includes standalone software.", kind: "boolean" },
  { id: "is_invasive_implantable", step: 2, label: "The product is invasive, implantable, or life-sustaining / life-supporting.", kind: "boolean" },
  { id: "has_predicate", step: 2, label: "A legally marketed predicate device is known and comparable.", kind: "boolean" },
  { id: "novel_technology", step: 2, label: "The technology or intended use appears novel for the US market.", kind: "boolean" },
  { id: "sterile_or_measuring", step: 2, label: "The device is supplied sterile, has measuring function, or requires special controls.", kind: "boolean" },
  { id: "manufacturer_role", step: 3, label: "Your company is the legal manufacturer / specification developer.", kind: "boolean" },
  { id: "initial_importer", step: 3, label: "Your company is the initial importer into the United States.", kind: "boolean" },
  { id: "us_agent_needed", step: 3, label: "The manufacturing site is outside the United States.", kind: "boolean" },
  { id: "device_name", step: 4, label: "Device name", kind: "text" },
  { id: "intended_use", step: 4, label: "Intended use", kind: "text" },
  { id: "sources", step: 4, label: "Optional sources / references", kind: "text" },
] as const;

const RESPONSE_WEIGHTS: Record<string, number> = {
  compliant: 1,
  conforme: 1,
  partial: 0.5,
  partially_compliant: 0.5,
  nok: 0,
  non_compliant: 0,
  no: 0,
  na: 1,
  not_applicable: 1,
};

const CRITICALITY_WEIGHTS: Record<string, number> = {
  critical: 5,
  high: 4,
  medium: 2,
  low: 1,
  majeur: 4,
  mineur: 1,
};

function stableHash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function normalizeResponse(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function critWeight(value?: string | null) {
  const v = String(value || "medium").trim().toLowerCase();
  return CRITICALITY_WEIGHTS[v] ?? 2;
}

function responseWeight(value?: string | null) {
  const v = normalizeResponse(value);
  return RESPONSE_WEIGHTS[v] ?? 0;
}

function parseJsonArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return value
        .split(/[;,\n]+/)
        .map((x) => x.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function computeQualification(answers: Record<string, unknown>) {
  const isMedicalPurpose = Boolean(answers.is_medical_purpose);
  const actsChemically = Boolean(answers.acts_on_body_chemically);
  const invasive = Boolean(answers.is_invasive_implantable);
  const hasPredicate = Boolean(answers.has_predicate);
  const novel = Boolean(answers.novel_technology);
  const sterile = Boolean(answers.sterile_or_measuring);
  const manufacturerRole = Boolean(answers.manufacturer_role);
  const initialImporter = Boolean(answers.initial_importer);
  const outsideUS = Boolean(answers.us_agent_needed);

  const probableDeviceStatus = isMedicalPurpose && !actsChemically;
  let deviceClass: "I" | "II" | "III" = "I";
  let pathway: "Exempt" | "510(k)" | "De Novo" | "PMA" = "Exempt";
  let confidence = 55;

  if (invasive) {
    deviceClass = "III";
    confidence = 78;
  } else if (novel || sterile) {
    deviceClass = "II";
    confidence = 72;
  }

  if (deviceClass === "III") {
    pathway = "PMA";
  } else if (deviceClass === "II") {
    pathway = hasPredicate ? "510(k)" : "De Novo";
  } else {
    pathway = hasPredicate ? "510(k)" : "Exempt";
  }

  const obligations = [
    {
      code: "QMSR",
      label: "Quality Management System Regulation / ISO 13485-aligned QMS",
      required: probableDeviceStatus && manufacturerRole,
    },
    {
      code: "REG_LIST",
      label: "Establishment registration and device listing",
      required: probableDeviceStatus && (manufacturerRole || initialImporter),
    },
    {
      code: "UDI",
      label: "UDI / GUDID readiness",
      required: probableDeviceStatus,
    },
    {
      code: "MDR",
      label: "Medical Device Reporting / complaint handling",
      required: probableDeviceStatus,
    },
    {
      code: "US_AGENT",
      label: "US Agent designation for foreign manufacturers",
      required: probableDeviceStatus && manufacturerRole && outsideUS,
    },
    {
      code: "SUBMISSION",
      label: `Premarket pathway readiness (${pathway})`,
      required: probableDeviceStatus,
    },
  ];

  const roles = [
    manufacturerRole ? "manufacturer_us" : null,
    initialImporter ? "initial_importer" : null,
    outsideUS && manufacturerRole ? "foreign_manufacturer" : null,
  ].filter(Boolean);

  const sourceReferences = [
    "FDA QMSR / 21 CFR Part 820",
    "FDA device registration and listing",
    "FDA UDI system",
    "FDA MDR reporting",
    "FDA 510(k), De Novo and PMA overviews",
  ];

  const rationale = probableDeviceStatus
    ? `The answers indicate a product that is probably regulated as a medical device in the US. Probable class ${deviceClass} with pathway ${pathway}.`
    : "The answers suggest the product may fall outside the medical device scope or require further legal review (for example drug / combination product / non-device software).";

  return {
    probableDeviceStatus,
    deviceClass,
    confidence,
    pathway,
    roles,
    obligations,
    rationale,
    sourceReferences,
    sourcesNotes: String(answers.sources || "").trim() || null,
  };
}

async function getReferentialIdByCode(database: any, code: string) {
  const [row] = await database.select().from(referentiels).where(eq(referentiels.code, code)).limit(1);
  return row?.id ?? null;
}

export const fdaRouter = router({
  getFrameworks: protectedProcedure.query(() => FRAMEWORKS),

  getQualificationQuestions: protectedProcedure.query(() => ({ questions: QUALIFICATION_QUESTIONS })),

  getQualification: protectedProcedure.query(async ({ ctx }) => {
    const database = await getDb();
    if (!database) throw new Error("Database not available");

    const [latest] = await database
      .select()
      .from(fdaQualificationResults)
      .where(eq(fdaQualificationResults.userId, ctx.user.id))
      .orderBy(desc(fdaQualificationResults.createdAt))
      .limit(1);

    if (!latest) return null;
    return latest;
  }),

  saveQualification: protectedProcedure
    .input(
      z.object({
        sessionName: z.string().optional(),
        answers: z.record(z.any()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      const sessionInsert: any = await database.insert(fdaQualificationSessions).values({
        userId: ctx.user.id,
        tenantId: null,
        sessionName: input.sessionName || "FDA Qualification",
        status: "completed",
        rulesetVersion: "2026.03",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const sessionId = sessionInsert?.[0]?.insertId ?? sessionInsert?.insertId;
      const result = computeQualification(input.answers);

      for (const q of QUALIFICATION_QUESTIONS) {
        await database.insert(fdaQualificationAnswers).values({
          sessionId,
          questionKey: q.id,
          questionLabel: q.label,
          answerValue: input.answers[q.id] ?? null,
          createdAt: new Date(),
        });
      }

      const insertRes: any = await database.insert(fdaQualificationResults).values({
        userId: ctx.user.id,
        tenantId: null,
        sessionId,
        rulesetVersion: "2026.03",
        resultJson: result,
        exportSnapshot: {
          answers: input.answers,
          result,
        },
        probableDeviceStatus: result.probableDeviceStatus,
        probableClass: result.deviceClass,
        probablePathway: result.pathway,
        confidenceScore: result.confidence,
        createdAt: new Date(),
      });

      return {
        sessionId,
        resultId: insertRes?.[0]?.insertId ?? insertRes?.insertId,
        ...result,
      };
    }),

  createAudit: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2),
        frameworkCode: z.enum(["FDA_QSR_21CFR820", "FDA_US_MARKET_ACCESS"]).default("FDA_QSR_21CFR820"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");
      const refId = await getReferentialIdByCode(database, input.frameworkCode);
      if (!refId) throw new Error(`Referential not found for ${input.frameworkCode}`);

      const created = await createAudit({
        userId: ctx.user.id,
        name: input.name,
        type: "fda",
        status: "draft",
        referentialIds: [refId],
        processIds: [],
      });
      return { auditId: created.id, referentialId: refId };
    }),

  getQuestions: protectedProcedure
    .input(
      z.object({
        frameworkCode: z.enum(["FDA_QSR_21CFR820", "FDA_US_MARKET_ACCESS"]).default("FDA_QSR_21CFR820"),
        economicRole: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");
      const refId = await getReferentialIdByCode(database, input.frameworkCode);
      if (!refId) return { totalQuestions: 0, applicableQuestions: 0, questions: [] };

      const rows = await database
        .select()
        .from(questions)
        .where(eq(questions.referentialId, refId))
        .orderBy(asc(questions.displayOrder), asc(questions.id));

      const filtered = rows.filter((row: any) => {
        if (!input.economicRole || !row.economicRole || row.economicRole === "all") return true;
        return String(row.economicRole).toLowerCase() === String(input.economicRole).toLowerCase();
      });

      return {
        totalQuestions: rows.length,
        applicableQuestions: filtered.length,
        questions: filtered.map((row: any) => ({
          ...row,
          aiPrompt: row.aiPrompt || FDA_AI_PROMPT_TEMPLATE,
          interviewFunctions: parseJsonArray(row.interviewFunctions),
          applicableProcesses: parseJsonArray(row.applicableProcesses),
        })),
      };
    }),

  saveResponse: protectedProcedure
    .input(
      z.object({
        auditId: z.number().int().positive(),
        questionId: z.number().int().positive(),
        responseValue: z.string(),
        responseComment: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      const [audit] = await database
        .select()
        .from(audits)
        .where(and(eq(audits.id, input.auditId), eq(audits.userId, ctx.user.id)))
        .limit(1);
      if (!audit) throw new Error("Audit not found");

      const [question] = await database.select().from(questions).where(eq(questions.id, input.questionId)).limit(1);
      if (!question) throw new Error("Question not found");

      const questionKey = question.questionKey || stableHash(`${question.referentialId}|${question.article}|${question.title}|${question.questionText}`);

      await database
        .insert(audit_responses)
        .values({
          userId: ctx.user.id,
          auditId: input.auditId,
          questionId: input.questionId,
          questionKey,
          responseValue: input.responseValue,
          responseComment: input.responseComment ?? null,
          answeredBy: ctx.user.id,
          answeredAt: new Date(),
          processId: question.processId ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onDuplicateKeyUpdate({
          set: {
            responseValue: input.responseValue,
            responseComment: input.responseComment ?? null,
            answeredBy: ctx.user.id,
            answeredAt: new Date(),
            updatedAt: new Date(),
          },
        });

      const isGap = ["nok", "non_compliant", "no"].includes(normalizeResponse(input.responseValue));
      const autoAction = question.actionPlan || `Review requirement, collect missing evidence, define CAPA owner and due date, and verify effectiveness before next management review.`;

      if (isGap) {
        const [existingFinding] = await database
          .select()
          .from(findings)
          .where(and(eq(findings.auditId, input.auditId), eq(findings.title, question.title || question.questionText?.slice(0, 100) || "FDA gap")))
          .limit(1);

        const findingId = existingFinding?.id
          ? existingFinding.id
          : ((await database.insert(findings).values({
              userId: ctx.user.id,
              auditId: input.auditId,
              title: question.title || question.questionText?.slice(0, 100) || "FDA gap",
              description: question.questionText,
              severity: String(question.criticality || "medium"),
              status: "open",
              createdAt: new Date(),
              updatedAt: new Date(),
            })) as any)?.insertId;

        const existingActions = await database.select().from(actions).where(eq(actions.findingId, findingId)).limit(1);
        if (!existingActions.length) {
          await database.insert(actions).values({
            findingId,
            actionCode: `FDA-${String(input.questionId).padStart(4, "0")}`,
            description: autoAction,
            responsible: null,
            dueDate: null,
            status: "open",
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }

      return { success: true, questionKey };
    }),

  getAuditDashboard: protectedProcedure
    .input(z.object({ auditId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      const [audit] = await database
        .select()
        .from(audits)
        .where(and(eq(audits.id, input.auditId), eq(audits.userId, ctx.user.id)))
        .limit(1);
      if (!audit) throw new Error("Audit not found");

      const refIds = Array.isArray(audit.referentialIds) ? audit.referentialIds : [];
      const questionsRows = refIds.length
        ? await database.select().from(questions).where(inArray(questions.referentialId, refIds as number[])).orderBy(asc(questions.displayOrder), asc(questions.id))
        : [];
      const responseRows = await database.select().from(audit_responses).where(and(eq(audit_responses.auditId, input.auditId), eq(audit_responses.userId, ctx.user.id)));
      const actionsRows = await database
        .select({
          id: actions.id,
          actionCode: actions.actionCode,
          description: actions.description,
          status: actions.status,
          dueDate: actions.dueDate,
          severity: findings.severity,
          title: findings.title,
        })
        .from(actions)
        .innerJoin(findings, eq(actions.findingId, findings.id))
        .where(eq(findings.auditId, input.auditId))
        .orderBy(desc(actions.createdAt));

      const responseMap = new Map(responseRows.map((r: any) => [r.questionKey, r]));
      const totalWeight = questionsRows.reduce((sum: number, q: any) => sum + critWeight(q.criticality), 0) || 1;
      let weightedScore = 0;
      let missingEvidence = 0;
      let nonCompliant = 0;
      let highOpen = 0;

      const chaptersMap = new Map<string, { chapter: string; score: number; weight: number; answered: number; total: number }>();
      const heatmap: Array<{ chapter: string; criticality: string; compliance: number }> = [];

      for (const q of questionsRows as any[]) {
        const key = q.questionKey || stableHash(`${q.referentialId}|${q.article}|${q.title}|${q.questionText}`);
        const resp = responseMap.get(key);
        const chapter = q.title || q.article || "General";
        const cw = critWeight(q.criticality);
        const rw = responseWeight(resp?.responseValue);
        weightedScore += cw * rw;
        if (!resp) missingEvidence += 1;
        if (["nok", "non_compliant", "no"].includes(normalizeResponse(resp?.responseValue))) {
          nonCompliant += 1;
          if (cw >= 4) highOpen += 1;
        }

        const current = chaptersMap.get(chapter) || { chapter, score: 0, weight: 0, answered: 0, total: 0 };
        current.score += cw * rw;
        current.weight += cw;
        current.total += 1;
        if (resp) current.answered += 1;
        chaptersMap.set(chapter, current);
        heatmap.push({ chapter, criticality: String(q.criticality || "medium"), compliance: Math.round(rw * 100) });
      }

      const chapterScores = Array.from(chaptersMap.values()).map((x) => ({
        chapter: x.chapter,
        score: x.weight ? Math.round((x.score / x.weight) * 100) : 0,
        answered: x.answered,
        total: x.total,
      }));

      const globalScore = Math.max(0, Math.round((weightedScore / totalWeight) * 100 - (missingEvidence > 0 ? (missingEvidence / Math.max(questionsRows.length, 1)) * 10 : 0)));

      const topGaps = questionsRows
        .map((q: any) => {
          const key = q.questionKey || stableHash(`${q.referentialId}|${q.article}|${q.title}|${q.questionText}`);
          const resp = responseMap.get(key);
          const priority = critWeight(q.criticality) * (1 - responseWeight(resp?.responseValue));
          return {
            questionId: q.id,
            title: q.title || q.questionText?.slice(0, 90) || "Gap",
            questionText: q.questionText,
            expectedEvidence: q.expectedEvidence,
            criticality: q.criticality,
            responseValue: resp?.responseValue ?? null,
            recommendation: q.actionPlan || "Collect objective evidence, assign CAPA owner, define due date and effectiveness check.",
            priority,
          };
        })
        .sort((a: any, b: any) => b.priority - a.priority)
        .slice(0, 10);

      await database
        .insert(resultats)
        .values({
          userId: ctx.user.id,
          auditId: input.auditId,
          score: globalScore,
          conformityRate: globalScore,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onDuplicateKeyUpdate({ set: { score: globalScore, conformityRate: globalScore, updatedAt: new Date() } });

      return {
        audit: { id: audit.id, name: audit.name, status: audit.status },
        globalScore,
        kpis: {
          totalQuestions: questionsRows.length,
          answeredQuestions: responseRows.length,
          nonCompliantQuestions: nonCompliant,
          missingEvidence,
          highCriticalityUntreated: highOpen,
        },
        chapterScores,
        heatmap,
        topGaps,
        timeline: actionsRows.map((a: any) => ({
          id: a.id,
          title: a.title,
          actionCode: a.actionCode,
          description: a.description,
          status: a.status,
          dueDate: a.dueDate,
          severity: a.severity,
        })),
      };
    }),

  getReports: protectedProcedure
    .input(z.object({ auditId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      const [audit] = await database
        .select()
        .from(audits)
        .where(and(eq(audits.id, input.auditId), eq(audits.userId, ctx.user.id)))
        .limit(1);
      if (!audit) throw new Error("Audit not found");

      const refIds = Array.isArray(audit.referentialIds) ? audit.referentialIds : [];
      const questionsRows = refIds.length
        ? await database.select().from(questions).where(inArray(questions.referentialId, refIds as number[])).orderBy(asc(questions.displayOrder), asc(questions.id))
        : [];
      const responseRows = await database.select().from(audit_responses).where(and(eq(audit_responses.auditId, input.auditId), eq(audit_responses.userId, ctx.user.id)));

      const responseMap = new Map(responseRows.map((r: any) => [r.questionKey, r]));
      const totalWeight = questionsRows.reduce((sum: number, q: any) => sum + critWeight(q.criticality), 0) || 1;
      let weightedScore = 0;
      let missingEvidence = 0;
      let nonCompliant = 0;
      const chapterScoresMap = new Map<string, { score: number; weight: number }>();

      for (const q of questionsRows as any[]) {
        const key = q.questionKey || stableHash(`${q.referentialId}|${q.article}|${q.title}|${q.questionText}`);
        const resp = responseMap.get(key);
        const rw = responseWeight(resp?.responseValue);
        const cw = critWeight(q.criticality);
        const chapter = q.title || q.article || 'General';
        weightedScore += cw * rw;
        if (!resp) missingEvidence += 1;
        if (["nok", "non_compliant", "no"].includes(normalizeResponse(resp?.responseValue))) nonCompliant += 1;
        const c = chapterScoresMap.get(chapter) || { score: 0, weight: 0 };
        c.score += cw * rw;
        c.weight += cw;
        chapterScoresMap.set(chapter, c);
      }

      const globalScore = Math.max(0, Math.round((weightedScore / totalWeight) * 100 - (missingEvidence > 0 ? (missingEvidence / Math.max(questionsRows.length, 1)) * 10 : 0)));
      const chapterScores = Array.from(chapterScoresMap.entries()).map(([chapter, values]) => ({ chapter, score: values.weight ? Math.round((values.score / values.weight) * 100) : 0 }));
      const topGaps = questionsRows
        .map((q: any) => {
          const key = q.questionKey || stableHash(`${q.referentialId}|${q.article}|${q.title}|${q.questionText}`);
          const resp = responseMap.get(key);
          return {
            title: q.title || q.questionText?.slice(0, 80) || 'Gap',
            questionText: q.questionText,
            expectedEvidence: q.expectedEvidence,
            criticality: q.criticality,
            recommendation: q.actionPlan || 'Collect objective evidence, assign owner and due date, then verify effectiveness.',
            priority: critWeight(q.criticality) * (1 - responseWeight(resp?.responseValue)),
          };
        })
        .sort((a: any, b: any) => b.priority - a.priority)
        .slice(0, 10);

      return {
        generatedAt: new Date().toISOString(),
        reportType: 'FDA_QSR_AUDIT',
        executiveSummary: `Global FDA score: ${globalScore}/100. ${nonCompliant} non-compliant questions and ${missingEvidence} missing evidences identified.`,
        audit: { id: audit.id, name: audit.name, status: audit.status },
        globalScore,
        chapterScores,
        kpis: { totalQuestions: questionsRows.length, answeredQuestions: responseRows.length, nonCompliantQuestions: nonCompliant, missingEvidence },
        topGaps,
      };
    }),

  getDocuments: protectedProcedure.query(() => ({
    documents: [
      {
        slug: "sop-capa",
        title: "SOP CAPA",
        category: "Quality System",
        format: "markdown",
        content: `# SOP CAPA\n\n## Purpose\nDefine how quality events, nonconformities, complaints, audit findings and regulatory signals are investigated, corrected and prevented.\n\n## Minimum sections\n1. Scope\n2. Definitions\n3. Roles and responsibilities\n4. Risk-based triage\n5. Root cause analysis\n6. Correction / corrective action / preventive action\n7. Effectiveness verification\n8. Records and management review inputs`,
      },
      {
        slug: "sop-complaints",
        title: "SOP Complaint Handling",
        category: "Post-market",
        format: "markdown",
        content: `# SOP Complaint Handling\n\nCapture, assess, investigate and trend complaints. Include MDR decision points, escalation timelines, complaint closure criteria and feedback loop to CAPA and risk management.`,
      },
      {
        slug: "design-control-plan",
        title: "Design Control Plan",
        category: "Design Controls",
        format: "markdown",
        content: `# Design Control Plan\n\n- Design and development plan\n- Design inputs\n- Design outputs\n- Design review\n- Verification\n- Validation\n- Transfer\n- Design changes\n- DHF linkage`,
      },
      {
        slug: "dhf-index",
        title: "DHF Index",
        category: "Design Controls",
        format: "markdown",
        content: `# DHF Index\n\nDocument matrix for design history records, traceability, verification, validation and design changes.`,
      },
      {
        slug: "dmr-index",
        title: "DMR Index",
        category: "Operations",
        format: "markdown",
        content: `# DMR Index\n\nRouting, BOM, specifications, work instructions, test methods, labeling masters, packaging specifications and release forms.`,
      },
      {
        slug: "dhr-template",
        title: "DHR Template",
        category: "Operations",
        format: "markdown",
        content: `# DHR Template\n\nLot/batch / serial, manufacturing traveler, acceptance records, rework, labeling, release signature and traceability evidence.`,
      },
      {
        slug: "mdr-decision-tree",
        title: "MDR Decision Tree",
        category: "Post-market",
        format: "markdown",
        content: `# MDR Decision Tree\n\n1. Is there a complaint / event?\n2. Is the device involved?\n3. Did it cause or contribute to death / serious injury?\n4. Could recurrence cause death / serious injury?\n5. Is reporting to FDA required?`,
      },
    ],
  })),
});
