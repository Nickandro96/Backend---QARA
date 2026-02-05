import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { stripeWebhookEndpoint } from "../stripe/webhookEndpoint";
import { generatePackDGPDF } from "../pdf-generator";
import * as analyticsDb from "../db-analytics";
import { initializeDatabase } from "./initDb";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Initialize database on startup
  await initializeDatabase();

  const app = express();
  const server = createServer(app);

  app.use(cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true
  }));
  
  // Stripe webhook endpoint MUST come before body parser
  // Stripe requires raw body for signature verification
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    stripeWebhookEndpoint
  );
  
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // PDF export endpoint
  app.post("/api/analytics/export-pdf", async (req, res) => {
    try {
      const { userId, filters } = req.body;
      
      if (!userId) {
        return res.status(401).json({ error: "Non autorisé" });
      }
      
      // Get analytics data
      const kpis = await analyticsDb.getAnalyticsKPIs(userId, filters || {});
      const pareto = await analyticsDb.getParetoData(userId, filters || {});
      
      // Prepare Pack DG data
      const packData = {
        globalScore: kpis.globalScore,
        conformityRate: kpis.conformityRate,
        ncMajor: kpis.ncMajor,
        ncMinor: kpis.ncMinor,
        observations: kpis.observations,
        ofi: kpis.ofi,
        actionsOverdue: kpis.actionsOverdue,
        closureRate: kpis.closureRate,
        avgClosureDelay: kpis.avgClosureDelay,
        topRisks: pareto.slice(0, 5).map(p => ({
          clause: p.clause,
          count: p.count,
          description: `Clause ${p.clause} identifiée dans ${p.count} constats`,
        })),
        topActions: [
          { code: "CAPA-001", title: "Mettre à jour la procédure de revue de conception", dueDate: new Date().toISOString(), priority: "critical" },
          { code: "CAPA-002", title: "Former l'équipe sur les exigences MDR", dueDate: new Date().toISOString(), priority: "high" },
          { code: "CAPA-003", title: "Réviser l'évaluation des fournisseurs", dueDate: new Date().toISOString(), priority: "high" },
        ],
        insights: [
          `Score global de ${kpis.globalScore}% avec une tendance positive`,
          `${kpis.ncMajor} NC majeures nécessitent une attention immédiate`,
          `Taux de clôture des actions à ${kpis.closureRate}%`,
          `${kpis.actionsOverdue} actions en retard impactent la conformité`,
        ],
        generatedAt: new Date(),
        period: filters?.period || "12 derniers mois",
      };
      
      // Generate PDF
      const pdfBuffer = await generatePackDGPDF(packData);
      
      // Send PDF
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="Pack-DG-${new Date().toISOString().split('T')[0]}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("PDF generation error:", error);
      res.status(500).json({ error: "Erreur lors de la génération du PDF" });
    }
  });
  
  // Google Search Console verification file
  app.get("/google80eec4fa01a64b1a.html", (req, res) => {
    res.type("text/html");
    res.send("google-site-verification: google80eec4fa01a64b1a.html");
  });
  
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
