import express from "express";
import cors from "cors";
import * as trpcExpress from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./trpc";
import { handleStripeWebhook } from "../stripe/webhook";

const app = express();

// Railway / reverse proxy (HTTPS en frontal)
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));

// ⚠️ Le webhook Stripe doit recevoir le body BRUT (vérification de signature),
// donc AVANT express.json().
app.post("/stripe/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);

app.use(express.json({ limit: "1mb" }));

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

const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => {
    // origin undefined = server-to-server / curl / postman
    if (!origin) return cb(null, true);

    if (allowedOrigins.includes(origin)) {
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

app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const corsRejected = err instanceof Error && err.message.startsWith("CORS blocked");
  res.status(corsRejected ? 403 : 500).json({ error: corsRejected ? "Origine refusée." : "Erreur interne." });
});

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  // Non-blocking background refresh (safe if sources are down).
});
