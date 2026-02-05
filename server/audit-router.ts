import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import * as schema from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

export const auditRouter = router({
  /**
   * Create a new audit
   */
  create: protectedProcedure
    .input(z.object({
      auditType: z.enum(["internal", "external", "supplier", "certification", "surveillance", "blanc"]),
      name: z.string(),
      referentialIds: z.array(z.number()).optional(),
      siteId: z.number().optional(),
      auditorName: z.string().optional(),
      auditorEmail: z.string().email().optional(),
      startDate: z.string().optional(), // ISO date string
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const [audit] = await db.insert(schema.audits).values({
        userId: ctx.user.id,
        name: input.name,
        auditType: input.auditType,
        referentialIds: input.referentialIds ? JSON.stringify(input.referentialIds) : null,
        siteId: input.siteId,
        auditorName: input.auditorName,
        auditorEmail: input.auditorEmail,
        startDate: input.startDate ? new Date(input.startDate) : null,
        notes: input.notes,
        status: "draft",
      }).$returningId();
      
      return { auditId: audit.id };
    }),

  /**
   * Get all audits for current user
   */
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["draft", "in_progress", "completed", "closed"]).optional(),
      referentialId: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      let query = db
        .select()
        .from(schema.audits)
        .where(eq(schema.audits.userId, ctx.user.id))
        .orderBy(desc(schema.audits.createdAt));

      const audits = await query;

      // Filter by status if provided
      let filtered = audits;
      if (input?.status) {
        filtered = filtered.filter(a => a.status === input.status);
      }

      // Filter by referentialId if provided
      if (input?.referentialId) {
        filtered = filtered.filter(a => {
          if (!a.referentialIds) return false;
          const ids = JSON.parse(a.referentialIds);
          return ids.includes(input.referentialId);
        });
      }

      return filtered;
    }),

  /**
   * Get single audit by ID
   */
  get: protectedProcedure
    .input(z.object({ auditId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const [audit] = await db
        .select()
        .from(schema.audits)
        .where(
          and(
            eq(schema.audits.id, input.auditId),
            eq(schema.audits.userId, ctx.user.id)
          )
        );

      if (!audit) {
        throw new Error("Audit not found");
      }

      return audit;
    }),

  /**
   * Update audit metadata
   */
  update: protectedProcedure
    .input(z.object({
      auditId: z.number(),
      name: z.string().optional(),
      status: z.enum(["draft", "in_progress", "completed", "closed"]).optional(),
      auditorName: z.string().optional(),
      auditorEmail: z.string().email().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      notes: z.string().optional(),
      score: z.number().optional(),
      conformityRate: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const { auditId, ...updates } = input;

      // Verify ownership
      const [audit] = await db
        .select()
        .from(schema.audits)
        .where(
          and(
            eq(schema.audits.id, auditId),
            eq(schema.audits.userId, ctx.user.id)
          )
        );

      if (!audit) {
        throw new Error("Audit not found");
      }

      // Prepare update object
      const updateData: any = {};
      if (updates.name) updateData.name = updates.name;
      if (updates.status) updateData.status = updates.status;
      if (updates.auditorName) updateData.auditorName = updates.auditorName;
      if (updates.auditorEmail) updateData.auditorEmail = updates.auditorEmail;
      if (updates.startDate) updateData.startDate = new Date(updates.startDate);
      if (updates.endDate) updateData.endDate = new Date(updates.endDate);
      if (updates.notes) updateData.notes = updates.notes;
      if (updates.score !== undefined) updateData.score = updates.score.toString();
      if (updates.conformityRate !== undefined) updateData.conformityRate = updates.conformityRate.toString();

      // Mark as completed if status is completed
      if (updates.status === "completed" && !audit.closedAt) {
        updateData.closedAt = new Date();
      }

      await db
        .update(schema.audits)
        .set(updateData)
        .where(eq(schema.audits.id, auditId));

      return { success: true };
    }),

  /**
   * Update audit header (metadata)
   */
  updateHeader: protectedProcedure
    .input(z.object({
      auditId: z.number(),
      siteLocation: z.string().optional(),
      clientOrganization: z.string().optional(),
      auditorName: z.string().optional(),
      auditorEmail: z.string().email().optional(),
      startDate: z.string().optional(), // ISO date string
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const { auditId, ...updates } = input;
      
      // Verify ownership
      const [audit] = await db
        .select()
        .from(schema.audits)
        .where(
          and(
            eq(schema.audits.id, auditId),
            eq(schema.audits.userId, ctx.user.id)
          )
        );

      if (!audit) {
        throw new Error("Audit not found");
      }

      // Build update object
      const updateData: any = {};
      if (updates.siteLocation !== undefined) updateData.siteLocation = updates.siteLocation;
      if (updates.clientOrganization !== undefined) updateData.clientOrganization = updates.clientOrganization;
      if (updates.auditorName !== undefined) updateData.auditorName = updates.auditorName;
      if (updates.auditorEmail !== undefined) updateData.auditorEmail = updates.auditorEmail;
      if (updates.startDate !== undefined) updateData.startDate = updates.startDate ? new Date(updates.startDate) : null;
      if (updates.notes !== undefined) updateData.notes = updates.notes;

      await db
        .update(schema.audits)
        .set(updateData)
        .where(eq(schema.audits.id, auditId));

      return { success: true };
    }),

  /**
   * Delete audit
   */
  delete: protectedProcedure
    .input(z.object({ auditId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Verify ownership
      const [audit] = await db
        .select()
        .from(schema.audits)
        .where(
          and(
            eq(schema.audits.id, input.auditId),
            eq(schema.audits.userId, ctx.user.id)
          )
        );

      if (!audit) {
        throw new Error("Audit not found");
      }

      await db
        .delete(schema.audits)
        .where(eq(schema.audits.id, input.auditId));

      return { success: true };
    }),

  /**
   * Get audit statistics
   */
  getStats: protectedProcedure
    .input(z.object({ auditId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Verify ownership
      const [audit] = await db
        .select()
        .from(schema.audits)
        .where(
          and(
            eq(schema.audits.id, input.auditId),
            eq(schema.audits.userId, ctx.user.id)
          )
        );

      if (!audit) {
        throw new Error("Audit not found");
      }

      // Get response counts from audit_responses table
      const responses = await db
        .select()
        .from(schema.auditResponses)
        .where(eq(schema.auditResponses.auditId, input.auditId));

      const stats = {
        total: responses.length,
        compliant: responses.filter(r => r.responseValue === "compliant").length,
        nonCompliant: responses.filter(r => r.responseValue === "non_compliant").length,
        partial: responses.filter(r => r.responseValue === "partial").length,
        notApplicable: responses.filter(r => r.responseValue === "not_applicable").length,
        inProgress: responses.filter(r => r.responseValue === "in_progress").length,
      };

      const complianceScore = stats.total > 0
        ? ((stats.compliant + stats.partial * 0.5) / (stats.total - stats.notApplicable)) * 100
        : 0;

      return {
        ...stats,
        complianceScore: Math.round(complianceScore * 100) / 100,
      };
    }),

  /**
   * Get dashboard statistics (all audits for user)
   */
  getDashboardStats: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Get all audits for user
      const audits = await db
        .select()
        .from(schema.audits)
        .where(eq(schema.audits.userId, ctx.user.id));

      // Get all responses for all user audits
      const allResponses = await db
        .select()
        .from(schema.auditResponses)
        .where(eq(schema.auditResponses.userId, ctx.user.id));

      // Calculate overall stats
      const totalAudits = audits.length;
      const activeAudits = audits.filter(a => a.status === "in_progress" || a.status === "draft").length;
      const completedAudits = audits.filter(a => a.status === "completed").length;

      const totalResponses = allResponses.length;
      const compliant = allResponses.filter(r => r.responseValue === "compliant").length;
      const nonCompliant = allResponses.filter(r => r.responseValue === "non_compliant").length;
      const partial = allResponses.filter(r => r.responseValue === "partial").length;
      const notApplicable = allResponses.filter(r => r.responseValue === "not_applicable").length;

      const overallComplianceRate = totalResponses > 0
        ? ((compliant + partial * 0.5) / (totalResponses - notApplicable)) * 100
        : 0;

      // Get recent audits
      const recentAudits = audits
        .sort((a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0))
        .slice(0, 5)
        .map(audit => ({
          id: audit.id,
          name: audit.name,
          status: audit.status,
          auditType: audit.auditType,
          updatedAt: audit.updatedAt,
          conformityRate: audit.conformityRate ? parseFloat(audit.conformityRate) : null,
        }));

      return {
        totalAudits,
        activeAudits,
        completedAudits,
        totalResponses,
        compliant,
        nonCompliant,
        partial,
        notApplicable,
        overallComplianceRate: Math.round(overallComplianceRate * 100) / 100,
        recentAudits,
      };
    }),

  /**
   * Generate PDF report for an audit
   */
  generatePDF: protectedProcedure
    .input(z.object({
      auditId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Get audit details
      const [audit] = await db
        .select()
        .from(schema.audits)
        .where(
          and(
            eq(schema.audits.id, input.auditId),
            eq(schema.audits.userId, ctx.user.id)
          )
        );

      if (!audit) {
        throw new Error("Audit not found");
      }

      // Get audit responses (try all tables)
      const oldResponses = await db
        .select()
        .from(schema.auditResponses)
        .where(eq(schema.auditResponses.auditId, input.auditId));

      const isoResponses = await db
        .select()
        .from(schema.isoAuditResponses)
        .where(eq(schema.isoAuditResponses.auditId, input.auditId));

      const mdrResponses = await db
        .select()
        .from(schema.mdrAuditResponses)
        .where(eq(schema.mdrAuditResponses.auditId, input.auditId));

      const allResponses = [...oldResponses, ...isoResponses, ...mdrResponses];

      // Calculate statistics
      const total = allResponses.length;
      const compliant = allResponses.filter(r => r.responseValue === "compliant").length;
      const nonCompliant = allResponses.filter(r => r.responseValue === "non_compliant").length;
      const partial = allResponses.filter(r => r.responseValue === "partial").length;
      const notApplicable = allResponses.filter(r => r.responseValue === "not_applicable").length;

      const complianceRate = total > 0
        ? ((compliant + partial * 0.5) / (total - notApplicable)) * 100
        : 0;

      // Get non-compliant responses with details
      const ncResponses = allResponses.filter(r => r.responseValue === "non_compliant" || r.responseValue === "partial");
      
      // Get question details for NC responses
      const ncDetails = await Promise.all(
        ncResponses.map(async (response) => {
          // Try to find question in questions table
          const [question] = await db
            .select()
            .from(schema.questions)
            .where(eq(schema.questions.id, response.questionId));
          
          return {
            questionId: response.questionId,
            responseValue: response.responseValue,
            comment: response.comment,
            article: question?.article || "N/A",
            questionText: question?.questionText || "Question introuvable",
            risks: question?.risks || "Non spécifié",
            criticality: question?.criticality || "medium",
          };
        })
      );

      // Sort NC by criticality (high > medium > low)
      const criticalityOrder = { high: 3, medium: 2, low: 1 };
      ncDetails.sort((a, b) => 
        (criticalityOrder[b.criticality as keyof typeof criticalityOrder] || 0) - 
        (criticalityOrder[a.criticality as keyof typeof criticalityOrder] || 0)
      );

      // Generate PDF using puppeteer
      const puppeteer = await import("puppeteer");
      const browser = await puppeteer.default.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      try {
        const page = await browser.newPage();
        
        // Create HTML content with Chart.js
        const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Rapport d'Audit - ${audit.name}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
    h1 { color: #1e40af; border-bottom: 3px solid #2563eb; padding-bottom: 10px; }
    h2 { color: #1e40af; margin-top: 30px; page-break-before: auto; }
    .meta { background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .stat { display: inline-block; margin: 10px 20px 10px 0; }
    .stat-label { font-weight: bold; color: #6b7280; }
    .stat-value { font-size: 24px; font-weight: bold; color: #1e40af; }
    .compliance-rate { font-size: 32px; color: ${complianceRate >= 85 ? '#16a34a' : complianceRate >= 70 ? '#eab308' : '#dc2626'}; }
    .chart-container { width: 400px; height: 400px; margin: 30px auto; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #1e40af; color: white; padding: 12px; text-align: left; }
    td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
    .nc-item { background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 15px 0; border-radius: 4px; page-break-inside: avoid; }
    .nc-item.high { border-left-color: #dc2626; }
    .nc-item.medium { border-left-color: #eab308; background: #fefce8; }
    .nc-item.low { border-left-color: #3b82f6; background: #eff6ff; }
    .nc-header { font-weight: bold; color: #1e40af; margin-bottom: 8px; }
    .nc-article { color: #6b7280; font-size: 14px; margin-bottom: 5px; }
    .nc-risk { color: #dc2626; font-weight: 500; margin: 8px 0; }
    .nc-comment { color: #4b5563; font-style: italic; margin-top: 8px; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .badge.high { background: #dc2626; color: white; }
    .badge.medium { background: #eab308; color: white; }
    .badge.low { background: #3b82f6; color: white; }
    .action-plan { background: #f0f9ff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
    @media print { .page-break { page-break-before: always; } }
  </style>
</head>
<body>
  <h1>📊 Rapport d'Audit</h1>
  
  <div class="meta">
    <p><strong>Audit:</strong> ${audit.name}</p>
    <p><strong>Type:</strong> ${audit.auditType}</p>
    <p><strong>Statut:</strong> ${audit.status}</p>
    ${audit.auditorName ? `<p><strong>Auditeur:</strong> ${audit.auditorName}</p>` : ''}
    ${audit.startDate ? `<p><strong>Date de début:</strong> ${new Date(audit.startDate).toLocaleDateString('fr-FR')}</p>` : ''}
  </div>
  
  <h2>Statistiques de Conformité</h2>
  
  <div class="stat">
    <div class="stat-label">Taux de conformité global</div>
    <div class="compliance-rate">${complianceRate.toFixed(1)}%</div>
  </div>
  
  <table>
    <tr>
      <th>Indicateur</th>
      <th>Valeur</th>
    </tr>
    <tr>
      <td>Total questions</td>
      <td>${total}</td>
    </tr>
    <tr>
      <td>Conforme</td>
      <td style="color: #16a34a; font-weight: bold;">${compliant}</td>
    </tr>
    <tr>
      <td>Non-Conforme</td>
      <td style="color: #dc2626; font-weight: bold;">${nonCompliant}</td>
    </tr>
    <tr>
      <td>Partiellement Conforme</td>
      <td style="color: #eab308; font-weight: bold;">${partial}</td>
    </tr>
    <tr>
      <td>Non Applicable</td>
      <td>${notApplicable}</td>
    </tr>
  </table>
  
  <div class="chart-container">
    <canvas id="complianceChart"></canvas>
  </div>
  
  <script>
    const ctx = document.getElementById('complianceChart').getContext('2d');
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Conforme', 'Non-Conforme', 'Partiellement Conforme', 'Non Applicable'],
        datasets: [{
          data: [${compliant}, ${nonCompliant}, ${partial}, ${notApplicable}],
          backgroundColor: ['#16a34a', '#dc2626', '#eab308', '#9ca3af'],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 14 }, padding: 15 } },
          title: { display: true, text: 'Répartition des Réponses', font: { size: 18 } }
        }
      }
    });
  </script>
  
  ${ncDetails.length > 0 ? `
  <div class="page-break"></div>
  <h2>⚠️ Non-Conformités Détectées (${ncDetails.length})</h2>
  <p>Ce rapport identifie <strong>${ncDetails.length} non-conformités</strong> qui nécessitent une attention immédiate et un plan d'action correctif.</p>
  
  ${ncDetails.map((nc, index) => `
    <div class="nc-item ${nc.criticality}">
      <div class="nc-header">
        ${index + 1}. ${nc.questionText}
        <span class="badge ${nc.criticality}">${nc.criticality === 'high' ? 'Critique' : nc.criticality === 'medium' ? 'Moyen' : 'Faible'}</span>
      </div>
      <div class="nc-article">📋 Article: ${nc.article}</div>
      <div class="nc-risk">⚠️ Risque: ${nc.risks}</div>
      ${nc.comment ? `<div class="nc-comment">💬 Commentaire: ${nc.comment}</div>` : ''}
    </div>
  `).join('')}
  
  <div class="action-plan">
    <h3>📋 Plan d'Action Recommandé</h3>
    <p><strong>Priorité 1 - Non-conformités critiques:</strong> Traiter immédiatement (délai: 30 jours)</p>
    <p><strong>Priorité 2 - Non-conformités moyennes:</strong> Planifier actions correctives (délai: 60 jours)</p>
    <p><strong>Priorité 3 - Non-conformités faibles:</strong> Amélioration continue (délai: 90 jours)</p>
    <p style="margin-top: 15px; color: #1e40af;"><strong>Recommandation:</strong> Mettre en place un plan d'action CAPA (Corrective and Preventive Action) pour chaque non-conformité identifiée.</p>
  </div>
  ` : '<p style="color: #16a34a; font-weight: bold; margin: 30px 0;">✅ Aucune non-conformité détectée. Excellent travail!</p>'}
  
  <div class="footer">
    <p>Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
    <p>MDR Compliance Platform - © ${new Date().getFullYear()}</p>
  </div>
</body>
</html>
        `;
        
        await page.setContent(html, { waitUntil: "networkidle0" });
        
        const pdfBuffer = await page.pdf({
          format: "A4",
          printBackground: true,
          margin: {
            top: "20mm",
            right: "15mm",
            bottom: "20mm",
            left: "15mm",
          },
        });

        // Return base64 encoded PDF
        return {
          pdf: Buffer.from(pdfBuffer).toString('base64'),
          filename: `audit-${audit.name.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.pdf`,
        };
      } finally {
        await browser.close();
      }
    }),

  /**
   * Get AI-powered recommendations for non-conformities
   */
  getAIRecommendations: protectedProcedure
    .input(z.object({
      auditId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { invokeLLM } = await import("./_core/llm");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get audit details
      const [audit] = await db
        .select()
        .from(schema.audits)
        .where(
          and(
            eq(schema.audits.id, input.auditId),
            eq(schema.audits.userId, ctx.user.id)
          )
        );

      if (!audit) {
        throw new Error("Audit not found");
      }

      // Get all responses
      const oldResponses = await db
        .select()
        .from(schema.auditResponses)
        .where(eq(schema.auditResponses.auditId, input.auditId));

      const isoResponses = await db
        .select()
        .from(schema.isoAuditResponses)
        .where(eq(schema.isoAuditResponses.auditId, input.auditId));

      const mdrResponses = await db
        .select()
        .from(schema.mdrAuditResponses)
        .where(eq(schema.mdrAuditResponses.auditId, input.auditId));

      const allResponses = [...oldResponses, ...isoResponses, ...mdrResponses];

      // Get NC responses with details
      const ncResponses = allResponses.filter(r => r.responseValue === "non_compliant" || r.responseValue === "partial");
      
      const ncDetails = await Promise.all(
        ncResponses.map(async (response) => {
          const [question] = await db
            .select()
            .from(schema.questions)
            .where(eq(schema.questions.id, response.questionId));
          
          return {
            article: question?.article || "N/A",
            questionText: question?.questionText || "Question introuvable",
            risks: question?.risks || "Non spécifié",
            criticality: question?.criticality || "medium",
            comment: response.comment,
          };
        })
      );

      if (ncDetails.length === 0) {
        return {
          recommendations: "Aucune non-conformité détectée. Continuez vos bonnes pratiques!",
        };
      }

      // Build prompt for LLM
      const prompt = `Tu es un expert en conformité réglementaire pour les dispositifs médicaux (MDR, ISO 13485, ISO 9001).

Audit: ${audit.name}
Type: ${audit.auditType}

Non-conformités détectées (${ncDetails.length}):

${ncDetails.map((nc, i) => `
${i + 1}. Article ${nc.article}
   Question: ${nc.questionText}
   Risque: ${nc.risks}
   Criticité: ${nc.criticality}
   ${nc.comment ? `Commentaire: ${nc.comment}` : ''}
`).join('')}

Génère un plan d'action CAPA (Corrective and Preventive Action) détaillé avec:
1. Actions correctives immédiates (priorité haute)
2. Actions préventives à moyen terme
3. Recommandations pour améliorer le SMQ
4. Délais suggérés et responsabilités

Format: Markdown avec sections claires.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "Tu es un expert en conformité réglementaire pour dispositifs médicaux." },
          { role: "user", content: prompt },
        ],
      });

      const recommendations = response.choices[0]?.message?.content || "Erreur lors de la génération des recommandations.";

      return {
        recommendations,
      };
    }),
});
