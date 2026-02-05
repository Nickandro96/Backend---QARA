import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import * as analyticsDb from "./db-analytics";
import * as dashboardDb from "./db-dashboard";
import * as dashboardV2 from "./db-dashboard-v2";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { invokeLLM } from "./_core/llm";
import { deviceClassifications } from "../drizzle/schema";
import { getDb } from "./db";
import { stripeRouter } from "./stripe/router";
import { fdaRouter } from "./fda-router";
import { mdrRouter } from "./mdr-router";
import { isoRouter } from "./iso-router";
import { auditRouter } from "./audit-router";
import { generateAuditReport } from "./report-generator";
import { auditReports } from "../drizzle/schema";
import { storagePut as uploadToS3 } from "./storage";

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { 
        ...cookieOptions, 
        maxAge: -1,
        httpOnly: true,
        secure: true,
        sameSite: "none"
      });
      return { success: true } as const;
    }),
  }),

  profile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserProfile(ctx.user.id);
    }),
    
    update: protectedProcedure
      .input(z.object({
        economicRole: z.enum(["fabricant", "importateur", "distributeur"]).optional(),
        companyName: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.upsertUserProfile(ctx.user.id, input);
        return { success: true };
      }),
  }),

  referentials: router({
    list: publicProcedure.query(async () => {
      return await db.getAllReferentials();
    }),
  }),

  processes: router({
    list: publicProcedure.query(async () => {
      return await db.getAllProcesses();
    }),
  }),

  questions: router({
    list: protectedProcedure
      .input(
        z.object({
          referentialId: z.number().optional(),
          processId: z.number().optional(),
          economicRole: z.enum(["fabricant", "importateur", "distributeur", "manufacturer_us", "specification_developer", "contract_manufacturer", "initial_importer"]).optional(),
        })
      )
      .query(async ({ input }) => {
        // Inclure les questions "tous" + questions spécifiques au rôle
        return await db.getQuestions(input);
      }),

    getById: protectedProcedure
      .input(z.object({ questionId: z.number() }))
      .query(async ({ input }) => {
        return await db.getQuestionById(input.questionId);
      }),
  }),

  audit: router({
    getResponse: protectedProcedure
      .input(z.object({
        questionId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        return await db.getUserResponse(ctx.user.id, input.questionId);
      }),

    saveResponse: protectedProcedure
      .input(
        z.object({
          questionId: z.number(),
          response: z.string().optional(), // Champ réponse/note
          status: z.enum(["conforme", "nok", "na"]),
          comment: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.upsertAuditResponse(ctx.user.id, input.questionId, {
          response: input.response,
          status: input.status,
          comment: input.comment,
        });
        
        // Award badge for first audit response
        const responses = await db.getUserResponses(ctx.user.id);
        if (responses.length === 1) {
          await db.awardBadge(ctx.user.id, "first_audit");
        }
        
        return { success: true };
      }),

    getResponses: protectedProcedure
      .input(z.object({
        questionIds: z.array(z.number()).optional(),
      }))
      .query(async ({ ctx, input }) => {
        return await db.getUserResponses(ctx.user.id, input.questionIds);
      }),

    getScore: protectedProcedure
      .input(z.object({
        referentialId: z.number().optional(),
        processId: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        // Get all questions for the filter
        const profile = await db.getUserProfile(ctx.user.id);
        const questions = await db.getQuestions({
          ...input,
          economicRole: profile?.economicRole || undefined,
        });
        
        const questionIds = questions.map(q => q.id);
        const responses = await db.getUserResponses(ctx.user.id, questionIds);
        
        const total = questions.length;
        const answered = responses.length;
        const conforme = responses.filter(r => r.status === "conforme").length;
        const nok = responses.filter(r => r.status === "nok").length;
        const na = responses.filter(r => r.status === "na").length;
        
        // Calculate compliance score (excluding NA)
        const applicable = total - na;
        const score = applicable > 0 ? (conforme / applicable) * 100 : 0;
        
        return {
          total,
          answered,
          conforme,
          nok,
          na,
          score: Math.round(score * 100) / 100,
          progress: total > 0 ? (answered / total) * 100 : 0,
        };
      }),

    getById: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        return await db.getAuditById(input.id, ctx.user.id, ctx.user.role);
      }),

    getRecentAudits: protectedProcedure
      .input(z.object({
        limit: z.number().optional().default(5),
      }))
      .query(async ({ ctx, input }) => {
        return await db.getRecentAudits(ctx.user.id, input.limit, ctx.user.role);
      }),

    listAudits: protectedProcedure
      .input(z.object({
        status: z.string().optional(),
        siteId: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        search: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        return await db.getAuditsList(ctx.user.id, ctx.user.role, input);
      }),
  }),

  findings: router({
    list: protectedProcedure
      .input(z.object({
        auditId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        return await db.getFindingsByAudit(input.auditId, ctx.user.id);
      }),
  }),

  actions: router({
    list: protectedProcedure
      .input(z.object({
        auditId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        return await db.getActionsByAudit(input.auditId, ctx.user.id);
      }),
  }),

  evidence: router({
    list: protectedProcedure
      .input(z.object({
        questionId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        return await db.getEvidenceFiles(ctx.user.id, input.questionId);
      }),

    upload: protectedProcedure
      .input(z.object({
        questionId: z.number(),
        fileName: z.string(),
        fileData: z.string(), // base64
        mimeType: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Decode base64
        const buffer = Buffer.from(input.fileData, 'base64');
        
        // Generate unique file key
        const fileKey = `evidence/${ctx.user.id}/${input.questionId}/${nanoid()}-${input.fileName}`;
        
        // Upload to S3
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        
        // Save to database
        await db.addEvidenceFile({
          userId: ctx.user.id,
          questionId: input.questionId,
          fileName: input.fileName,
          fileKey,
          fileUrl: url,
          fileSize: buffer.length,
          mimeType: input.mimeType,
        });
        
        return { success: true, url };
      }),

    delete: protectedProcedure
      .input(z.object({
        fileId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteEvidenceFile(input.fileId, ctx.user.id);
        return { success: true };
      }),
  }),

  badges: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserBadges(ctx.user.id);
    }),
  }),

  ai: router({
    getRecommendation: protectedProcedure
      .input(z.object({
        questionId: z.number(),
        context: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const question = await db.getQuestionById(input.questionId);
        if (!question) {
          throw new Error("Question not found");
        }

        const profile = await db.getUserProfile(ctx.user.id);
        const response = await db.getUserResponse(ctx.user.id, input.questionId);

        const prompt = question.aiPrompt || `Expliquez cette exigence réglementaire pour un ${profile?.economicRole || 'fabricant'}.`;
        
        const systemPrompt = `Vous êtes un expert en conformité réglementaire MDR et ISO 13485. 
Votre rôle est d'aider les professionnels des dispositifs médicaux à comprendre et appliquer les exigences réglementaires.
Soyez précis, concret et donnez des exemples pratiques.`;

        const userPrompt = `
Question d'audit : ${question.questionText}
Article/Clause : ${question.article}
Rôle économique : ${profile?.economicRole || 'fabricant'}
Statut actuel : ${response?.status || 'non répondu'}
${input.context ? `Contexte additionnel : ${input.context}` : ''}

${prompt}

Fournissez :
1. Une explication claire de l'exigence
2. Des exemples de preuves acceptables
3. ${response?.status === 'nok' ? 'Un plan d\'action détaillé pour corriger la non-conformité' : 'Des suggestions d\'amélioration'}
`;

        const llmResponse = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });

        return {
          recommendation: llmResponse.choices[0]?.message?.content || "Aucune recommandation disponible",
        };
      }),
  }),

  regulatory: router({
    list: protectedProcedure
      .input(z.object({
        referentialId: z.number().optional(),
        processId: z.number().optional(),
        impactLevel: z.enum(['high', 'medium', 'low']).optional(),
        status: z.enum(['acte', 'a_venir', 'en_consultation']).optional(),
        region: z.enum(['EU', 'US']).optional(),
        search: z.string().optional(),
        limit: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getRegulatoryUpdates(input);
      }),

    getAlertPreferences: protectedProcedure
      .query(async ({ ctx }) => {
        return await db.getWatchAlertPreferences(ctx.user.id);
      }),

    updateAlertPreferences: protectedProcedure
      .input(z.object({
        emailEnabled: z.boolean(),
        minImpactLevel: z.enum(['high', 'medium', 'low']),
        regions: z.array(z.enum(['EU', 'US'])),
        referentialIds: z.array(z.number()).optional(),
        processIds: z.array(z.number()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.upsertWatchAlertPreferences({
          userId: ctx.user.id,
          ...input,
        });
      }),

    getStats: protectedProcedure
      .query(async () => {
        return await db.getRegulatoryStats();
      }),
  }),

  sprints: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserSprints(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        targetScore: z.number(),
        startDate: z.date(),
        endDate: z.date(),
        processId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createSprint({
          userId: ctx.user.id,
          name: input.name,
          targetScore: input.targetScore.toString(),
          startDate: input.startDate,
          endDate: input.endDate,
          processId: input.processId,
        });
        return { success: true };
      }),
  }),
  
  classification: router({
    classify: protectedProcedure
      .input(z.object({
        device_name: z.string().optional(),
        device_description: z.string().optional(),
        device_type: z.enum(["dm", "accessoire"]).optional(),
        is_active: z.boolean().optional(),
        is_software: z.boolean().optional(),
        invasiveness: z.enum(["non-invasif", "invasif_orifice", "chirurgical"]).optional(),
        implantable: z.boolean().optional(),
        duration: z.enum(["transitoire", "court_terme", "long_terme"]).optional(),
        contact_site: z.array(z.string()).optional(),
        wound_depth: z.enum(["superficielle", "profonde"]).optional(),
        function: z.array(z.string()).optional(),
        danger_level: z.enum(["potentiellement_dangereux", "normal"]).optional(),
        provided_sterile: z.boolean().optional(),
        has_measuring_function: z.boolean().optional(),
        reusable_surgical: z.boolean().optional(),
        incorporates_drug: z.boolean().optional(),
        incorporates_blood_derivative: z.boolean().optional(),
        contains_absorbable_substance: z.boolean().optional(),
        contains_nanomaterials: z.boolean().optional(),
        high_internal_exposure: z.boolean().optional(),
        contains_animal_tissue: z.boolean().optional(),
        biological_effect: z.boolean().optional(),
        software_purpose: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { classifyDevice } = await import("./classification-engine");
        const result = classifyDevice(input);
        
        const db = await getDb();
        if (db && input.device_name) {
          await db.insert(deviceClassifications).values({
            userId: ctx.user.id,
            deviceName: input.device_name,
            deviceDescription: input.device_description || null,
            resultingClass: result.resultingClass,
            appliedRules: JSON.stringify(result.appliedRules.map(r => r.id)),
            answers: JSON.stringify(input),
            justification: result.justification,
          });
        }
        
        return result;
      }),
    
    exportExcel: protectedProcedure
      .input(z.object({
        device_name: z.string().optional(),
        device_description: z.string().optional(),
        device_type: z.enum(["dm", "accessoire"]).optional(),
        is_active: z.boolean().optional(),
        is_software: z.boolean().optional(),
        invasiveness: z.enum(["non-invasif", "invasif_orifice", "chirurgical"]).optional(),
        implantable: z.boolean().optional(),
        duration: z.enum(["transitoire", "court_terme", "long_terme"]).optional(),
        contact_site: z.array(z.string()).optional(),
        function: z.array(z.string()).optional(),
        provided_sterile: z.boolean().optional(),
        has_measuring_function: z.boolean().optional(),
        reusable_surgical: z.boolean().optional(),
        incorporates_drug: z.boolean().optional(),
        incorporates_blood_derivative: z.boolean().optional(),
        contains_absorbable_substance: z.boolean().optional(),
        contains_nanomaterials: z.boolean().optional(),
        high_internal_exposure: z.boolean().optional(),
        contains_animal_tissue: z.boolean().optional(),
        biological_effect: z.boolean().optional(),
        software_purpose: z.array(z.string()).optional(),
      }))
      .query(async ({ input }) => {
        const { classifyDevice } = await import("./classification-engine");
        const { generateClassificationExcel } = await import("./classification-exports");
        
        const result = classifyDevice(input);
        const csv = generateClassificationExcel(input, result);
        
        return { csv, filename: `classification_${input.device_name || "dispositif"}_${Date.now()}.csv` };
      }),
    
    exportPDF: protectedProcedure
      .input(z.object({
        device_name: z.string().optional(),
        device_description: z.string().optional(),
        device_type: z.enum(["dm", "accessoire"]).optional(),
        is_active: z.boolean().optional(),
        is_software: z.boolean().optional(),
        invasiveness: z.enum(["non-invasif", "invasif_orifice", "chirurgical"]).optional(),
        implantable: z.boolean().optional(),
        duration: z.enum(["transitoire", "court_terme", "long_terme"]).optional(),
        contact_site: z.array(z.string()).optional(),
        function: z.array(z.string()).optional(),
        provided_sterile: z.boolean().optional(),
        has_measuring_function: z.boolean().optional(),
        reusable_surgical: z.boolean().optional(),
        incorporates_drug: z.boolean().optional(),
        incorporates_blood_derivative: z.boolean().optional(),
        contains_absorbable_substance: z.boolean().optional(),
        contains_nanomaterials: z.boolean().optional(),
        high_internal_exposure: z.boolean().optional(),
        contains_animal_tissue: z.boolean().optional(),
        biological_effect: z.boolean().optional(),
        software_purpose: z.array(z.string()).optional(),
      }))
      .query(async ({ input }) => {
        const { classifyDevice } = await import("./classification-engine");
        const { generateClassificationPDF } = await import("./classification-exports");
        
        const result = classifyDevice(input);
        const markdown = generateClassificationPDF(input, result);
        
        return { markdown, filename: `classification_${input.device_name || "dispositif"}_${Date.now()}.md` };
      }),
  }),
  
  // Documents obligatoires router
  documents: router({
    getAll: protectedProcedure
      .input(z.object({
        referentialId: z.number().optional(),
        processId: z.number().optional(),
        role: z.string().optional(),
        status: z.string().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        return await db.getMandatoryDocuments(input || {});
      }),
    
    getById: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .query(async ({ input }) => {
        return await db.getDocumentById(input.documentId);
      }),
    
    getUserStatus: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .query(async ({ input, ctx }) => {
        return await db.getUserDocumentStatus(ctx.user.id, input.documentId);
      }),
    
    updateStatus: protectedProcedure
      .input(z.object({
        documentId: z.number(),
        status: z.enum(["manquant", "a_mettre_a_jour", "conforme"]),
        notes: z.string().optional(),
        fileUrl: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateDocumentStatus({
          userId: ctx.user.id,
          documentId: input.documentId,
          status: input.status,
          notes: input.notes,
          fileUrl: input.fileUrl,
        });
        return { success: true };
      }),
    
    getStats: protectedProcedure
      .input(z.object({ role: z.string().optional() }).optional())
      .query(async ({ input, ctx }) => {
        return await db.getDocumentStats(ctx.user.id, input?.role);
      }),
    
    explainDocument: protectedProcedure
      .input(z.object({
        documentId: z.number(),
      }))
      .query(async ({ input }) => {
        const { explainDocument } = await import("./document-ai");
        const document = await db.getDocumentById(input.documentId);
        
        if (!document) {
          throw new Error("Document not found");
        }
        
        const referentials = await db.getAllReferentials();
        const processes = await db.getAllProcesses();
        const referential = referentials.find(r => r.id === document.referentialId);
        const process = document.processId ? processes.find(p => p.id === document.processId) : null;
        
        return await explainDocument(
          document.documentName,
          document.objective || "",
          referential?.name || "",
          process?.name || "Tous processus",
          document.role || "tous"
        );
      }),
    
    checkCoherence: protectedProcedure
      .input(z.object({
        documentId: z.number(),
      }))
      .query(async ({ input }) => {
        const { checkDocumentCoherence } = await import("./document-ai");
        const document = await db.getDocumentById(input.documentId);
        
        if (!document) {
          throw new Error("Document not found");
        }
        
        // Récupérer les documents connexes (même processus)
        const relatedDocs = await db.getMandatoryDocuments({
          processId: document.processId || undefined,
          referentialId: document.referentialId,
        });
        
        const relatedNames = relatedDocs
          .filter(d => d.id !== document.id)
          .slice(0, 5)
          .map(d => d.documentName);
        
        return await checkDocumentCoherence(document.documentName, relatedNames);
      }),
    
    // Get documents related to a question
    getRelatedDocuments: publicProcedure
      .input(z.object({
        questionId: z.number(),
      }))
      .query(async ({ input, ctx }) => {
        const question = await db.getQuestionById(input.questionId);
        if (!question) {
          return [];
        }
        
        const processes = await db.getAllProcesses();
        const referentials = await db.getAllReferentials();
        const process = question.processId ? processes.find(p => p.id === question.processId) : null;
        const referential = referentials.find(r => r.id === question.referentialId);
        
        // Import dynamique pour éviter les erreurs de dépendances circulaires
        const { getRequiredDocumentsForQuestion } = await import("../shared/question-document-mapping");
        
        const documentNames = getRequiredDocumentsForQuestion(
          question.id,
          process?.name,
          referential?.name
        );
        
        // Récupérer les documents correspondants
        const allDocs = await db.getMandatoryDocuments({
          processId: question.processId || undefined,
          referentialId: question.referentialId,
        });
        
        // Filtrer par nom de document
        return allDocs.filter(doc => 
          documentNames.some(name => 
            doc.documentName.toLowerCase().includes(name.toLowerCase()) ||
            name.toLowerCase().includes(doc.documentName.toLowerCase())
          )
        );
      }),
  }),

  // FDA Classification router
  fdaClassification: router({
    save: protectedProcedure
      .input(z.object({
        deviceName: z.string(),
        deviceDescription: z.string(),
        intendedUse: z.string(),
        deviceClass: z.enum(["I", "II", "III"]),
        pathway: z.enum(["Exempt", "510(k)", "De Novo", "PMA"]),
        predicateDevice: z.string().nullable(),
        predicate510k: z.string().nullable(),
        justification: z.string(),
        answers: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.saveFdaClassification({
          userId: ctx.user.id,
          deviceName: input.deviceName,
          deviceDescription: input.deviceDescription,
          intendedUse: input.intendedUse,
          deviceClass: input.deviceClass,
          pathway: input.pathway,
          predicateDevice: input.predicateDevice,
          predicate510k: input.predicate510k,
          justification: input.justification,
          answers: input.answers,
        });
        
        return { success: true };
      }),
    
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getFdaClassifications(ctx.user.id);
    }),
  }),

  // FDA Regulatory Watch router
  fdaRegulatoryWatch: router({
    list: protectedProcedure
      .input(z.object({
        category: z.string().optional(),
        impactLevel: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getFdaRegulatoryUpdates(input || {});
      }),
  }),

  // Demo router for FREE users
  demo: router({
    checkUsage: protectedProcedure.query(async ({ ctx }) => {
      return await db.getDemoUsage(ctx.user.id);
    }),
    
    getQuestions: protectedProcedure.query(async ({ ctx }) => {
      // Get 5 ISO 13485 questions for demo
      const iso13485 = await db.getReferentialByCode("ISO_13485");
      if (!iso13485) return [];
      
      const allQuestions = await db.getQuestions({
        referentialId: iso13485.id,
        economicRole: "fabricant",
      });
      
      // Return only first 5 questions
      return allQuestions.slice(0, 5);
    }),
    
    markAsUsed: protectedProcedure.mutation(async ({ ctx }) => {
      await db.markDemoAsUsed(ctx.user.id);
      return { success: true };
    }),
  }),

  // Contact form router
  contact: router({
    submit: publicProcedure
      .input(z.object({
        name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
        email: z.string().email("Email invalide"),
        company: z.string().optional(),
        subject: z.enum(["demo", "support", "partnership", "pricing", "other"]),
        message: z.string().min(10, "Le message doit contenir au moins 10 caractères"),
      }))
      .mutation(async ({ ctx, input }) => {
        // Import notification helper
        const { notifyOwner } = await import("./_core/notification");
        
        // Save to database
        await db.createContactMessage({
          name: input.name,
          email: input.email,
          company: input.company,
          subject: input.subject,
          message: input.message,
          userId: ctx.user?.id,
        });
        
        // Notify owner
        const subjectLabels: Record<string, string> = {
          demo: "Demande de démo",
          support: "Support technique",
          partnership: "Partenariat",
          pricing: "Question tarifs",
          other: "Autre",
        };
        
        await notifyOwner({
          title: `Nouveau message de contact: ${subjectLabels[input.subject]}`,
          content: `**De:** ${input.name} (${input.email})\n**Entreprise:** ${input.company || "Non spécifiée"}\n**Sujet:** ${subjectLabels[input.subject]}\n\n**Message:**\n${input.message}`,
        });
        
        return { success: true };
      }),
      
    list: protectedProcedure
      .input(z.object({
        status: z.string().optional(),
        limit: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        // Only admin can list messages
        if (ctx.user.role !== "admin") {
          throw new Error("Accès non autorisé");
        }
        return await db.getContactMessages(input);
      }),
      
    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["new", "read", "replied", "archived"]),
      }))
      .mutation(async ({ ctx, input }) => {
        // Only admin can update status
        if (ctx.user.role !== "admin") {
          throw new Error("Accès non autorisé");
        }
        await db.updateContactMessageStatus(input.id, input.status);
        return { success: true };
      }),
  }),

  // Analytics dashboard router
  analytics: router({
    getKPIs: protectedProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        siteIds: z.array(z.number()).optional(),
        processIds: z.array(z.number()).optional(),
        referentialIds: z.array(z.number()).optional(),
        auditType: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        return await analyticsDb.getAnalyticsKPIs(ctx.user.id, input);
      }),

    getSitePerformance: protectedProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ ctx, input }) => {
        return await analyticsDb.getSitePerformance(ctx.user.id, input);
      }),

    getProcessPerformance: protectedProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ ctx, input }) => {
        return await analyticsDb.getProcessPerformance(ctx.user.id, input);
      }),

    getFindings: protectedProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        status: z.string().optional(),
        findingType: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        return await analyticsDb.getFilteredFindings(ctx.user.id, input);
      }),

    getTrends: protectedProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ ctx, input }) => {
        return await analyticsDb.getTrendData(ctx.user.id, input);
      }),

    getHeatmap: protectedProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ ctx, input }) => {
        return await analyticsDb.getHeatmapData(ctx.user.id, input);
      }),

    getPareto: protectedProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ ctx, input }) => {
        return await analyticsDb.getParetoData(ctx.user.id, input);
      }),
  }),

  // Dashboard router (main dashboard with real data)
  dashboard: router({
    // Legacy endpoints (kept for backward compatibility)
    getKPIs: protectedProcedure.query(async ({ ctx }) => {
      return await dashboardDb.getDashboardKPIs(ctx.user.id);
    }),

    getProcessProgress: protectedProcedure.query(async ({ ctx }) => {
      return await dashboardDb.getProcessProgress(ctx.user.id);
    }),

    getScoreTrend: protectedProcedure.query(async ({ ctx }) => {
      return await dashboardDb.getScoreTrend(ctx.user.id);
    }),

    getRecentFindings: protectedProcedure
      .input(z.object({
        limit: z.number().optional().default(10),
      }))
      .query(async ({ ctx, input }) => {
        return await dashboardDb.getRecentFindings(ctx.user.id, input.limit);
      }),

    getProcessDetails: protectedProcedure
      .input(z.object({
        processId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        return await dashboardDb.getProcessDetails(ctx.user.id, input.processId);
      }),

    // V2 endpoints (new dashboard based on audits)
    getSummary: protectedProcedure
      .input(z.object({
        market: z.enum(["eu", "us", "all"]).optional(),
        referentialIds: z.array(z.number()).optional(),
        economicRole: z.enum(["fabricant", "importateur", "distributeur", "all"]).optional(),
        period: z.object({
          start: z.date(),
          end: z.date(),
        }).optional(),
        siteId: z.number().optional(),
        auditStatus: z.enum(["draft", "in_progress", "completed", "closed", "all"]).optional(),
        criticality: z.enum(["critical", "high", "medium", "low", "all"]).optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return await dashboardV2.getDashboardSummary(ctx.user.id, input);
      }),

    getFunnel: protectedProcedure
      .input(z.object({
        market: z.enum(["eu", "us", "all"]).optional(),
        referentialIds: z.array(z.number()).optional(),
        economicRole: z.enum(["fabricant", "importateur", "distributeur", "all"]).optional(),
        period: z.object({
          start: z.date(),
          end: z.date(),
        }).optional(),
        siteId: z.number().optional(),
        auditStatus: z.enum(["draft", "in_progress", "completed", "closed", "all"]).optional(),
        criticality: z.enum(["critical", "high", "medium", "low", "all"]).optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return await dashboardV2.getDashboardFunnel(ctx.user.id, input);
      }),

    getTimeseries: protectedProcedure
      .input(z.object({
        filters: z.object({
          market: z.enum(["eu", "us", "all"]).optional(),
          referentialIds: z.array(z.number()).optional(),
          economicRole: z.enum(["fabricant", "importateur", "distributeur", "all"]).optional(),
          period: z.object({
            start: z.date(),
            end: z.date(),
          }).optional(),
          siteId: z.number().optional(),
          auditStatus: z.enum(["draft", "in_progress", "completed", "closed", "all"]).optional(),
          criticality: z.enum(["critical", "high", "medium", "low", "all"]).optional(),
        }).optional(),
        granularity: z.enum(["month", "week"]).optional().default("month"),
      }))
      .query(async ({ ctx, input }) => {
        return await dashboardV2.getDashboardTimeseries(ctx.user.id, input.filters, input.granularity);
      }),

    getHeatmap: protectedProcedure
      .input(z.object({
        market: z.enum(["eu", "us", "all"]).optional(),
        referentialIds: z.array(z.number()).optional(),
        economicRole: z.enum(["fabricant", "importateur", "distributeur", "all"]).optional(),
        period: z.object({
          start: z.date(),
          end: z.date(),
        }).optional(),
        siteId: z.number().optional(),
        auditStatus: z.enum(["draft", "in_progress", "completed", "closed", "all"]).optional(),
        criticality: z.enum(["critical", "high", "medium", "low", "all"]).optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return await dashboardV2.getDashboardHeatmap(ctx.user.id, input);
      }),

    getRadar: protectedProcedure
      .input(z.object({
        market: z.enum(["eu", "us", "all"]).optional(),
        referentialIds: z.array(z.number()).optional(),
        economicRole: z.enum(["fabricant", "importateur", "distributeur", "all"]).optional(),
        period: z.object({
          start: z.date(),
          end: z.date(),
        }).optional(),
        siteId: z.number().optional(),
        auditStatus: z.enum(["draft", "in_progress", "completed", "closed", "all"]).optional(),
        criticality: z.enum(["critical", "high", "medium", "low", "all"]).optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return await dashboardV2.getDashboardRadar(ctx.user.id, input);
      }),

    getDrilldown: protectedProcedure
      .input(z.object({
        type: z.enum(["findings", "actions", "audits"]),
        filters: z.object({
          processId: z.number().optional(),
          findingType: z.string().optional(),
          criticality: z.string().optional(),
          status: z.string().optional(),
          siteId: z.number().optional(),
        }).optional(),
        pagination: z.object({
          page: z.number(),
          pageSize: z.number(),
        }),
        sort: z.object({
          field: z.string(),
          order: z.enum(["asc", "desc"]),
        }),
      }))
      .query(async ({ ctx, input }) => {
        return await dashboardV2.getDashboardDrilldown(
          ctx.user.id,
          input.type,
          input.filters || {},
          input.pagination,
          input.sort
        );
      }),

    getScoring: protectedProcedure
      .input(z.object({
        market: z.enum(["eu", "us", "all"]).optional(),
        referentialIds: z.array(z.number()).optional(),
        economicRole: z.enum(["fabricant", "importateur", "distributeur", "all"]).optional(),
        period: z.object({
          start: z.date(),
          end: z.date(),
        }).optional(),
        siteId: z.number().optional(),
        auditStatus: z.enum(["draft", "in_progress", "completed", "closed", "all"]).optional(),
        criticality: z.enum(["critical", "high", "medium", "low", "all"]).optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return await dashboardV2.getDashboardScoring(ctx.user.id, input);
      }),

    getSuggestions: protectedProcedure
      .input(z.object({
        market: z.enum(["eu", "us", "all"]).optional(),
        referentialIds: z.array(z.number()).optional(),
        economicRole: z.enum(["fabricant", "importateur", "distributeur", "all"]).optional(),
        period: z.object({
          start: z.date(),
          end: z.date(),
        }).optional(),
        siteId: z.number().optional(),
        auditStatus: z.enum(["draft", "in_progress", "completed", "closed", "all"]).optional(),
        criticality: z.enum(["critical", "high", "medium", "low", "all"]).optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return await dashboardV2.getDashboardSuggestions(ctx.user.id, input);
      }),
  }),

  // Stripe payment router
  stripe: stripeRouter,

  // FDA Audit System
  fda: fdaRouter,

  // MDR Audit System
  mdr: mdrRouter,

  // ISO Audit System (9001 + 13485)
  iso: isoRouter,

  // Audit Management (create, list, update audits)
  auditManagement: auditRouter,

  // Audit Reports Generation
  reports: router({
    // Generate audit report
    generate: protectedProcedure
      .input(z.object({
        auditId: z.number(),
        reportType: z.enum(["complete", "executive", "comparative", "action_plan", "evidence_index"]),
        includeGraphs: z.boolean().optional().default(true),
        includeEvidence: z.boolean().optional().default(true),
        includeActionPlan: z.boolean().optional().default(true),
        comparedAuditIds: z.array(z.number()).optional(),
        language: z.enum(["fr", "en"]).optional().default("fr"),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          // Generate PDF
          const pdfBuffer = await generateAuditReport(input);

          // Upload to S3
          const fileName = `audit-report-${input.auditId}-${Date.now()}.pdf`;
          const fileKey = `reports/${ctx.user.id}/${fileName}`;
          const { url: fileUrl } = await uploadToS3(fileKey, pdfBuffer, "application/pdf");

          // Save report metadata to database
          const database = await getDb();
          const [report] = await database.insert(auditReports).values({
            auditId: input.auditId,
            userId: ctx.user.id,
            reportType: input.reportType,
            reportTitle: `Rapport d'audit #${input.auditId}`,
            reportVersion: "1.0",
            fileKey,
            fileUrl,
            fileSize: pdfBuffer.length,
            fileFormat: "pdf",
            generatedBy: ctx.user.id,
            metadata: JSON.stringify({
              includeGraphs: input.includeGraphs,
              includeEvidence: input.includeEvidence,
              includeActionPlan: input.includeActionPlan,
            }),
          }).returning();

          return {
            success: true,
            reportId: report.id,
            fileUrl,
            fileName,
          };
        } catch (error: any) {
          console.error("[Reports] Generate error:", error);
          throw new Error(`Failed to generate report: ${error.message}`);
        }
      }),

    // Get report history
    list: protectedProcedure
      .input(z.object({
        auditId: z.number().optional(),
        limit: z.number().optional().default(50),
      }))
      .query(async ({ ctx, input }) => {
        const database = await getDb();
        let query = database
          .select()
          .from(auditReports)
          .where(eq(auditReports.userId, ctx.user.id))
          .orderBy(auditReports.generatedAt)
          .limit(input.limit);

        if (input.auditId) {
          query = query.where(eq(auditReports.auditId, input.auditId));
        }

        const reports = await query;
        return reports;
      }),

    // Get single report
    get: protectedProcedure
      .input(z.object({ reportId: z.number() }))
      .query(async ({ ctx, input }) => {
        const database = await getDb();
        const [report] = await database
          .select()
          .from(auditReports)
          .where(
            and(
              eq(auditReports.id, input.reportId),
              eq(auditReports.userId, ctx.user.id)
            )
          );

        if (!report) {
          throw new Error("Report not found");
        }

        return report;
      }),

    // Delete report
    delete: protectedProcedure
      .input(z.object({ reportId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const database = await getDb();
        await database
          .delete(auditReports)
          .where(
            and(
              eq(auditReports.id, input.reportId),
              eq(auditReports.userId, ctx.user.id)
            )
          );

        return { success: true };
      }),

    // Compare two audits
    compare: protectedProcedure
      .input(z.object({
        audit1Id: z.number(),
        audit2Id: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const comparison = await db.compareAudits(input.audit1Id, input.audit2Id, ctx.user.id);
        if (!comparison) {
          throw new Error("Unable to compare audits. Make sure both audits exist and belong to you.");
        }
        return comparison;
      }),
  }),
});

export type AppRouter = typeof appRouter;
