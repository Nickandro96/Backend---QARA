import crypto from "crypto";

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function safeText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function nowUtc(): Date {
  return new Date();
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let t: NodeJS.Timeout | null = null;
  const timeout = new Promise<T>((_, reject) => {
    t = setTimeout(() => reject(new Error(`Timeout (${label}) after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (t) clearTimeout(t);
  }) as Promise<T>;
}

/**
 * Allowlist de domaines officiels pour les connecteurs de veille.
 *
 * Historique (rapport QA 2026-09-02) : la liste ne contenait que les domaines
 * UE + iso.org, si bien que 10 sources sur 13 (ANSM, FDA, Health Canada, TGA,
 * MHRA, Federal Register…) échouaient avec « URL not allowed » avant même la
 * requête réseau. On autorise ici les domaines des régulateurs officiels
 * réellement interrogés par les connecteurs de `server/services/watch/sources/`.
 * Reste volontairement une allowlist stricte (pas de wildcard générique).
 */
const ALLOWED_WATCH_HOSTS: readonly string[] = [
  // Union européenne
  "europa.eu",
  "eur-lex.europa.eu",
  "ec.europa.eu",
  "publications.europa.eu",
  // Normalisation
  "iso.org",
  "iaf.nu",
  "imdrf.org",
  // France — ANSM
  "ansm.sante.fr",
  // États-Unis — FDA / Federal Register
  "fda.gov",
  "federalregister.gov",
  // Canada — Santé Canada
  "canada.ca",
  // Royaume-Uni — MHRA
  "gov.uk",
  // Australie — TGA
  "tga.gov.au",
];

export function isUrlAllowed(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    return ALLOWED_WATCH_HOSTS.some(
      (allowed) => host === allowed || host.endsWith(`.${allowed}`)
    );
  } catch {
    return false;
  }
}
