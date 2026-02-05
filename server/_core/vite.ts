import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function setupVite(app: Express, server: any) {
  // Cette fonction n'est plus utilisée en production sur Railway
  // car le frontend est déployé sur Vercel.
  console.log("Vite setup skipped in production/separate backend mode.");
}

export function serveStatic(app: Express) {
  // Sur Railway, le backend ne sert pas de fichiers statiques
  // car le frontend est sur Vercel. 
  // On laisse une route de base pour vérifier que le serveur tourne.
  app.get("/", (_req, res) => {
    res.json({ status: "ok", message: "MDR Compliance API is running" });
  });
}
