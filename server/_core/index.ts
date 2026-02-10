import express from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./trpc";

const app = express();

// CORS configuration for Vercel -> Railway with credentials
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(",") ?? true,
  credentials: true,
}));

app.use(express.json());

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
