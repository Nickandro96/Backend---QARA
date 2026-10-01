import express from "express";
import cors from "cors";
import * as trpcExpress from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./trpc";
import { handleStripeWebhook } from "../stripe/webhook";
import { getDb } from "../db";
import { sql } from "drizzle-orm";

const app = express();

// Railway / reverse proxy (HTTPS en frontal)
app.set("trust proxy", 1);

// ⚠️ Le webhook Stripe doit recevoir le body BRUT (vérification de signature),
// donc AVANT express.json().
const stripeWebhookBody = express.raw({ type: "application/json" });
app.post("/stripe/webhook", stripeWebhookBody, handleStripeWebhook);
// Alias explicite pour éviter une rupture lorsque le tableau de bord Stripe
// utilise le chemin documenté au pluriel.
app.post("/webhooks/stripe", stripeWebhookBody, handleStripeWebhook);

app.use(express.json());

/**
 * ✅ CORS (Vercel -> Railway) with cookies
 *
 * Rule: when credentials are used, Access-Control-Allow-Origin cannot be "*".
 * We therefore:
 *  - allow the production frontend
 *  - allow optional preview URLs
 *  - allow extra origins via ALLOWED_ORIGINS env (comma-separated)
 */
const DEFAULT_ALLOWED_ORIGINS = [
  "https://frontend-qara.vercel.app",
  // Add any fixed preview domains you use, or set ALLOWED_ORIGINS in Railway.
];

function parseAllowedOrigins(): string[] {
  const extra = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return Array.from(new Set([...DEFAULT_ALLOWED_ORIGINS, ...extra]));
}

const allowedOrigins = parseAllowedOrigins();

// Allow Vercel previews for this project (optional but practical)
const isAllowedVercelPreview = (origin: string) =>
  origin.startsWith("https://") &&
  origin.endsWith(".vercel.app") &&
  origin.includes("frontend-qara");

const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => {
    // origin undefined = server-to-server / curl / postman
    if (!origin) return cb(null, true);

    if (allowedOrigins.includes(origin) || isAllowedVercelPreview(origin)) {
      return cb(null, true);
    }

    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-trpc-source"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.get("/healthz", async (_req, res) => {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.execute(sql`SELECT 1`);
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: "connected",
    });
  } catch (error) {
    console.error("[healthz] database check failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(503).json({
      status: "error",
      timestamp: new Date().toISOString(),
      database: "disconnected",
    });
  }
});

app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  // Non-blocking background refresh (safe if sources are down).
});
