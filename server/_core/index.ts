import express from "express";
import cors from "cors";
import * as trpcExpress from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./trpc";

const app = express();

// Railway / reverse proxy (HTTPS en frontal)
app.set("trust proxy", 1);

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
});
