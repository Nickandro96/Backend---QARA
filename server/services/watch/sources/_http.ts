import axios from "axios";
import { withTimeout } from "../utils";

const lastRequestByDomain = new Map<string, number>();
export const WATCH_USER_AGENT = "QARA-Regulatory-Watch/1.0 (contact: compliance@qara.app)";

export function parseRetryAfterMs(value: unknown, now = Date.now()): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(String(value));
  return Number.isNaN(date) ? null : Math.max(0, date - now);
}

export function exponentialBackoffMs(attempt: number): number { return 250 * 2 ** attempt; }

async function throttle(url: string): Promise<void> {
  const domain = new URL(url).hostname;
  const elapsed = Date.now() - (lastRequestByDomain.get(domain) ?? 0);
  if (elapsed < 1000) await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed));
  lastRequestByDomain.set(domain, Date.now());
}

export async function fetchTextWithRetry(url: string, opts: { timeoutMs: number; retries?: number }): Promise<string> {
  const retries = opts.retries ?? 2;
  let lastErr: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await throttle(url);
      const p = axios.get(url, {
        responseType: "text",
        timeout: opts.timeoutMs,
        headers: {
          "User-Agent": WATCH_USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        // follow redirects
        maxRedirects: 5,
        validateStatus: (s) => s >= 200 && s < 400,
      });
      const res = await withTimeout(p, opts.timeoutMs + 500, `GET ${url}`);
      return String(res.data ?? "");
    } catch (e: any) {
      lastErr = e;
      const delay = parseRetryAfterMs(e?.response?.headers?.["retry-after"]) ?? exponentialBackoffMs(attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("fetch failed");
}
