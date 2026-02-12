import express from "express";
import cors from "cors";
import * as trpcExpress from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./trpc";

const app = express();

// Railway / reverse proxy (HTTPS en frontal)
app.set("trust proxy", 1);

// (Optionnel mais recommandé si tu utilises JSON ailleurs)
app.use(express.json());

// ✅ CORS strict + credentials (OBLIGATOIRE pour cookies cross-domain)
const allowedOrigins = [
  "https://frontend-qara.vercel.app",
  // Ajoute ici tes URLs de preview Vercel si besoin (ex: https://frontend-qara-git-main-xxx.vercel.app)
];

const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => {
    // origin undefined = appels server-to-server / curl / postman
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-trpc-source"],
};

// 1) Appliquer CORS globalement
app.use(cors(corsOptions));

// 2) Répondre aux preflight (sinon navigateur bloque avant même le POST)
app.options("*", cors(corsOptions));

// ✅ tRPC
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
