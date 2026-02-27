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

export function isUrlAllowed(url: string): boolean {
  // Basic allowlist: official domains only for core sources.
  // Keep intentionally strict.
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return (
      host.endsWith("europa.eu") ||
      host.endsWith("eur-lex.europa.eu") ||
      host.endsWith("iso.org") ||
      host.endsWith("iaf.nu") ||
      host.endsWith("imdrf.org")
    );
  } catch {
    return false;
  }
}
