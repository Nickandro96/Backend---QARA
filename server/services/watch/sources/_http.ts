import axios from "axios";
import { withTimeout } from "../utils";

export async function fetchTextWithRetry(url: string, opts: { timeoutMs: number; retries?: number }): Promise<string> {
  const retries = opts.retries ?? 2;
  let lastErr: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const p = axios.get(url, {
        responseType: "text",
        timeout: opts.timeoutMs,
        headers: {
          "User-Agent": "QARA-WatchEngine/1.0 (+https://example.invalid)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        // follow redirects
        maxRedirects: 5,
        validateStatus: (s) => s >= 200 && s < 400,
      });
      const res = await withTimeout(p, opts.timeoutMs + 500, `GET ${url}`);
      return String(res.data ?? "");
    } catch (e) {
      lastErr = e;
      // exponential backoff (simple)
      const delay = 250 * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("fetch failed");
}
